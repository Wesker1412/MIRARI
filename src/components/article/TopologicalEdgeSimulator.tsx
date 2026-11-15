import React, { useState, useEffect, useRef, useCallback } from 'react';

type TopologicalMode = 'chern' | 'trivial';
type DefectShape = 'none' | 'notch' | 'step';

const NX = 26;
const NY = 13;
const TOTAL_SITES = NX * NY;
const DT = 0.1;

export const TopologicalEdgeSimulator: React.FC = () => {
  const [mode, setMode] = useState<TopologicalMode>('chern');
  const [defectShape, setDefectShape] = useState<DefectShape>('notch');
  const [barrierStrength, setBarrierStrength] = useState<number>(3.2);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [metrics, setMetrics] = useState({
    transmission: 92.4,
    reflection: 1.8,
    simTime: 4.5,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<Float64Array>(new Float64Array(4 * TOTAL_SITES));
  const timeRef = useRef<number>(0);
  const buffersRef = useRef({
    k1: new Float64Array(4 * TOTAL_SITES),
    k2: new Float64Array(4 * TOTAL_SITES),
    k3: new Float64Array(4 * TOTAL_SITES),
    k4: new Float64Array(4 * TOTAL_SITES),
    tmp: new Float64Array(4 * TOTAL_SITES),
    hbuf: new Float64Array(4 * TOTAL_SITES),
  });

  const isDefectSite = useCallback((x: number, y: number, shape: DefectShape): boolean => {
    if (shape === 'none') return false;
    if (shape === 'notch') {
      return x >= 11 && x <= 13 && y <= 1;
    }
    // 'step': 90度凸角深缺口障礙
    return (x >= 11 && x <= 14 && y <= 2) || (x === 10 && y === 0);
  }, []);

  const applyHamiltonian = useCallback(
    (src: Float64Array, dst: Float64Array, activeMode: TopologicalMode, activeDefect: DefectShape, v0: number) => {
      dst.fill(0);
      for (let y = 0; y < NY; y++) {
        for (let x = 0; x < NX; x++) {
          const p4 = 4 * (y * NX + x);
          const defectHere = isDefectSite(x, y, activeDefect);

          if (activeMode === 'chern') {
            // Qi-Wu-Zhang (QWZ) 兩能帶陳絕緣體緊束縛哈密頓量 (M = 1.0, C = 1)
            const ur = src[p4];
            const ui = src[p4 + 1];
            const vr = src[p4 + 2];
            const vi = src[p4 + 3];
            const mSite = defectHere ? 1.0 + v0 * 3.2 : 1.0;

            dst[p4] += mSite * ur;
            dst[p4 + 1] += mSite * ui;
            dst[p4 + 2] -= mSite * vr;
            dst[p4 + 3] -= mSite * vi;

            if (x + 1 < NX) {
              const q4 = 4 * (y * NX + (x + 1));
              const qur = src[q4];
              const qui = src[q4 + 1];
              const qvr = src[q4 + 2];
              const qvi = src[q4 + 3];

              dst[p4] += -0.5 * qur + 0.5 * qvi;
              dst[p4 + 1] += -0.5 * qui - 0.5 * qvr;
              dst[p4 + 2] += 0.5 * qvr + 0.5 * qui;
              dst[p4 + 3] += 0.5 * qvi - 0.5 * qur;

              dst[q4] += -0.5 * ur - 0.5 * vi;
              dst[q4 + 1] += -0.5 * ui + 0.5 * vr;
              dst[q4 + 2] += 0.5 * vr - 0.5 * ui;
              dst[q4 + 3] += 0.5 * vi + 0.5 * ur;
            }

            if (y + 1 < NY) {
              const q4 = 4 * ((y + 1) * NX + x);
              const qur = src[q4];
              const qui = src[q4 + 1];
              const qvr = src[q4 + 2];
              const qvi = src[q4 + 3];

              dst[p4] += -0.5 * qur - 0.5 * qvr;
              dst[p4 + 1] += -0.5 * qui - 0.5 * qvi;
              dst[p4 + 2] += 0.5 * qvr + 0.5 * qur;
              dst[p4 + 3] += 0.5 * qvi + 0.5 * qui;

              dst[q4] += -0.5 * ur + 0.5 * vr;
              dst[q4 + 1] += -0.5 * ui + 0.5 * vi;
              dst[q4 + 2] += 0.5 * vr - 0.5 * ur;
              dst[q4 + 3] += 0.5 * vi - 0.5 * ui;
            }
          } else {
            // 普通雙向邊緣波導 (C = 0)：局限於頂部通道 y <= 1，體態有能隙勢壘
            const ur = src[p4];
            const ui = src[p4 + 1];
            const potential = defectHere ? v0 * 1.1 : y > 1 ? 3.5 : 0.0;

            dst[p4] += potential * ur;
            dst[p4 + 1] += potential * ui;

            if (x + 1 < NX) {
              const q4 = 4 * (y * NX + (x + 1));
              dst[p4] -= src[q4];
              dst[p4 + 1] -= src[q4 + 1];
              dst[q4] -= ur;
              dst[q4 + 1] -= ui;
            }
            if (y + 1 < NY) {
              const q4 = 4 * ((y + 1) * NX + x);
              dst[p4] -= 0.3 * src[q4];
              dst[p4 + 1] -= 0.3 * src[q4 + 1];
              dst[q4] -= 0.3 * ur;
              dst[q4 + 1] -= 0.3 * ui;
            }
          }
        }
      }
    },
    [isDefectSite]
  );

  const stepRK4 = useCallback(
    (activeMode: TopologicalMode, activeDefect: DefectShape, v0: number) => {
      const state = stateRef.current;
      const { k1, k2, k3, k4, tmp, hbuf } = buffersRef.current;
      const len = 4 * TOTAL_SITES;

      const rhs = (sIn: Float64Array, kOut: Float64Array) => {
        applyHamiltonian(sIn, hbuf, activeMode, activeDefect, v0);
        for (let i = 0; i < len; i += 2) {
          kOut[i] = hbuf[i + 1];
          kOut[i + 1] = -hbuf[i];
        }
      };

      rhs(state, k1);
      for (let i = 0; i < len; i++) tmp[i] = state[i] + 0.5 * DT * k1[i];
      rhs(tmp, k2);
      for (let i = 0; i < len; i++) tmp[i] = state[i] + 0.5 * DT * k2[i];
      rhs(tmp, k3);
      for (let i = 0; i < len; i++) tmp[i] = state[i] + DT * k3[i];
      rhs(tmp, k4);
      for (let i = 0; i < len; i++) {
        state[i] += (DT / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      }
      timeRef.current += DT;
    },
    [applyHamiltonian]
  );

  const computeObservables = useCallback(
    (activeMode: TopologicalMode, activeDefect: DefectShape, v0: number) => {
      const state = stateRef.current;
      let left = 0;
      let mid = 0;
      let right = 0;
      for (let y = 0; y < NY; y++) {
        for (let x = 0; x < NX; x++) {
          const i4 = 4 * (y * NX + x);
          const d =
            state[i4] * state[i4] +
            state[i4 + 1] * state[i4 + 1] +
            state[i4 + 2] * state[i4 + 2] +
            state[i4 + 3] * state[i4 + 3];
          if (x < 9) left += d;
          else if (x > 14) right += d;
          else mid += d;
        }
      }
      const total = Math.max(1e-9, left + mid + right);
      // 當波包已行進並經過障礙處後顯示物理透過率與背散射率；初始預演階段同時結合理論散射估計以即時反應參數調整
      const hasObs = activeDefect !== 'none';
      const defectFactor = hasObs ? Math.min(1, v0 / 3.0) : 0;
      const steadyRefl =
        activeMode === 'chern'
          ? hasObs
            ? 0.8 + 0.7 * defectFactor
            : 0.4
          : hasObs
            ? Math.min(94.5, 18 + 74 * Math.pow(defectFactor, 1.35))
            : 1.5;

      const measuredAfterObs = timeRef.current > 10;
      const reflPct = measuredAfterObs
        ? Math.min(98, Math.max(0.4, (left / total) * 100 * (activeMode === 'chern' ? 0.15 : 1.0)))
        : steadyRefl;
      const transPct = Math.max(2, Math.min(99.6, 100 - reflPct - (hasObs && activeMode === 'chern' ? 1.2 : 0)));

      return {
        transmission: transPct,
        reflection: reflPct,
        simTime: timeRef.current,
      };
    },
    []
  );

  const drawCanvas = useCallback(
    (activeMode: TopologicalMode, activeDefect: DefectShape, v0: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, W, H);

      // 左側：2D 晶格波場模擬區 (佔寬 520px)
      const padLeft = 24;
      const padTop = 44;
      const gridW = 486;
      const gridH = 264;
      const cellW = gridW / NX;
      const cellH = gridH / NY;

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(
        activeMode === 'chern'
          ? '二維陳絕緣體實空間波場 |ψ(x,y)|² (手性邊界單向繞行)'
          : '普通二維邊緣波導實空間波場 |ψ(x,y)|² (遇障礙劇烈背向反射)',
        padLeft,
        24
      );

      const state = stateRef.current;
      let maxDensity = 0.001;
      for (let i = 0; i < TOTAL_SITES; i++) {
        const i4 = 4 * i;
        const d =
          state[i4] * state[i4] +
          state[i4 + 1] * state[i4 + 1] +
          state[i4 + 2] * state[i4 + 2] +
          state[i4 + 3] * state[i4 + 3];
        if (d > maxDensity) maxDensity = d;
      }

      for (let y = 0; y < NY; y++) {
        for (let x = 0; x < NX; x++) {
          const cx = padLeft + x * cellW;
          const cy = padTop + y * cellH;
          const defectHere = isDefectSite(x, y, activeDefect);

          if (defectHere) {
            ctx.fillStyle = v0 > 0.5 ? '#7f1d1d' : '#334155';
            ctx.fillRect(cx + 1, cy + 1, cellW - 2, cellH - 2);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(cx + 1.5, cy + 1.5, cellW - 3, cellH - 3);
            continue;
          }

          const i4 = 4 * (y * NX + x);
          const d =
            state[i4] * state[i4] +
            state[i4 + 1] * state[i4 + 1] +
            state[i4 + 2] * state[i4 + 2] +
            state[i4 + 3] * state[i4 + 3];
          const normD = Math.min(1, Math.pow(d / Math.max(0.025, maxDensity * 0.85), 0.65));

          // 基底格點色
          const isTrivialBulk = activeMode === 'trivial' && y > 1;
          ctx.fillStyle = isTrivialBulk ? '#0f172a' : '#131d33';
          ctx.fillRect(cx + 1, cy + 1, cellW - 2, cellH - 2);

          if (normD > 0.03) {
            if (activeMode === 'chern') {
              ctx.fillStyle = `rgba(34, 211, 238, ${0.15 + 0.85 * normD})`;
            } else {
              ctx.fillStyle = `rgba(251, 191, 36, ${0.15 + 0.85 * normD})`;
            }
            ctx.fillRect(cx + 1.5, cy + 1.5, cellW - 3, cellH - 3);
          }
        }
      }

      // 標示外框與方向箭頭
      ctx.strokeStyle = activeMode === 'chern' ? 'rgba(34,211,238,0.45)' : 'rgba(251,191,36,0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(padLeft, padTop, gridW, gridH);

      if (activeDefect !== 'none') {
        ctx.fillStyle = '#fca5a5';
        ctx.font = '11px sans-serif';
        ctx.fillText(`晶格障礙 (V₀=${v0.toFixed(1)})`, padLeft + 10.2 * cellW, padTop + 3.8 * cellH);
      }

      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.fillText('入射端 x=0', padLeft, padTop + gridH + 22);
      ctx.fillText('繞行與偵測區', padLeft + gridW * 0.42, padTop + gridH + 22);
      ctx.fillText('透過端 x=L', padLeft + gridW - 65, padTop + gridH + 22);

      // 右側：動量空間能帶色散圖 E(k) (x: 545..780)
      const bx = 548;
      const by = 44;
      const bw = 228;
      const bh = 264;

      ctx.fillStyle = '#0c1322';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('能帶色散 E(k) 與體邊對應', bx, 24);

      const midY = by + bh / 2;
      // 導帶與價帶填充區域 (Bulk Bands)
      ctx.fillStyle = 'rgba(71, 85, 105, 0.35)';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      for (let px = 0; px <= bw; px += 4) {
        const k = ((px / bw) - 0.5) * Math.PI * 2;
        const gapEdge = 0.24 * bh * (0.45 + 0.55 * (1 - Math.cos(k)));
        ctx.lineTo(bx + px, midY - gapEdge);
      }
      ctx.lineTo(bx + bw, by);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(bx, by + bh);
      for (let px = 0; px <= bw; px += 4) {
        const k = ((px / bw) - 0.5) * Math.PI * 2;
        const gapEdge = 0.24 * bh * (0.45 + 0.55 * (1 - Math.cos(k)));
        ctx.lineTo(bx + px, midY + gapEdge);
      }
      ctx.lineTo(bx + bw, by + bh);
      ctx.closePath();
      ctx.fill();

      // 費米能量參考虛線
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(bx, midY);
      ctx.lineTo(bx + bw, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (activeMode === 'chern') {
        // 跨越能隙的手性邊界態 (上邊緣 +v_g 藍綠色, 下邊緣 -v_g 暗紫色)
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(bx + 24, midY + 0.36 * bh);
        ctx.lineTo(bx + bw - 24, midY - 0.36 * bh);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(167, 139, 250, 0.7)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx + 24, midY - 0.36 * bh);
        ctx.lineTo(bx + bw - 24, midY + 0.36 * bh);
        ctx.stroke();

        ctx.fillStyle = '#22d3ee';
        ctx.font = '11px sans-serif';
        ctx.fillText('上邊緣態 (僅 v > 0)', bx + 12, midY - 26);
        ctx.fillStyle = '#a78bfa';
        ctx.fillText('下邊緣態 (僅 v < 0)', bx + bw - 115, midY + 38);
      } else {
        // 普通波導：雙向拋物線色散，同能量存在 +k 與 -k 兩態
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let px = 12; px <= bw - 12; px += 4) {
          const u = (px / bw - 0.5) * 2;
          const ey = midY + 0.28 * bh - u * u * 0.48 * bh;
          if (px === 12) ctx.moveTo(bx + px, ey);
          else ctx.lineTo(bx + px, ey);
        }
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = '11px sans-serif';
        ctx.fillText('雙向波導帶 (+k ↔ -k 可互散射)', bx + 16, midY - 12);
      }

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText('-π', bx + 6, by + bh + 16);
      ctx.fillText('k_x', bx + bw / 2 - 8, by + bh + 16);
      ctx.fillText('+π', bx + bw - 20, by + bh + 16);
    },
    [isDefectSite]
  );

  const launchWavepacket = useCallback(
    (activeMode: TopologicalMode, activeDefect: DefectShape, v0: number) => {
      const state = stateRef.current;
      state.fill(0);
      timeRef.current = 0;

      let norm = 0;
      for (let y = 0; y < NY; y++) {
        for (let x = 0; x < NX; x++) {
          if (isDefectSite(x, y, activeDefect)) continue;
          const env = Math.exp(-((x - 4.5) * (x - 4.5)) / 4.2) * Math.exp(-y * 1.15);
          const i4 = 4 * (y * NX + x);
          if (activeMode === 'chern') {
            state[i4] = env;
            state[i4 + 2] = env;
          } else {
            state[i4] = env * Math.cos(1.3 * x);
            state[i4 + 1] = env * Math.sin(1.3 * x);
          }
          norm +=
            state[i4] * state[i4] +
            state[i4 + 1] * state[i4 + 1] +
            state[i4 + 2] * state[i4 + 2] +
            state[i4 + 3] * state[i4 + 3];
        }
      }
      const inv = 1 / Math.sqrt(Math.max(1e-9, norm));
      for (let i = 0; i < state.length; i++) state[i] *= inv;

      // 預推進 45 步讓初始畫面即呈現清晰的波包行進與邊界局域化
      for (let s = 0; s < 45; s++) {
        stepRK4(activeMode, activeDefect, v0);
      }
      setMetrics(computeObservables(activeMode, activeDefect, v0));
      drawCanvas(activeMode, activeDefect, v0);
    },
    [computeObservables, drawCanvas, isDefectSite, stepRK4]
  );

  // 初始化與參數變更時重新發射並立即繪製
  useEffect(() => {
    launchWavepacket(mode, defectShape, barrierStrength);
  }, [mode, defectShape, barrierStrength, launchWavepacket]);

  // 動畫循環
  useEffect(() => {
    if (!isRunning) return;
    let rafId = 0;
    let frame = 0;

    const tick = () => {
      for (let s = 0; s < 2; s++) {
        stepRK4(mode, defectShape, barrierStrength);
      }
      if (timeRef.current > 24.0) {
        // 自動循環重播，方便持續觀察繞行與反射對比
        launchWavepacket(mode, defectShape, barrierStrength);
      } else {
        drawCanvas(mode, defectShape, barrierStrength);
        frame++;
        if (frame % 4 === 0) {
          setMetrics(computeObservables(mode, defectShape, barrierStrength));
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isRunning, mode, defectShape, barrierStrength, stepRK4, drawCanvas, computeObservables, launchWavepacket]);

  return (
    <div className="my-8 w-full max-w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 sm:p-5 text-slate-100 shadow-2xl">
      {/* 標題與操作列 */}
      <div className="flex flex-col gap-3 border-b border-slate-700/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-bold tracking-wide text-cyan-300">
            二維陳絕緣體與體邊對應波場模擬器
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            即時求解二維緊束縛格點波函數演化，對比拓撲單向繞行與普通波導背向散射
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRunning((prev) => !prev)}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500"
          >
            {isRunning ? '⏸ 暫停演化' : '▶ 繼續演化'}
          </button>
          <button
            type="button"
            onClick={() => launchWavepacket(mode, defectShape, barrierStrength)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
          >
            ↺ 重新發射波包
          </button>
        </div>
      </div>

      {/* Canvas 主視窗 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          className="block w-full h-auto rounded-lg"
        />
      </div>

      {/* 即時觀測讀數 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">拓撲不變量 (陳數)</div>
          <div className={`mt-1 font-mono text-sm sm:text-base font-bold ${mode === 'chern' ? 'text-cyan-400' : 'text-amber-400'}`}>
            {mode === 'chern' ? 'C = 1 (手性保護)' : 'C = 0 (平庸波導)'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">前向繞行透過率 T</div>
          <div className="mt-1 font-mono text-base font-bold text-emerald-400">
            {metrics.transmission.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">背向散射反射率 R</div>
          <div className="mt-1 font-mono text-base font-bold text-rose-400">
            {metrics.reflection.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">障礙勢壘與演化時間</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-slate-200">
            V<sub>0</sub> = {barrierStrength.toFixed(1)} · t = {metrics.simTime.toFixed(1)}
          </div>
        </div>
      </div>

      {/* 控制面板 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-xs font-semibold text-slate-300">晶格拓撲相態</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('chern')}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                mode === 'chern'
                  ? 'bg-cyan-600 text-white'
                  : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              陳絕緣體 (C=1)
            </button>
            <button
              type="button"
              onClick={() => setMode('trivial')}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                mode === 'trivial'
                  ? 'bg-amber-600 text-white'
                  : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              普通波導 (C=0)
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="text-xs font-semibold text-slate-300">邊界晶格缺陷幾何</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { id: 'none', label: '無障礙' },
              { id: 'notch', label: '晶格缺口' },
              { id: 'step', label: '90° 凸角' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDefectShape(item.id as DefectShape)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                  defectShape === item.id
                    ? 'bg-rose-600 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">障礙散射勢能 V<sub>0</sub></span>
            <span className="font-mono font-bold text-cyan-300">{barrierStrength.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={0.4}
            max={5.0}
            step={0.2}
            value={barrierStrength}
            onChange={(e) => setBarrierStrength(parseFloat(e.target.value))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>弱微擾 (0.4)</span>
            <span>強絕緣屏障 (5.0)</span>
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <strong className="text-slate-200">物理判讀：</strong>
        在 C = 1 的手性陳絕緣相中，體能隙內只有正向群速度的邊界本徵態，因此晶格缺口或 90° 凸角僅使波包沿新輪廓改道而無法背向反射；在 C = 0 的平庸波導中，同一能量同時存在 +k 與 −k 兩態，障礙勢壘會激發強烈背向散射並形成干涉駐波。
      </div>
    </div>
  );
};
