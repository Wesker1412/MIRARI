import React, { useState, useEffect, useRef, useMemo } from 'react';

type ScenarioId = 'chromoglass' | 'hydrated' | 'thaw_freeze';
type CompartmentKind = 'A' | 'B';

interface MonomerInit {
  index: number;
  x: number;
  y: number;
  compartment: CompartmentKind;
  blockId: number;
}

interface MonomerState extends MonomerInit {
  x0: number;
  y0: number;
  driftDist: number;
}

const N_BINS = 64;
const BLOCK_SIZE = 16;
const CAPTURE_RADIUS = 0.285;
const SUBSTEPS_MAX = 72;

// 確定性偽隨機高斯產生器 (Box-Muller)，確保滑桿來回拖動時動力學軌跡可重現且流暢
function seededGaussian(a: number, b: number, axis: number): number {
  const s1 = Math.sin((a * 127.1 + b * 311.7 + axis * 74.7) * 1.37) * 43758.5453;
  const s2 = Math.sin((a * 269.5 + b * 183.3 + axis * 219.1) * 1.91) * 28461.1234;
  const u1 = Math.max(1e-5, s1 - Math.floor(s1));
  const u2 = s2 - Math.floor(s2);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// 決定每條共價骨架鍵 (0..N_BINS-2) 的抗斷裂閾值：確保提高斷裂率時單調增加斷點
const BOND_BREAK_THRESHOLDS: number[] = Array.from({ length: N_BINS - 1 }, (_, i) => {
  const h = Math.sin((i + 1) * 91.3458) * 47453.5453;
  return h - Math.floor(h);
});

// 建構具有分形球體緊緻折疊與 A/B 區室空間隔離的原生 64-bin 染色質構象
function buildNativeGenome(): MonomerInit[] {
  // 4 個染色質區塊 (A0, B1, A2, B3) 的空間質心：A 與 A 相鄰，B 與 B 相鄰，模擬 Hi-C 棋盤格
  const blockCenters: Array<{ cx: number; cy: number; kind: CompartmentKind; angleOffset: number }> = [
    { cx: -0.34, cy: -0.25, kind: 'A', angleOffset: 0.2 },
    { cx: 0.34, cy: 0.27, kind: 'B', angleOffset: 1.8 },
    { cx: -0.24, cy: 0.23, kind: 'A', angleOffset: -0.9 },
    { cx: 0.31, cy: -0.26, kind: 'B', angleOffset: 2.5 },
  ];

  const monomers: MonomerInit[] = [];
  for (let i = 0; i < N_BINS; i++) {
    const blockId = Math.floor(i / BLOCK_SIZE);
    const localIdx = i % BLOCK_SIZE;
    const u = localIdx / (BLOCK_SIZE - 1);
    const cfg = blockCenters[blockId];

    // 區塊內採用無打結緊緻螺旋折疊 (局部空間填充)，並於連接處過渡
    const spiralAngle = cfg.angleOffset + u * Math.PI * 3.1;
    const spiralR = 0.06 + 0.165 * Math.sqrt(u) + 0.025 * Math.sin(u * Math.PI * 4);
    let x = cfg.cx + Math.cos(spiralAngle) * spiralR;
    let y = cfg.cy + Math.sin(spiralAngle) * spiralR;

    // 加入微調以形成染色質環 (Loop) 錨點：(4, 12) 與 (36, 44) 彼此拉近
    if (localIdx === 4 || localIdx === 12) {
      x = cfg.cx + (localIdx === 4 ? -0.02 : 0.02);
      y = cfg.cy + (localIdx === 4 ? -0.02 : 0.02);
    }
    if (blockId === 2 && (localIdx === 4 || localIdx === 12)) {
      x = cfg.cx + (localIdx === 4 ? -0.025 : 0.025);
      y = cfg.cy + (localIdx === 4 ? 0.02 : -0.02);
    }

    monomers.push({
      index: i,
      x,
      y,
      compartment: cfg.kind,
      blockId,
    });
  }
  return monomers;
}

const NATIVE_GENOME = buildNativeGenome();

function computeContactMatrix(positions: Array<{ x: number; y: number }>): Float32Array {
  const mat = new Float32Array(N_BINS * N_BINS);
  const rc2 = CAPTURE_RADIUS * CAPTURE_RADIUS;
  for (let i = 0; i < N_BINS; i++) {
    mat[i * N_BINS + i] = 1.0;
    for (let j = i + 1; j < N_BINS; j++) {
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const d2 = dx * dx + dy * dy;
      const ratio2 = d2 / rc2;
      const prob = 1.0 / (1.0 + ratio2 * ratio2);
      mat[i * N_BINS + j] = prob;
      mat[j * N_BINS + i] = prob;
    }
  }
  return mat;
}

const NATIVE_MATRIX = computeContactMatrix(NATIVE_GENOME);

// 計算 Hi-C 標度律曲線 P(s) 與對數斜率 α (P(s) ∝ s^α)
function computeScalingCurve(matrix: Float32Array): { ps: number[]; alpha: number } {
  const maxS = 44;
  const ps: number[] = [];
  for (let s = 1; s <= maxS; s++) {
    let sum = 0;
    const count = N_BINS - s;
    for (let i = 0; i < count; i++) {
      sum += matrix[i * N_BINS + (i + s)];
    }
    ps.push(sum / count);
  }

  // 在 s ∈ [2, 24] 區間以最小平方法估計 log10 P(s) vs log10 s 斜率
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  let nFit = 0;
  for (let s = 2; s <= 24; s++) {
    const lx = Math.log10(s);
    const ly = Math.log10(Math.max(1e-4, ps[s - 1]));
    sumX += lx;
    sumY += ly;
    sumXX += lx * lx;
    sumXY += lx * ly;
    nFit++;
  }
  const denom = nFit * sumXX - sumX * sumX;
  const alpha = denom > 1e-9 ? (nFit * sumXY - sumX * sumY) / denom : 0;

  return { ps, alpha };
}

// 計算遠程 A/B 區室接觸矩陣皮爾森相關係數 (|i - j| >= 8)
function computeCompartmentRetention(currentMat: Float32Array): number {
  const valsA: number[] = [];
  const valsB: number[] = [];
  for (let i = 0; i < N_BINS; i++) {
    for (let j = i + 8; j < N_BINS; j++) {
      valsA.push(NATIVE_MATRIX[i * N_BINS + j]);
      valsB.push(currentMat[i * N_BINS + j]);
    }
  }
  const n = valsA.length;
  let meanA = 0;
  let meanB = 0;
  for (let k = 0; k < n; k++) {
    meanA += valsA[k];
    meanB += valsB[k];
  }
  meanA /= n;
  meanB /= n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let k = 0; k < n; k++) {
    const da = valsA[k] - meanA;
    const db = valsB[k] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA < 1e-12 || varB < 1e-12) return 0;
  const r = cov / Math.sqrt(varA * varB);
  return Math.max(0, Math.min(100, r * 100));
}

// 將接觸機率 [0, 1] 映射為經典 Hi-C 白→琥珀→深紅熱圖色彩
function hicColorRgb(prob: number): [number, number, number] {
  const p = Math.max(0, Math.min(1, Math.pow(prob, 0.56)));
  if (p < 0.25) {
    const t = p / 0.25;
    return [
      Math.round(13 + t * 48),
      Math.round(20 + t * 20),
      Math.round(36 + t * 22),
    ];
  }
  if (p < 0.62) {
    const t = (p - 0.25) / 0.37;
    return [
      Math.round(61 + t * 178),
      Math.round(40 + t * 72),
      Math.round(58 - t * 32),
    ];
  }
  const t = (p - 0.62) / 0.38;
  return [
    Math.round(239 + t * 16),
    Math.round(112 + t * 116),
    Math.round(26 + t * 140),
  ];
}

export const ChromoglassHiCSimulator: React.FC = () => {
  const [scenario, setScenario] = useState<ScenarioId>('chromoglass');
  // 有效溫度／含水潤滑度 u ∈ [0.04, 1.00]: u < 0.30 處於玻璃態 (T < T_g)
  const [hydrationPlasticity, setHydrationPlasticity] = useState<number>(0.08);
  // 時間演化進度 τ ∈ [0.00, 1.00] 對應 0 ~ 52,000 年
  const [timeProgress, setTimeProgress] = useState<number>(0.88);
  // DNA 骨幹化學斷裂程度 f ∈ [0.00, 0.95]
  const [fragmentationRate, setFragmentationRate] = useState<number>(0.88);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const applyScenario = (next: ScenarioId) => {
    setIsPlaying(false);
    setScenario(next);
    if (next === 'chromoglass') {
      setHydrationPlasticity(0.08);
      setTimeProgress(0.88);
      setFragmentationRate(0.88);
    } else if (next === 'hydrated') {
      setHydrationPlasticity(0.88);
      setTimeProgress(0.88);
      setFragmentationRate(0.85);
    } else {
      setHydrationPlasticity(0.46);
      setTimeProgress(0.88);
      setFragmentationRate(0.85);
    }
  };

  // 動畫播放：從 0 年演化至 52,000 年
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setTimeProgress((prev) => {
        const next = prev + 0.015;
        if (next >= 1.0) {
          setIsPlaying(false);
          return 1.0;
        }
        return parseFloat(next.toFixed(3));
      });
    }, 55);
    return () => clearInterval(timer);
  }, [isPlaying]);

  // 核心物理求解：計算黏度、Stokes–Einstein 擴散係數、過阻尼朗之萬軌跡、接觸矩陣與 P(s)
  const simState = useMemo(() => {
    // 1. 決定共價骨架斷裂狀態與各連通片段長度
    const brokenBonds: boolean[] = BOND_BREAK_THRESHOLDS.map((th) => th < fragmentationRate);
    let brokenCount = 0;
    for (const b of brokenBonds) if (b) brokenCount++;

    const fragmentLengths = new Int32Array(N_BINS);
    let segStart = 0;
    for (let i = 0; i < N_BINS; i++) {
      const isEnd = i === N_BINS - 1 || brokenBonds[i];
      if (isEnd) {
        const len = i - segStart + 1;
        for (let k = segStart; k <= i; k++) fragmentLengths[k] = len;
        segStart = i + 1;
      }
    }

    // 估計平均古 DNA 片段長度 (bp): 完整 ~ 15,000 bp，高度斷裂 ~ 42 bp
    const avgFragmentBins = N_BINS / (brokenCount + 1);
    const meanFragBp = Math.round(35 + Math.pow(avgFragmentBins - 1, 1.85) * 4.2);

    // 2. 玻璃態轉變有效黏度 (Vogel-Fulcher-Tammann 急劇凍結) 與 Stokes-Einstein D
    const u = Math.max(0.04, Math.min(1.0, hydrationPlasticity));
    const logViscosityRatio = Math.max(0, 2.35 / (u + 0.28) - 1.84);
    const viscosityRatio = Math.pow(10, logViscosityRatio);
    const thermalFactor = 0.72 + 0.45 * u;
    const dRatioBase = thermalFactor / viscosityRatio;

    // 3. 過阻尼朗之萬動力學 (Overdamped Langevin + Caging + Covalent Spring)
    const nSteps = Math.max(0, Math.round(timeProgress * SUBSTEPS_MAX));
    const dt = 0.042;
    const x = NATIVE_GENOME.map((m) => m.x);
    const y = NATIVE_GENOME.map((m) => m.y);
    const fx = new Float64Array(N_BINS);
    const fy = new Float64Array(N_BINS);

    const glassCageStrength = u < 0.34 ? Math.pow((0.34 - u) / 0.34, 1.5) * 24.0 : 0.0;
    const isThawFreeze = scenario === 'thaw_freeze';

    for (let step = 0; step < nSteps; step++) {
      fx.fill(0);
      fy.fill(0);

      // 凍融循環的週期性水合脈衝與冰晶剪力擾動
      const cyclePhase = isThawFreeze ? 0.5 + 0.5 * Math.sin(step * 0.45) : 0;
      const stepDiffBoost = isThawFreeze ? 1.0 + 3.2 * cyclePhase : 1.0;

      // (a) 未斷裂共價骨幹彈力
      for (let i = 0; i < N_BINS - 1; i++) {
        if (!brokenBonds[i]) {
          const dx = x[i + 1] - x[i];
          const dy = y[i + 1] - y[i];
          const dist = Math.hypot(dx, dy) + 1e-6;
          const restLen = Math.hypot(
            NATIVE_GENOME[i + 1].x - NATIVE_GENOME[i].x,
            NATIVE_GENOME[i + 1].y - NATIVE_GENOME[i].y
          );
          const kSpring = 11.5;
          const fMag = kSpring * (dist - restLen);
          const ux = dx / dist;
          const uy = dy / dist;
          fx[i] += fMag * ux;
          fy[i] += fMag * uy;
          fx[i + 1] -= fMag * ux;
          fy[i + 1] -= fMag * uy;
        }
      }

      // (b) 染色質玻璃籠鎖回復力 + 細胞核膜軟邊界約束 + 熱噪聲擴散
      for (let i = 0; i < N_BINS; i++) {
        // 玻璃態籠鎖：周圍脫水高分子牆把片段鎖在原位 Voronoi 牢籠
        if (glassCageStrength > 0) {
          fx[i] += -glassCageStrength * (x[i] - NATIVE_GENOME[i].x);
          fy[i] += -glassCageStrength * (y[i] - NATIVE_GENOME[i].y);
        }

        // 核膜邊界半徑 R = 0.90
        const r = Math.hypot(x[i], y[i]);
        if (r > 0.88) {
          const push = (r - 0.88) * 18.0;
          fx[i] -= (x[i] / r) * push;
          fy[i] -= (y[i] / r) * push;
        }

        // 依 Stokes-Einstein 反比於片段水動力學尺度 a ~ L_frag^0.45
        const sizeFactor = 1.0 / Math.pow(fragmentLengths[i], 0.45);
        const dEff = dRatioBase * stepDiffBoost * sizeFactor;
        const noiseAmp = Math.sqrt(2.0 * dEff * dt) * 0.36;

        const gx = seededGaussian(step + 1, i + 7, 1);
        const gy = seededGaussian(step + 1, i + 7, 2);

        // 凍融冰晶剪力對斷裂片段產生額外平流推擠
        const shearPush = isThawFreeze ? cyclePhase * 0.018 * (NATIVE_GENOME[i].blockId % 2 === 0 ? 1 : -1) : 0;

        x[i] += fx[i] * dt + noiseAmp * gx + shearPush;
        y[i] += fy[i] * dt + noiseAmp * gy * 0.96;

        // 硬性夾限於細胞核盤面內
        const nr = Math.hypot(x[i], y[i]);
        if (nr > 0.93) {
          x[i] *= 0.93 / nr;
          y[i] *= 0.93 / nr;
        }
      }
    }

    const monomers: MonomerState[] = NATIVE_GENOME.map((m, i) => ({
      ...m,
      x: x[i],
      y: y[i],
      x0: m.x,
      y0: m.y,
      driftDist: Math.hypot(x[i] - m.x, y[i] - m.y),
    }));

    const contactMatrix = computeContactMatrix(monomers);
    const { ps, alpha } = computeScalingCurve(contactMatrix);
    const retentionPct = computeCompartmentRetention(contactMatrix);

    let phaseLabel = '玻璃態籠鎖 (T < Tg)';
    let phaseTone: 'cyan' | 'amber' | 'rose' = 'cyan';
    if (u >= 0.42) {
      phaseLabel = '水合自由擴散 (T > Tg)';
      phaseTone = 'rose';
    } else if (u >= 0.25) {
      phaseLabel = '軟化過渡區 (T ≈ Tg)';
      phaseTone = 'amber';
    }

    return {
      monomers,
      brokenBonds,
      brokenCount,
      meanFragBp,
      viscosityRatio,
      dRatioBase,
      contactMatrix,
      ps,
      alpha,
      retentionPct,
      phaseLabel,
      phaseTone,
    };
  }, [scenario, hydrationPlasticity, timeProgress, fragmentationRate]);

  // 繪製左側面板：細胞核高分子碎裂與擴散動力學場
  useEffect(() => {
    const canvas = leftCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#060a13';
    ctx.fillRect(0, 0, W, H);

    // 標題列
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('細胞核染色質高分子碎裂與擴散場', 14, 22);

    const badgeColor =
      simState.phaseTone === 'cyan'
        ? '#22d3ee'
        : simState.phaseTone === 'amber'
          ? '#fbbf24'
          : '#fb7185';
    ctx.fillStyle = badgeColor;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(simState.phaseLabel, W - 156, 22);

    const cx = W * 0.5;
    const cy = H * 0.52;
    const nucR = 136;

    // 細胞核背景與玻璃態冰晶網格氛圍
    const grad = ctx.createRadialGradient(cx, cy, 12, cx, cy, nucR);
    if (simState.phaseTone === 'cyan') {
      grad.addColorStop(0, 'rgba(14, 116, 144, 0.22)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
    } else if (simState.phaseTone === 'amber') {
      grad.addColorStop(0, 'rgba(180, 83, 9, 0.18)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
    } else {
      grad.addColorStop(0, 'rgba(190, 18, 60, 0.18)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, nucR, 0, Math.PI * 2);
    ctx.fill();

    // 核膜雙層虛實線
    ctx.strokeStyle = simState.phaseTone === 'cyan' ? '#38bdf8' : simState.phaseTone === 'amber' ? '#f59e0b' : '#f43f5e';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, nucR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, nucR + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const { monomers, brokenBonds } = simState;

    // 1. 畫出原位參考虛線軌跡 (顯示碎片是否被籠鎖於原地，或已遠距漂移)
    for (const m of monomers) {
      if (m.driftDist > 0.03) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + m.x0 * nucR, cy + m.y0 * nucR);
        ctx.lineTo(cx + m.x * nucR, cy + m.y * nucR);
        ctx.stroke();
      }
    }

    // 2. 繪製 DNA 骨架：未斷裂為實線，已斷裂為紅色缺口標記
    for (let i = 0; i < N_BINS - 1; i++) {
      const a = monomers[i];
      const b = monomers[i + 1];
      const ax = cx + a.x * nucR;
      const ay = cy + a.y * nucR;
      const bx = cx + b.x * nucR;
      const by = cy + b.y * nucR;

      if (!brokenBonds[i]) {
        ctx.strokeStyle =
          a.compartment === 'A' ? 'rgba(56, 189, 248, 0.78)' : 'rgba(251, 191, 36, 0.78)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      } else {
        // 斷裂缺口標記：僅在距離尚近時畫紅叉/短斷裂提示，表示骨架斷開
        const mx = (ax + bx) * 0.5;
        const my = (ay + by) * 0.5;
        const dPx = Math.hypot(bx - ax, by - ay);
        if (dPx < 36) {
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(mx - 3, my - 3);
          ctx.lineTo(mx + 3, my + 3);
          ctx.moveTo(mx + 3, my - 3);
          ctx.lineTo(mx - 3, my + 3);
          ctx.stroke();
        }
      }
    }

    // 3. 繪製染色質單體與玻璃態籠鎖環 (Voronoi Cage)
    for (const m of monomers) {
      const px = cx + m.x * nucR;
      const py = cy + m.y * nucR;

      if (simState.phaseTone === 'cyan') {
        ctx.strokeStyle = 'rgba(103, 232, 249, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, 8.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = m.compartment === 'A' ? '#38bdf8' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(px, py, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 底部圖例與時間標記
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('● A 區室 (常染色質)', 14, H - 16);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('● B 區室 (異染色質)', 124, H - 16);
    ctx.fillStyle = '#f43f5e';
    ctx.fillText('× DNA 雙股斷點', 234, H - 16);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`t = ${Math.round(timeProgress * 52000).toLocaleString()} 年`, W - 92, H - 16);
  }, [simState, timeProgress]);

  // 繪製右側面板：PaleoHi-C 接觸矩陣熱圖 + P(s) 標度律對數圖
  useEffect(() => {
    const canvas = rightCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#060a13';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('即時 PaleoHi-C 接觸矩陣與 P(s) 標度律', 14, 22);

    // 1. Hi-C 64x64 熱圖 (左側 218x218 區域)
    const matX = 28;
    const matY = 52;
    const matSize = 216;
    const cell = matSize / N_BINS;

    // A/B 區室色條 (上緣與左緣)
    for (let i = 0; i < N_BINS; i++) {
      const color = NATIVE_GENOME[i].compartment === 'A' ? '#38bdf8' : '#f59e0b';
      ctx.fillStyle = color;
      ctx.fillRect(matX + i * cell, matY - 8, cell + 0.4, 5);
      ctx.fillRect(matX - 8, matY + i * cell, 5, cell + 0.4);
    }

    const { contactMatrix, ps, alpha } = simState;
    for (let i = 0; i < N_BINS; i++) {
      for (let j = 0; j < N_BINS; j++) {
        const prob = contactMatrix[i * N_BINS + j];
        const [r, g, b] = hicColorRgb(prob);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(matX + j * cell, matY + i * cell, cell + 0.45, cell + 0.45);
      }
    }

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(matX, matY, matSize, matSize);

    // 繪製區室區塊分界虛線
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.setLineDash([2, 2]);
    for (let b = 1; b < 4; b++) {
      const offset = b * BLOCK_SIZE * cell;
      ctx.beginPath();
      ctx.moveTo(matX + offset, matY);
      ctx.lineTo(matX + offset, matY + matSize);
      ctx.moveTo(matX, matY + offset);
      ctx.lineTo(matX + matSize, matY + offset);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('A / B 區室基因組座標 (i vs j)', matX + 34, matY + matSize + 18);

    // 熱圖色階條
    const barX = matX;
    const barY = matY + matSize + 34;
    const barW = 140;
    for (let px = 0; px < barW; px++) {
      const [r, g, b] = hicColorRgb(px / barW);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(barX + px, barY, 1.5, 8);
    }
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(barX, barY, barW, 8);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.fillText('低接觸', barX, barY + 20);
    ctx.fillText('高接觸頻率', barX + barW - 46, barY + 20);

    // 2. 右側：log-log P(s) 標度律曲線圖
    const pL = 276;
    const pT = 52;
    const pW = W - pL - 16;
    const pH = 216;

    ctx.fillStyle = '#0b1220';
    ctx.fillRect(pL, pT, pW, pH);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(pL, pT, pW, pH);

    // 對數座標網格
    const xMin = Math.log10(1);
    const xMax = Math.log10(44);
    const yMin = -2.1;
    const yMax = 0.05;

    const toPx = (s: number) => pL + 10 + ((Math.log10(s) - xMin) / (xMax - xMin)) * (pW - 20);
    const toPy = (val: number) => {
      const ly = Math.max(yMin, Math.min(yMax, Math.log10(Math.max(1e-3, val))));
      return pT + pH - 12 - ((ly - yMin) / (yMax - yMin)) * (pH - 24);
    };

    // 繪製參考斜線 P(s) ∝ s⁻¹ (分形球體理論標度律)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let s = 1; s <= 44; s++) {
      const refVal = 0.85 * Math.pow(s, -1.0);
      const px = toPx(s);
      const py = toPy(refVal);
      if (s === 1) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 繪製即時計算之 P(s) 曲線
    ctx.strokeStyle = simState.phaseTone === 'cyan' ? '#38bdf8' : simState.phaseTone === 'amber' ? '#fbbf24' : '#fb7185';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let s = 1; s <= ps.length; s++) {
      const px = toPx(s);
      const py = toPy(ps[s - 1]);
      if (s === 1) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // P(s) 圖標與文字
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('log P(s) vs log s', pL + 10, pT + 16);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('-- 分形球體 s⁻¹', pL + 10, pT + pH - 24);
    ctx.fillStyle = simState.phaseTone === 'cyan' ? '#38bdf8' : simState.phaseTone === 'amber' ? '#fbbf24' : '#fb7185';
    ctx.fillText(`━ 實測 α = ${alpha.toFixed(2)}`, pL + 10, pT + pH - 10);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('基因組間隔 s →', pL + pW * 0.25, pT + pH + 18);

    // 保真度條
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`棋盤保真度: ${simState.retentionPct.toFixed(1)}%`, pL + 4, barY + 8);
  }, [simState]);

  const formatSci = (val: number) => {
    if (val >= 0.05) return val.toFixed(2);
    const exp = Math.floor(Math.log10(Math.max(1e-9, val)));
    const mant = val / Math.pow(10, exp);
    return `${mant.toFixed(1)}×10^${exp}`;
  };

  return (
    <div className="my-8 w-full max-w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 sm:p-5 text-slate-100 shadow-2xl">
      {/* 頂部標題與實驗情境切換 */}
      <div className="flex flex-col gap-3 border-b border-slate-700/80 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-cyan-300">
              染色質玻璃態（Chromoglass）與 PaleoHi-C 接觸矩陣模擬器
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              比較 DNA 骨架斷裂後，脫水玻璃態「籠鎖效應」與常溫水合自由擴散如何截然不同地決定三維拓撲命運
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (timeProgress >= 0.99) setTimeProgress(0.0);
                setIsPlaying((p) => !p);
              }}
              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500"
            >
              {isPlaying ? '⏸ 暫停演化' : '▶ 播放五萬年演化'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setTimeProgress(0.0);
              }}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
            >
              重置 t = 0
            </button>
          </div>
        </div>

        {/* 預設實驗情景切換按鈕 */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyScenario('chromoglass')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition border ${
              scenario === 'chromoglass'
                ? 'border-cyan-400 bg-cyan-950/80 text-cyan-200 shadow-sm'
                : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-800'
            }`}
          >
            極寒凍乾玻璃態 (Chromoglass, T &lt; Tg)
          </button>
          <button
            type="button"
            onClick={() => applyScenario('hydrated')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition border ${
              scenario === 'hydrated'
                ? 'border-rose-400 bg-rose-950/75 text-rose-200 shadow-sm'
                : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-800'
            }`}
          >
            活細胞／常溫水合擴散 (Hydrated Degradation)
          </button>
          <button
            type="button"
            onClick={() => applyScenario('thaw_freeze')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition border ${
              scenario === 'thaw_freeze'
                ? 'border-amber-400 bg-amber-950/75 text-amber-200 shadow-sm'
                : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-800'
            }`}
          >
            反覆凍融損毀 (Thaw-Freeze Cycling)
          </button>
        </div>
      </div>

      {/* 雙物理聯動面板 (電腦並排、390px 手機垂直堆疊無溢出) */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
          <canvas
            ref={leftCanvasRef}
            width={430}
            height={360}
            className="block h-auto w-full rounded-lg"
          />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
          <canvas
            ref={rightCanvasRef}
            width={430}
            height={360}
            className="block h-auto w-full rounded-lg"
          />
        </div>
      </div>

      {/* 即時軟物質物理與基因組接觸指標 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">Stokes-Einstein 相對擴散 D/D₀</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-cyan-300">
            {formatSci(simState.dRatioBase)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            有效黏度 η/η₀ ≈ {simState.viscosityRatio > 99 ? simState.viscosityRatio.toExponential(1) : simState.viscosityRatio.toFixed(1)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">平均古 DNA 片段長度</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-rose-300">
            ~{simState.meanFragBp.toLocaleString()} bp
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            斷裂位點：{simState.brokenCount} / {N_BINS - 1}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">A/B 區室棋盤保真度</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-emerald-400">
            {simState.retentionPct.toFixed(1)}%
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">遠程接觸相關係數</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">標度律冪次指數 α</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-amber-300">
            P(s) ∝ s^({simState.alpha.toFixed(2)})
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">分形球體理論值 −1.00</div>
        </div>
      </div>

      {/* 三組物理控制滑桿 */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">有效溫度／含水潤滑度</span>
            <span className="font-mono font-bold text-cyan-300">{(hydrationPlasticity * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0.04}
            max={1.0}
            step={0.02}
            value={hydrationPlasticity}
            onChange={(e) => setHydrationPlasticity(parseFloat(e.target.value))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>脫水玻璃態 (T &lt; Tg)</span>
            <span>高含水融解 (T &gt; Tg)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">時間演化進度</span>
            <span className="font-mono font-bold text-amber-300">
              {Math.round(timeProgress * 52000).toLocaleString()} 年
            </span>
          </div>
          <input
            type="range"
            min={0.0}
            max={1.0}
            step={0.02}
            value={timeProgress}
            onChange={(e) => {
              setIsPlaying(false);
              setTimeProgress(parseFloat(e.target.value));
            }}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0 年 (死亡瞬間)</span>
            <span>52,000 年 (出土採樣)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">DNA 骨幹斷裂程度</span>
            <span className="font-mono font-bold text-rose-300">{(fragmentationRate * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={0.95}
            step={0.05}
            value={fragmentationRate}
            onChange={(e) => setFragmentationRate(parseFloat(e.target.value))}
            className="mt-2 w-full accent-rose-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0% (完整長鏈)</span>
            <span>95% (數十 bp 短碎屑)</span>
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <strong className="text-slate-200">模型說明：</strong>
        本模擬器為粗粒化高分子與受阻擴散示範模型，呈現脫水玻璃態鎖定遠程拓撲接觸的軟物質機制。在「極寒凍乾玻璃態」下，即使 DNA 骨架已有近九成斷裂（紅色標記），極高有效黏度使 Stokes–Einstein 擴散係數 D = k_B T / (6πη_eff a) 趨近於零，將碎屑籠鎖於原地並完整保存 A/B 區室棋盤格與 P(s) ∝ s⁻¹ 標度律；一旦升溫或加水跨越 T_g，碎片即刻自由擴散並抹平三維圖譜。
      </div>
    </div>
  );
};
