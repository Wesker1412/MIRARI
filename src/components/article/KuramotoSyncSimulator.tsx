import React, { useState, useEffect, useRef, useMemo } from 'react';

const N_OSC = 60;

// 預先產生對稱洛倫茲 (Cauchy-Lorentz) 基準固有頻率分位數，避免極端尾部過大導致積分步長不穩
const BASE_FREQUENCIES: number[] = Array.from({ length: N_OSC }, (_, i) => {
  const u = 0.04 + ((i + 0.5) / N_OSC) * 0.92;
  return Math.tan(Math.PI * (u - 0.5));
});

function computeOrderParameter(thetas: Float64Array): { r: number; psi: number } {
  let sumCos = 0;
  let sumSin = 0;
  for (let i = 0; i < N_OSC; i++) {
    sumCos += Math.cos(thetas[i]);
    sumSin += Math.sin(thetas[i]);
  }
  const cx = sumCos / N_OSC;
  const sy = sumSin / N_OSC;
  return {
    r: Math.hypot(cx, sy),
    psi: Math.atan2(sy, cx),
  };
}

export const KuramotoSyncSimulator: React.FC = () => {
  const [couplingK, setCouplingK] = useState<number>(1.8); // 耦合強度 K (0..4.0)
  const [gamma, setGamma] = useState<number>(0.65); // 固有頻率半高寬分散度 γ (0.2..1.5)
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [orderR, setOrderR] = useState<number>(0.55);
  const [lockedCount, setLockedCount] = useState<number>(36);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const thetasRef = useRef<Float64Array>(
    Float64Array.from({ length: N_OSC }, (_, i) => (i * 2.39996) % (Math.PI * 2))
  );
  const rHistoryRef = useRef<number[]>([0.15]);

  // 理論臨界耦合強度 Kc = 2 / (π * g(0)) = 2 * γ (洛倫茲分佈精確結果)
  const kcTheory = useMemo(() => 2 * gamma, [gamma]);
  const rTheory = useMemo(() => {
    if (couplingK <= kcTheory) return 0;
    return Math.sqrt(1 - kcTheory / couplingK);
  }, [couplingK, kcTheory]);

  const scramblePhases = () => {
    const arr = thetasRef.current;
    for (let i = 0; i < N_OSC; i++) {
      arr[i] = Math.random() * Math.PI * 2;
    }
    const { r } = computeOrderParameter(arr);
    rHistoryRef.current = [r];
    setOrderR(r);
  };

  // 四階龍格-庫塔 (RK4) 即時積分與雙面板繪製
  useEffect(() => {
    let rafId = 0;
    const k1 = new Float64Array(N_OSC);
    const k2 = new Float64Array(N_OSC);
    const k3 = new Float64Array(N_OSC);
    const k4 = new Float64Array(N_OSC);
    const tmp = new Float64Array(N_OSC);

    const evalDerivative = (state: Float64Array, out: Float64Array) => {
      const { r, psi } = computeOrderParameter(state);
      for (let i = 0; i < N_OSC; i++) {
        const omega = BASE_FREQUENCIES[i] * gamma;
        out[i] = omega + couplingK * r * Math.sin(psi - state[i]);
      }
    };

    const stepRk4 = (dt: number) => {
      const y = thetasRef.current;
      evalDerivative(y, k1);
      for (let i = 0; i < N_OSC; i++) tmp[i] = y[i] + 0.5 * dt * k1[i];
      evalDerivative(tmp, k2);
      for (let i = 0; i < N_OSC; i++) tmp[i] = y[i] + 0.5 * dt * k2[i];
      evalDerivative(tmp, k3);
      for (let i = 0; i < N_OSC; i++) tmp[i] = y[i] + dt * k3[i];
      evalDerivative(tmp, k4);

      for (let i = 0; i < N_OSC; i++) {
        y[i] = (y[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) % (Math.PI * 2);
        if (y[i] < 0) y[i] += Math.PI * 2;
      }
    };

    const drawCanvas = (r: number, psi: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, w, h);

      // ─── 左側面板：單位圓上 60 個振盪子相位與序參量質心向量 (x = 16..356) ───
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(16, 16, 340, 328);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(16, 16, 340, 328);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('單位圓相空間 (N = 60 耦合振盪子)', 28, 36);

      const cx = 186;
      const cy = 188;
      const radius = 112;

      // 背景參考十字線與單位圓
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - radius - 14, cy);
      ctx.lineTo(cx + radius + 14, cy);
      ctx.moveTo(cx, cy - radius - 14);
      ctx.lineTo(cx, cy + radius + 14);
      ctx.stroke();

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 繪製各個振盪子 (依固有頻率上色：慢藍 → 中綠 → 快橙紅)
      const thetas = thetasRef.current;
      for (let i = 0; i < N_OSC; i++) {
        const theta = thetas[i];
        const ox = cx + radius * Math.cos(theta);
        const oy = cy - radius * Math.sin(theta);
        const omega = BASE_FREQUENCIES[i] * gamma;
        const isLocked = Math.abs(omega) <= couplingK * r;

        // 色相映射
        const normIdx = i / (N_OSC - 1);
        const hue = 210 - normIdx * 195; // 210 (藍) -> 15 (橘紅)
        ctx.fillStyle = `hsl(${hue}, ${isLocked ? 90 : 55}%, ${isLocked ? 62 : 45}%)`;
        ctx.beginPath();
        ctx.arc(ox, oy, isLocked ? 5.2 : 3.8, 0, Math.PI * 2);
        ctx.fill();

        if (isLocked) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 繪製複序參量質心向量 r * exp(iψ)
      const vecX = cx + r * radius * Math.cos(psi);
      const vecY = cy - r * radius * Math.sin(psi);
      ctx.strokeStyle = r > 0.35 ? '#34d399' : '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(vecX, vecY);
      ctx.stroke();

      // 質心端點發光球
      ctx.fillStyle = r > 0.35 ? '#34d399' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(vecX, vecY, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`r(t) = ${r.toFixed(3)}   ψ = ${((psi * 180) / Math.PI).toFixed(0)}°`, 28, 330);

      // ─── 右側面板上：序參量時間演化 r(t) (x = 376..784, y = 16..170) ───
      const rX = 376;
      const rW = 408;
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(rX, 16, rW, 154);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(rX, 16, rW, 154);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('序參量時間演化 r(t)', rX + 14, 34);

      const tL = rX + 42;
      const tR = rX + rW - 18;
      const tT = 46;
      const tB = 152;
      const tW = tR - tL;
      const tH = tB - tT;

      // 網格與軸
      [0, 0.5, 1.0].forEach((val) => {
        const py = tB - val * tH;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.beginPath();
        ctx.moveTo(tL, py);
        ctx.lineTo(tR, py);
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = '9px monospace';
        ctx.fillText(val.toFixed(1), rX + 14, py + 3);
      });

      // 理論穩態線 r_theory
      if (rTheory > 0) {
        const thY = tB - rTheory * tH;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(tL, thY);
        ctx.lineTo(tR, thY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // r(t) 歷史軌跡
      const hist = rHistoryRef.current;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < hist.length; i++) {
        const px = tL + (i / Math.max(1, 179)) * tW;
        const py = tB - Math.min(1, Math.max(0, hist[i])) * tH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // ─── 右側面板下：理論臨界分岔曲線 r(K) (x = 376..784, y = 184..344) ───
      const bY = 184;
      const bH_box = 160;
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(rX, bY, rW, bH_box);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(rX, bY, rW, bH_box);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('二階動態同步相變分岔曲線 r(K)', rX + 14, bY + 18);

      const cL = rX + 42;
      const cR = rX + rW - 18;
      const cT = bY + 32;
      const cB = bY + bH_box - 24;
      const cW = cR - cL;
      const cH = cB - cT;
      const kMaxAxis = 4.0;

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cL, cT);
      ctx.lineTo(cL, cB);
      ctx.lineTo(cR, cB);
      ctx.stroke();

      // 臨界點 Kc = 2γ 垂直線
      if (kcTheory <= kMaxAxis) {
        const kcX = cL + (kcTheory / kMaxAxis) * cW;
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(kcX, cT);
        ctx.lineTo(kcX, cB);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#fb7185';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`Kc=${kcTheory.toFixed(2)}`, Math.min(cR - 55, kcX + 4), cT + 12);
      }

      // 理論超臨界分岔曲線 r = sqrt(1 - Kc / K)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let px = 0; px <= cW; px++) {
        const kVal = (px / cW) * kMaxAxis;
        const rVal = kVal > kcTheory ? Math.sqrt(1 - kcTheory / kVal) : 0;
        const py = cB - rVal * cH;
        if (px === 0) ctx.moveTo(cL + px, py);
        else ctx.lineTo(cL + px, py);
      }
      ctx.stroke();

      // 當前實測點 (K, r)
      const curKX = cL + Math.min(1, couplingK / kMaxAxis) * cW;
      const curRY = cB - Math.min(1, Math.max(0, r)) * cH;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(curKX, curRY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText('0', cL, cB + 14);
      ctx.fillText('2.0', cL + cW * 0.48, cB + 14);
      ctx.fillText('K = 4.0', cR - 36, cB + 14);
    };

    let frameCounter = 0;
    const loop = () => {
      if (isRunning) {
        stepRk4(0.015);
        stepRk4(0.015);
      }
      const { r, psi } = computeOrderParameter(thetasRef.current);

      if (isRunning) {
        rHistoryRef.current.push(r);
        if (rHistoryRef.current.length > 180) {
          rHistoryRef.current.shift();
        }
      }

      // 每 4 幀同步一次 React 文字指標以維持流暢度
      if (frameCounter % 4 === 0) {
        setOrderR(r);
        let locked = 0;
        for (let i = 0; i < N_OSC; i++) {
          if (Math.abs(BASE_FREQUENCIES[i] * gamma) <= couplingK * r) {
            locked++;
          }
        }
        setLockedCount(locked);
      }
      frameCounter++;

      drawCanvas(r, psi);

      if (isRunning) {
        rafId = requestAnimationFrame(loop);
      }
    };

    loop();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [couplingK, gamma, isRunning, kcTheory, rTheory]);

  const phaseStatus =
    couplingK < kcTheory * 0.95
      ? { text: '亞臨界非相干態 (各自漂移)', cls: 'text-slate-400' }
      : couplingK <= kcTheory * 1.15
      ? { text: '臨界相變起振點 (K ≈ K_c)', cls: 'text-amber-400' }
      : { text: '超臨界集體同步鎖相態', cls: 'text-emerald-400' };

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* 標題與控制按鈕 */}
      <div className="flex flex-col gap-3 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-100">
              Kuramoto 耦合振盪子與非平衡同步相變模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            即時 RK4 積分 N = 60 振盪子微分方程 θ̇<sub>i</sub> = ω<sub>i</sub> + (K/N) Σ sin(θ<sub>j</sub> - θ<sub>i</sub>)，見證臨界閾值 K<sub>c</sub> = 2γ 之二階相變
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500 active:scale-95"
          >
            {isRunning ? '⏸ 暫停積分' : '▶ 繼續積分'}
          </button>
          <button
            type="button"
            onClick={scramblePhases}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            🔀 隨機重置相位
          </button>
        </div>
      </div>

      {/* 快捷相態按鈕 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setGamma(0.65);
            setCouplingK(0.6);
          }}
          className="flex-1 min-w-[110px] rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
        >
          亞臨界混亂 (K &lt; K<sub>c</sub>)
        </button>
        <button
          type="button"
          onClick={() => {
            setGamma(0.65);
            setCouplingK(1.35);
          }}
          className="flex-1 min-w-[110px] rounded-lg border border-amber-600/50 bg-amber-950/30 px-2.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-900/40"
        >
          臨界相變點 (K ≈ K<sub>c</sub>)
        </button>
        <button
          type="button"
          onClick={() => {
            setGamma(0.65);
            setCouplingK(2.6);
          }}
          className="flex-1 min-w-[110px] rounded-lg border border-emerald-600/50 bg-emerald-950/30 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/40"
        >
          強同步鎖相 (K &gt; K<sub>c</sub>)
        </button>
      </div>

      {/* 雙面板畫布 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          className="w-full h-auto block rounded-lg"
        />
      </div>

      {/* 物理量實時儀表板 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">實測序參量 r(t)</div>
          <div className="mt-1 font-mono text-base font-bold text-emerald-400">
            {orderR.toFixed(3)}
          </div>
          <div className="text-[10px] text-slate-500">
            無限極限理論 r<sub>∞</sub> ≈ {rTheory.toFixed(3)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">臨界耦合閾值 K<sub>c</sub></div>
          <div className="mt-1 font-mono text-base font-bold text-rose-300">
            {kcTheory.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500">
            距離 ΔK = {(couplingK - kcTheory >= 0 ? '+' : '') + (couplingK - kcTheory).toFixed(2)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">鎖相捕獲振盪子</div>
          <div className="mt-1 font-mono text-base font-bold text-sky-400">
            {lockedCount} / {N_OSC}
          </div>
          <div className="text-[10px] text-slate-500">
            鎖相比例 {((lockedCount / N_OSC) * 100).toFixed(0)}% (|ω<sub>i</sub>| ≤ Kr)
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">集體動力學物相</div>
          <div className={`mt-1 text-xs font-bold leading-snug ${phaseStatus.cls}`}>
            {phaseStatus.text}
          </div>
          <div className="text-[10px] text-slate-500">
            K = {couplingK.toFixed(2)} | γ = {gamma.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 參數滑桿 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">全局耦合強度 K</span>
            <span className="font-mono font-bold text-amber-400">{couplingK.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={4.0}
            step={0.05}
            value={couplingK}
            onChange={(e) => setCouplingK(parseFloat(e.target.value))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.0 (無交互作用)</span>
            <span className="text-rose-400 font-semibold">K<sub>c</sub> = {kcTheory.toFixed(2)}</span>
            <span>4.0 (強牽引同步)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">固有頻率分散度 γ</span>
            <span className="font-mono font-bold text-sky-400">{gamma.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1.5}
            step={0.05}
            value={gamma}
            onChange={(e) => setGamma(parseFloat(e.target.value))}
            className="mt-2 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.20 (頻率整齊易同步)</span>
            <span>1.50 (高度異質難鎖相)</span>
          </div>
        </div>
      </div>

      {/* 數學物理機制說明 */}
      <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400 leading-relaxed">
        <strong className="text-slate-200">超臨界分岔與均值場自洽性：</strong>
        在臨界值 K<sub>c</sub> = 2γ 以下，振盪子各自以固有頻率分散漂移，質心向量 r 維持在接近零的有限尺度雜訊（~ N<sup>-1/2</sup>）。一旦耦合 K 越過 K<sub>c</sub>，中心頻率群體率先鎖相拉起平均場 r，進而反過來捕獲更多邊緣振盪子，展現如鐵磁體或超導體般 r ∝ √(K - K<sub>c</sub>) 的普適臨界標度律。
      </div>
    </div>
  );
};
