import React, { useState, useEffect, useRef, useMemo } from 'react';

type ScanMode = 'constant_height' | 'constant_current';

interface SurfaceSample {
  zGeom: number; // 幾何原子台階高度 (Å)
  ldosMod: number; // 局域電子態密度調變 (量子圍欄駐波 + 表面原子波紋)
}

/**
 * 計算表面在位置 x (0..100 Å) 的幾何形貌與費米能級局域電子態密度 (LDOS)
 * 左側 (x = 0..42 Å): 含單原子台階的階梯表面 (台階高度 2.08 Å，對應 Cu(111) 單原子層)
 * 右側 (x = 46..96 Å): 48 顆 Fe 原子圍成的圓形量子圍欄剖面，內部產生 J0(k_F r) 駐波振盪
 */
function sampleSurfaceAt(xAngstrom: number): SurfaceSample {
  // 單原子層台階 (於 x = 22 Å 處平滑過渡上升 2.08 Å)
  const stepTransition = 1 / (1 + Math.exp(-(xAngstrom - 22) * 1.4));
  const stepLeftMask = xAngstrom < 42 ? 1 : Math.exp(-((xAngstrom - 42) ** 2) / 18);
  const stepHeight = 1.95 * stepTransition * stepLeftMask;

  // 表面晶格原子波紋 (週期 ~2.55 Å，振幅 ~0.12 Å)
  const atomicCorrugation = 0.12 * Math.cos((2 * Math.PI * xAngstrom) / 2.55);

  // 量子圍欄兩側鐵原子壁 (x = 52 Å 與 x = 88 Å，中心 xc = 70 Å，半徑 R = 18 Å)
  const wall1 = 1.35 * Math.exp(-((xAngstrom - 52) ** 2) / 2.2);
  const wall2 = 1.35 * Math.exp(-((xAngstrom - 88) ** 2) / 2.2);

  // 圍欄內部表面態電子駐波 (類貝索函數 J0 徑向駐波，波長 λ_F/2 ≈ 15 Å)
  const distFromCenter = Math.abs(xAngstrom - 70);
  let corralStandingWave = 0;
  if (xAngstrom >= 50 && xAngstrom <= 90) {
    const insideFactor = Math.exp(-((distFromCenter / 17.5) ** 6));
    const kr = (distFromCenter / 18) * 7.8;
    // J0 近似展開 (含衰減包絡)
    const j0Approx = Math.cos(kr - Math.PI / 4) / Math.sqrt(1 + 0.35 * kr);
    corralStandingWave = 0.55 * j0Approx * insideFactor;
  }

  // 合成有效表面高度與 LDOS 貢獻 (Tersoff-Hamann 模型中 LDOS 調變等價於表觀高度變化)
  const zGeom = stepHeight + atomicCorrugation + wall1 + wall2;
  const ldosMod = 1.0 + 0.72 * corralStandingWave + 0.14 * Math.cos((2 * Math.PI * xAngstrom) / 2.55);

  return { zGeom, ldosMod: Math.max(0.25, ldosMod) };
}

export const StmTunnelingSimulator: React.FC = () => {
  const [scanMode, setScanMode] = useState<ScanMode>('constant_height');
  const [baseDistance, setBaseDistance] = useState<number>(5.2); // 基礎針尖-基底距離 d0 (Å)
  const [workFunction, setWorkFunction] = useState<number>(4.5); // 功函數 φ (eV)
  const [tipX, setTipX] = useState<number>(70); // 掃描水平位置 x (0..100 Å)
  const [isScanning, setIsScanning] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 量子穿隧衰減常數 κ = sqrt(2 m_e φ) / hbar ≈ 0.5123 * sqrt(φ / eV) (Å^-1)
  const kappa = useMemo(() => 0.5123 * Math.sqrt(workFunction), [workFunction]);

  // 根據當前模式與參數計算整個 0..100 Å 掃描剖面
  const scanProfile = useMemo(() => {
    const points: {
      x: number;
      zSurface: number;
      zTip: number;
      localGap: number;
      currentNa: number;
      ldos: number;
    }[] = [];

    // 基準參考電流 (d = baseDistance, ldos = 1, V_bias = 0.1 V)
    const i0 = 85000; // 尺度係數使典型 4~6 Å 對應 0.1 ~ 50 nA
    const setpointCurrentNa = i0 * Math.exp(-2 * kappa * baseDistance);

    for (let i = 0; i <= 200; i++) {
      const x = (i / 200) * 100;
      const sample = sampleSurfaceAt(x);
      // 有效等效表面高度 (包含台階/鐵原子與 LDOS 態密度凸起)
      const effectiveSurfaceZ = sample.zGeom + Math.log(sample.ldosMod) / (2 * kappa);

      let zTip = baseDistance + 2.2; // 定高模式維持固定絕對高度 (預留台階上方安全間隙)
      let localGap = Math.max(0.8, zTip - sample.zGeom);
      let currentNa = i0 * sample.ldosMod * Math.exp(-2 * kappa * localGap);

      if (scanMode === 'constant_current') {
        // 回饋伺服迴路維持 I ≈ I_set，反解針尖高度 zTip(x)
        const targetGap = Math.max(
          1.2,
          baseDistance + Math.log(sample.ldosMod) / (2 * kappa)
        );
        zTip = sample.zGeom + targetGap;
        localGap = zTip - sample.zGeom;
        // 微小伺服殘差波紋模擬真實回饋頻寬
        const servoRipple = 1 + 0.03 * Math.sin(x * 1.4);
        currentNa = setpointCurrentNa * servoRipple;
      }

      points.push({
        x,
        zSurface: effectiveSurfaceZ,
        zTip,
        localGap,
        currentNa,
        ldos: sample.ldosMod,
      });
    }

    return { points, setpointCurrentNa };
  }, [scanMode, baseDistance, kappa]);

  // 當前探針位置的即時物理指標
  const currentMetrics = useMemo(() => {
    const idx = Math.min(200, Math.max(0, Math.round((tipX / 100) * 200)));
    const pt = scanProfile.points[idx];
    const attenuation = Math.exp(-2 * kappa * pt.localGap);
    const decadeFactor = Math.exp(2 * kappa * 1.0); // 距離改變 1 Å 的電流倍率
    return {
      ...pt,
      attenuation,
      decadeFactor,
    };
  }, [scanProfile, tipX, kappa]);

  // 自動來回掃描動畫
  useEffect(() => {
    if (!isScanning) return;
    let direction = 0.45;
    let rafId = 0;

    const tick = () => {
      setTipX((prev) => {
        let next = prev + direction;
        if (next >= 96) {
          next = 96;
          direction = -0.45;
        } else if (next <= 4) {
          next = 4;
          direction = 0.45;
        }
        return parseFloat(next.toFixed(2));
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isScanning]);

  // 雙視圖 Canvas 繪製
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. 深邃實驗室背景
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    const padL = 56;
    const padR = 24;
    const plotW = w - padL - padR;

    // ─── 上視圖：微觀表面剖面、針尖掃描與真空位壘波函數衰減 (y = 14 .. 200) ───
    const topY0 = 14;
    const topH = 186;
    const baseSurfacePxY = topY0 + topH - 28;
    const pxPerAngstromZ = 13.5;

    ctx.fillStyle = '#0b1120';
    ctx.fillRect(padL, topY0, plotW, topH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(padL, topY0, plotW, topH);

    // 標註區域：左側單原子台階 / 右側量子圍欄
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText('Cu(111) 單原子台階', padL + 14, topY0 + 16);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Fe 原子「量子圍欄」與駐波 LDOS', padL + plotW * 0.53, topY0 + 16);

    const xToPx = (x: number) => padL + (x / 100) * plotW;

    // 繪製樣品表面本體填充 (幾何 + 態密度微光)
    ctx.beginPath();
    ctx.moveTo(padL, topY0 + topH);
    for (const pt of scanProfile.points) {
      const s = sampleSurfaceAt(pt.x);
      const px = xToPx(pt.x);
      const py = baseSurfacePxY - s.zGeom * pxPerAngstromZ;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(padL + plotW, topY0 + topH);
    ctx.closePath();
    const surfGrad = ctx.createLinearGradient(0, baseSurfacePxY - 40, 0, topY0 + topH);
    surfGrad.addColorStop(0, '#334155');
    surfGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = surfGrad;
    ctx.fill();

    // 繪製表層 LDOS 電子雲發光輪廓 (駐波強度以青金色高亮)
    for (let i = 0; i < scanProfile.points.length - 1; i++) {
      const pt = scanProfile.points[i];
      const nextPt = scanProfile.points[i + 1];
      const s = sampleSurfaceAt(pt.x);
      const px = xToPx(pt.x);
      const py = baseSurfacePxY - s.zGeom * pxPerAngstromZ;
      const nx = xToPx(nextPt.x);
      const ny = baseSurfacePxY - sampleSurfaceAt(nextPt.x).zGeom * pxPerAngstromZ;

      const glowAlpha = Math.min(1, 0.25 + (pt.ldos - 0.3) * 0.55);
      ctx.strokeStyle =
        pt.x >= 50 && pt.x <= 90
          ? `rgba(56, 189, 248, ${glowAlpha.toFixed(2)})`
          : `rgba(148, 163, 184, 0.85)`;
      ctx.lineWidth = pt.x >= 50 && pt.x <= 90 ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
    }

    // 繪製量子圍欄的兩顆邊界 Fe 原子球與駐波示意漣漪
    [52, 88].forEach((feX) => {
      const feSample = sampleSurfaceAt(feX);
      const fx = xToPx(feX);
      const fy = baseSurfacePxY - feSample.zGeom * pxPerAngstromZ;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(fx, fy + 3, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // 若處於定電流模式，繪製針尖掃描軌跡虛線 (LDOS 等高面)
    ctx.strokeStyle = scanMode === 'constant_current' ? 'rgba(52, 211, 153, 0.7)' : 'rgba(244, 63, 94, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    scanProfile.points.forEach((pt, idx) => {
      const px = xToPx(pt.x);
      const py = baseSurfacePxY - pt.zTip * pxPerAngstromZ;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // 繪製 STM 探針針尖 (於 tipX)
    const tipPxX = xToPx(tipX);
    const tipSample = sampleSurfaceAt(tipX);
    const surfAtTipY = baseSurfacePxY - tipSample.zGeom * pxPerAngstromZ;
    const tipApexY = baseSurfacePxY - currentMetrics.zTip * pxPerAngstromZ;

    // 探針金屬錐體
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(tipPxX - 18, topY0 + 2);
    ctx.lineTo(tipPxX + 18, topY0 + 2);
    ctx.lineTo(tipPxX + 3, tipApexY - 6);
    ctx.lineTo(tipPxX, tipApexY);
    ctx.lineTo(tipPxX - 3, tipApexY - 6);
    ctx.closePath();
    ctx.fill();

    // 針尖最前端單顆金屬原子 (Pt-Ir / W 尖端原子)
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(tipPxX, tipApexY, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // 繪製真空隙縫中的真實量子穿隧波函數 Re(ψ(z)) 指數衰減與機率包絡
    const gapHeightPx = Math.max(12, surfAtTipY - tipApexY);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const waveSamples = 40;
    for (let k = 0; k <= waveSamples; k++) {
      const frac = k / waveSamples; // 0 (樣品表面) -> 1 (針尖)
      const zAng = frac * currentMetrics.localGap;
      const amp = Math.exp(-kappa * zAng); // ψ(z) 衰減
      const osc = Math.cos(frac * Math.PI * 5);
      const py = surfAtTipY - frac * gapHeightPx;
      const px = tipPxX + amp * osc * 16;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 波函數機率密度包絡陰影 |ψ(z)|² = exp(-2κz)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.beginPath();
    ctx.moveTo(tipPxX, surfAtTipY);
    for (let k = 0; k <= waveSamples; k++) {
      const frac = k / waveSamples;
      const zAng = frac * currentMetrics.localGap;
      const prob = Math.exp(-2 * kappa * zAng);
      ctx.lineTo(tipPxX + prob * 22, surfAtTipY - frac * gapHeightPx);
    }
    for (let k = waveSamples; k >= 0; k--) {
      const frac = k / waveSamples;
      const zAng = frac * currentMetrics.localGap;
      const prob = Math.exp(-2 * kappa * zAng);
      ctx.lineTo(tipPxX - prob * 22, surfAtTipY - frac * gapHeightPx);
    }
    ctx.closePath();
    ctx.fill();

    // 右上角波函數小圖例
    ctx.fillStyle = '#34d399';
    ctx.font = '10px monospace';
    ctx.fillText(`ψ(z) ∝ exp(-κz) | κ = ${kappa.toFixed(2)} Å⁻¹`, padL + 14, topY0 + 32);

    // ─── 下視圖：對數穿隧電流 I(x) 與回饋高度 z_tip(x) (y = 216 .. 346) ───
    const botY0 = 216;
    const botH = 126;
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(padL, botY0, plotW, botH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(padL, botY0, plotW, botH);

    // 對數座標網格線 (10^-3, 10^-1, 10^1, 10^3 nA)
    const logMin = -3;
    const logMax = 3;
    const logLevels = [-3, -1, 1, 3];
    ctx.font = '10px monospace';
    for (const lv of logLevels) {
      const frac = (lv - logMin) / (logMax - logMin);
      const gy = botY0 + botH - 14 - frac * (botH - 28);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(padL + plotW, gy);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      const label = lv >= 0 ? `10^${lv}` : `10^${lv}`;
      ctx.fillText(label, 8, gy + 3);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('穿隧電流 I(x) [nA, 對數尺度]', padL + 8, botY0 + 13);

    // 繪製對數穿隧電流曲線
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    scanProfile.points.forEach((pt, idx) => {
      const px = xToPx(pt.x);
      const logI = Math.max(logMin, Math.min(logMax, Math.log10(Math.max(1e-4, pt.currentNa))));
      const frac = (logI - logMin) / (logMax - logMin);
      const py = botY0 + botH - 14 - frac * (botH - 28);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // 若處於定電流回饋模式，疊加繪製壓電回饋高度曲線 Δz_tip(x)
    if (scanMode === 'constant_current') {
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      scanProfile.points.forEach((pt, idx) => {
        const px = xToPx(pt.x);
        const zNorm = Math.max(0, Math.min(1, (pt.zTip - baseDistance + 0.5) / 4.2));
        const py = botY0 + botH - 14 - zNorm * (botH - 28);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.fillText('壓電回饋針尖高度 z_tip(x) (描繪 LDOS 等高面)', padL + 210, botY0 + 13);
    }

    // 當前掃描垂直游標
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tipPxX, botY0);
    ctx.lineTo(tipPxX, botY0 + botH);
    ctx.stroke();

    const curLogI = Math.max(logMin, Math.min(logMax, Math.log10(Math.max(1e-4, currentMetrics.currentNa))));
    const curFrac = (curLogI - logMin) / (logMax - logMin);
    const curDotY = botY0 + botH - 14 - curFrac * (botH - 28);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(tipPxX, curDotY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 底部水平座標標籤
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.fillText('0 Å', padL, h - 3);
    ctx.fillText('50 Å (量子圍欄起始)', padL + plotW * 0.45, h - 3);
    ctx.fillText('100 Å', padL + plotW - 32, h - 3);
  }, [scanProfile, scanMode, tipX, kappa, baseDistance, currentMetrics]);

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* 頂部標題與控制按鈕 */}
      <div className="flex flex-col gap-3 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-100">
              STM 量子穿隧與量子圍欄局部電子態密度模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            即時求解真空位壘指數衰減 I ∝ V · ρ<sub>s</sub>(E<sub>F</sub>) · exp(-2κd)，觀察單原子台階與量子圍欄駐波
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsScanning(!isScanning)}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500 active:scale-95"
          >
            {isScanning ? '⏸ 暫停掃描' : '▶ 自動掃描'}
          </button>
          <button
            type="button"
            onClick={() => setScanMode(scanMode === 'constant_height' ? 'constant_current' : 'constant_height')}
            className="rounded-lg border border-emerald-500/60 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/60"
          >
            {scanMode === 'constant_height' ? '切換至定電流回饋模式' : '切換至定高掃描模式'}
          </button>
        </div>
      </div>

      {/* 模式切換選單 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setScanMode('constant_height')}
          className={`flex-1 min-w-[140px] rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            scanMode === 'constant_height'
              ? 'bg-sky-600 text-white'
              : 'border border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
          }`}
        >
          定高模式 (Constant Height)
        </button>
        <button
          type="button"
          onClick={() => setScanMode('constant_current')}
          className={`flex-1 min-w-[140px] rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            scanMode === 'constant_current'
              ? 'bg-emerald-600 text-white'
              : 'border border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
          }`}
        >
          定電流回饋模式 (Constant Current)
        </button>
      </div>

      {/* 雙視圖畫布 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          className="w-full h-auto block rounded-lg"
        />
      </div>

      {/* 即時物理量監控指標 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">穿隧電流 I(x)</div>
          <div className="mt-1 font-mono text-base font-bold text-sky-400">
            {currentMetrics.currentNa >= 10
              ? currentMetrics.currentNa.toFixed(1)
              : currentMetrics.currentNa >= 0.01
              ? currentMetrics.currentNa.toFixed(3)
              : currentMetrics.currentNa.toExponential(2)}{' '}
            nA
          </div>
          <div className="text-[10px] text-slate-500">
            {scanMode === 'constant_current' ? '壓電回饋鎖定定值' : '隨間距指數劇烈跳變'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">針尖局部間距 d</div>
          <div className="mt-1 font-mono text-base font-bold text-emerald-400">
            {currentMetrics.localGap.toFixed(2)} Å
          </div>
          <div className="text-[10px] text-slate-500">
            掃描位置 x = {tipX.toFixed(1)} Å
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">衰減常數 κ</div>
          <div className="mt-1 font-mono text-base font-bold text-amber-400">
            {kappa.toFixed(3)} Å<sup>-1</sup>
          </div>
          <div className="text-[10px] text-slate-500">
            Δd = 1 Å → 電流差 {currentMetrics.decadeFactor.toFixed(1)}×
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">相對態密度 LDOS</div>
          <div className="mt-1 font-mono text-base font-bold text-rose-300">
            {currentMetrics.ldos.toFixed(2)} ρ<sub>0</sub>
          </div>
          <div className="text-[10px] text-slate-500">
            針尖高度 z<sub>tip</sub> = {currentMetrics.zTip.toFixed(2)} Å
          </div>
        </div>
      </div>

      {/* 互動控制滑桿 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">基準針尖間距 d<sub>0</sub></span>
            <span className="font-mono font-bold text-emerald-400">{baseDistance.toFixed(1)} Å</span>
          </div>
          <input
            type="range"
            min={3.2}
            max={8.0}
            step={0.1}
            value={baseDistance}
            onChange={(e) => setBaseDistance(parseFloat(e.target.value))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>3.2 Å (強穿隧)</span>
            <span>8.0 Å (微弱指數尾)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">表面功函數 φ</span>
            <span className="font-mono font-bold text-amber-400">{workFunction.toFixed(1)} eV</span>
          </div>
          <input
            type="range"
            min={3.0}
            max={6.0}
            step={0.1}
            value={workFunction}
            onChange={(e) => setWorkFunction(parseFloat(e.target.value))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>3.0 eV (低位壘)</span>
            <span>6.0 eV (高局域性)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">手動定位針尖 x</span>
            <span className="font-mono font-bold text-sky-400">{tipX.toFixed(1)} Å</span>
          </div>
          <input
            type="range"
            min={4}
            max={96}
            step={0.5}
            value={tipX}
            onChange={(e) => {
              setIsScanning(false);
              setTipX(parseFloat(e.target.value));
            }}
            className="mt-2 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>台階 (22 Å)</span>
            <span>量子圍欄中心 (70 Å)</span>
          </div>
        </div>
      </div>

      {/* 物理解說 */}
      <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400 leading-relaxed">
        <strong className="text-slate-200">Tersoff–Hamann 成像本質：</strong>
        將模式切換為「定高模式」時，針尖跨過單原子台階與量子圍欄駐波會觸發跨數量級的電流劇震（對數座標一目了然）；切換至「定電流回饋模式」後，壓電陶瓷透過閉環伺服追蹤 exp(-2κd) 等值面，直接描繪出表面費米能級局部電子態密度（LDOS）的量子駐波地形。
      </div>
    </div>
  );
};
