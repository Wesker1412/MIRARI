import React, { useState, useEffect, useRef } from 'react';

const GRID_N = 72;

export const ChemicalOscillatorSimulator: React.FC = () => {
  const [stoichF, setStoichF] = useState<number>(1.35);
  const [diffusionD, setDiffusionD] = useState<number>(1.0);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simTick, setSimTick] = useState<number>(0);
  const [metrics, setMetrics] = useState<{
    peakU: number;
    meanV: number;
    excitedRatio: number;
  }>({ peakU: 0.85, meanV: 0.24, excitedRatio: 18.5 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uRef = useRef<Float32Array>(new Float32Array(GRID_N * GRID_N));
  const vRef = useRef<Float32Array>(new Float32Array(GRID_N * GRID_N));
  const uNextRef = useRef<Float32Array>(new Float32Array(GRID_N * GRID_N));
  const vNextRef = useRef<Float32Array>(new Float32Array(GRID_N * GRID_N));
  const phaseTrailRef = useRef<Array<{ u: number; v: number }>>([]);
  const timeSeriesRef = useRef<Array<{ u: number; v: number }>>([]);
  const odeStateRef = useRef<{ u: number; v: number }>({ u: 0.65, v: 0.18 });
  const animRef = useRef<number | null>(null);

  // Initialize broken planar wave that curls into a rotating spiral wave
  const initSpiralSeed = () => {
    const u = uRef.current;
    const v = vRef.current;
    for (let r = 0; r < GRID_N; r++) {
      for (let c = 0; c < GRID_N; c++) {
        const idx = r * GRID_N + c;
        u[idx] = 0.02;
        v[idx] = 0.02;
        // Broken wavefront along upper half to nucleate a spiral core near center
        if (r < GRID_N * 0.52) {
          if (c >= 30 && c <= 35) {
            u[idx] = 0.88;
          } else if (c >= 22 && c < 30) {
            v[idx] = 0.65;
          }
        }
      }
    }
    phaseTrailRef.current = [];
    timeSeriesRef.current = [];
    odeStateRef.current = { u: 0.65, v: 0.18 };
  };

  useEffect(() => {
    initSpiralSeed();
  }, []);

  // Step 2D reaction-diffusion & 0D Oregonator limit-cycle ODE
  const stepSimulation = (fParam: number, dParam: number) => {
    const u = uRef.current;
    const v = vRef.current;
    const uNext = uNextRef.current;
    const vNext = vNextRef.current;

    // Map stoichiometric parameter f (0.4..2.6) cleanly to Barkley/Oregonator excitability threshold b
    // Lower f -> self-oscillatory / higher excitability; Higher f -> excitable resting medium
    const eps = 0.022;
    const a = 0.78;
    const b = 0.015 + ((fParam - 0.4) / 2.2) * 0.075;
    const dt = 0.008;
    const diffCoeff = 0.18 * dParam;

    for (let r = 0; r < GRID_N; r++) {
      const rUp = r > 0 ? r - 1 : 0;
      const rDn = r < GRID_N - 1 ? r + 1 : GRID_N - 1;
      for (let c = 0; c < GRID_N; c++) {
        const cLt = c > 0 ? c - 1 : 0;
        const cRt = c < GRID_N - 1 ? c + 1 : GRID_N - 1;
        const idx = r * GRID_N + c;

        const uc = u[idx];
        const vc = v[idx];
        const lap =
          u[rUp * GRID_N + c] +
          u[rDn * GRID_N + c] +
          u[r * GRID_N + cLt] +
          u[r * GRID_N + cRt] -
          4 * uc;

        const uth = (vc + b) / a;
        const du = (uc * (1 - uc) * (uc - uth)) / eps + diffCoeff * lap * 12;
        const dv = uc - vc;

        uNext[idx] = Math.max(0, Math.min(1.05, uc + du * dt));
        vNext[idx] = Math.max(0, Math.min(1.05, vc + dv * dt));
      }
    }

    u.set(uNext);
    v.set(vNext);

    // Integrate 0D Oregonator homogeneous CSTR ODE for right-hand phase portrait & waveform
    let { u: ou, v: ov } = odeStateRef.current;
    const qOre = 0.004;
    const epsOre = 0.045;
    const dtOre = 0.0025;
    for (let s = 0; s < 5; s++) {
      const duOre = (ou * (1 - ou) - fParam * ov * ((ou - qOre) / (ou + qOre))) / epsOre;
      const dvOre = ou - ov;
      ou = Math.max(0.0045, Math.min(1.0, ou + duOre * dtOre));
      ov = Math.max(0.0045, Math.min(1.0, ov + dvOre * dtOre));
    }
    odeStateRef.current = { u: ou, v: ov };

    phaseTrailRef.current.push({ u: ou, v: ov });
    if (phaseTrailRef.current.length > 220) phaseTrailRef.current.shift();

    timeSeriesRef.current.push({ u: ou, v: ov });
    if (timeSeriesRef.current.length > 160) timeSeriesRef.current.shift();
  };

  // Animation loop
  useEffect(() => {
    if (!isRunning) return;
    let frame = 0;
    const loop = () => {
      stepSimulation(stoichF, diffusionD);
      stepSimulation(stoichF, diffusionD);
      frame++;
      if (frame % 4 === 0) {
        const u = uRef.current;
        const v = vRef.current;
        let maxU = 0;
        let sumV = 0;
        let activeCount = 0;
        for (let i = 0; i < u.length; i++) {
          if (u[i] > maxU) maxU = u[i];
          sumV += v[i];
          if (u[i] > 0.35) activeCount++;
        }
        setMetrics({
          peakU: maxU,
          meanV: sumV / u.length,
          excitedRatio: (activeCount / u.length) * 100,
        });
        setSimTick((t) => t + 1);
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isRunning, stoichF, diffusionD]);

  // Draw Dual Panels on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#060914';
    ctx.fillRect(0, 0, w, h);

    // --- Left Panel: 2D Excitable Reaction-Diffusion Petri Dish ---
    const dishX = 24;
    const dishY = 38;
    const dishSize = 300;
    const cellPx = dishSize / GRID_N;

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('2D 可激發介質螺旋波場（點擊培養皿可點燃波源）', dishX, 22);

    const u = uRef.current;
    const v = vRef.current;
    for (let r = 0; r < GRID_N; r++) {
      for (let c = 0; c < GRID_N; c++) {
        const idx = r * GRID_N + c;
        const uVal = Math.min(1, Math.max(0, u[idx]));
        const vVal = Math.min(1, Math.max(0, v[idx]));

        // Ferroin indicator palette: reduced red/crimson -> refractory indigo -> oxidized bright cyan-blue
        const red = Math.round(110 * (1 - uVal) * (1 - 0.5 * vVal) + 45 * uVal);
        const green = Math.round(18 * (1 - uVal) + 195 * uVal);
        const blue = Math.round(48 * (1 - uVal) + 125 * vVal * (1 - uVal) + 250 * uVal);

        ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        ctx.fillRect(dishX + c * cellPx, dishY + r * cellPx, cellPx + 0.5, cellPx + 0.5);
      }
    }

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(dishX, dishY, dishSize, dishSize);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('紅褐：還原休息態 (Ce³⁺)   亮藍：自催化氧化波前 (Ce⁴⁺)', dishX, dishY + dishSize + 16);

    // --- Right Top: Oregonator Phase Plane (u vs v) ---
    const pL = 385;
    const pR = 772;
    const pT = 38;
    const pB = 195;
    const pW = pR - pL;
    const pH = pB - pT;

    ctx.fillStyle = '#0b1222';
    ctx.fillRect(pL, pT, pW, pH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(pL, pT, pW, pH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Oregonator 相平面極限環 (u 活化劑 vs v 抑制劑)', pL, 22);

    // Draw u-nullcline & v-nullcline
    const mapU = (val: number) => pL + Math.min(1, Math.max(0, val)) * pW;
    const mapV = (val: number) => pB - Math.min(1, Math.max(0, val)) * pH;

    // v = u nullcline
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(mapU(0), mapV(0));
    ctx.lineTo(mapU(1), mapV(1));
    ctx.stroke();

    // u-nullcline: v = u(1-u)(u+q)/(f(u-q))
    const qOre = 0.004;
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.beginPath();
    let started = false;
    for (let uTest = 0.012; uTest <= 0.99; uTest += 0.015) {
      const vNull = (uTest * (1 - uTest) * (uTest + qOre)) / (stoichF * (uTest - qOre));
      if (vNull >= 0 && vNull <= 1.0) {
        const x = mapU(uTest);
        const y = mapV(vNull);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Limit cycle trajectory
    const trail = phaseTrailRef.current;
    if (trail.length > 1) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      trail.forEach((pt, i) => {
        const px = mapU(pt.u);
        const py = mapV(pt.v);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      const head = trail[trail.length - 1];
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(mapU(head.u), mapV(head.v), 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('u (HBrO₂)', pR - 62, pB - 6);
    ctx.fillText('v (Ce⁴⁺)', pL + 6, pT + 14);

    // --- Right Bottom: Time Series Ce4+ / Ce3+ Oscillation ---
    const tL = 385;
    const tR = 772;
    const tT = 228;
    const tB = 338;
    const tW = tR - tL;
    const tH = tB - tT;

    ctx.fillStyle = '#0b1222';
    ctx.fillRect(tL, tT, tW, tH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(tL, tT, tW, tH);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('時間振盪曲線：Ce⁴⁺ 催化態 / HBrO₂ 脈衝', tL, tT - 8);

    const series = timeSeriesRef.current;
    if (series.length > 1) {
      // u(t) pulse
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      series.forEach((pt, i) => {
        const px = tL + (i / 160) * tW;
        const py = tB - Math.min(1, pt.u) * (tH - 10) - 5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // v(t) Ce4+ sawtooth
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      series.forEach((pt, i) => {
        const px = tL + (i / 160) * tW;
        const py = tB - Math.min(1, pt.v) * (tH - 10) - 5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  }, [simTick, stoichF, diffusionD]);

  const handleDishClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const dishX = 24;
    const dishY = 38;
    const dishSize = 300;
    if (cx >= dishX && cx <= dishX + dishSize && cy >= dishY && cy <= dishY + dishSize) {
      const col = Math.floor(((cx - dishX) / dishSize) * GRID_N);
      const row = Math.floor(((cy - dishY) / dishSize) * GRID_N);
      const u = uRef.current;
      const v = vRef.current;
      for (let dr = -3; dr <= 3; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
          const rr = row + dr;
          const cc = col + dc;
          if (rr >= 0 && rr < GRID_N && cc >= 0 && cc < GRID_N && dr * dr + dc * dc <= 9) {
            u[rr * GRID_N + cc] = 0.92;
            v[rr * GRID_N + cc] = 0.05;
          }
        }
      }
      setSimTick((t) => t + 1);
    }
  };

  const triggerSingleSpot = () => {
    uRef.current.fill(0.02);
    vRef.current.fill(0.02);
    const mid = Math.floor(GRID_N / 2);
    for (let dr = -3; dr <= 3; dr++) {
      for (let dc = -3; dc <= 3; dc++) {
        if (dr * dr + dc * dc <= 9) {
          uRef.current[(mid + dr) * GRID_N + (mid + dc)] = 0.94;
        }
      }
    }
    setSimTick((t) => t + 1);
  };

  const regimeText =
    stoichF < 0.65
      ? '低 f 過飽和穩態（振盪漸停）'
      : stoichF <= 1.85
      ? '霍普夫極限環自振區（穩定螺旋波）'
      : '高 f 可激發介質（須外力點火）';

  return (
    <div className="my-8 w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90 p-3 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-100">
              BZ 化學振盪與二維可激發反應擴散模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            模擬 Oregonator 非線性自催化正回饋與延遲負回饋：極限環軌道與培養皿螺旋波演化
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 active:scale-95"
          >
            {isRunning ? '⏸ 暫停反應' : '▶ 繼續模擬'}
          </button>
          <button
            onClick={() => {
              initSpiralSeed();
              setSimTick((t) => t + 1);
            }}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            🌀 注入斷裂波前
          </button>
          <button
            onClick={triggerSingleSpot}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            💧 單點靶波
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="mt-4 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          onClick={handleDishClick}
          className="w-full h-auto block cursor-crosshair rounded-lg"
        />
      </div>

      {/* KPI Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">進料化學計量參數 f</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-rose-400">
            f = {stoichF.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500">{regimeText}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">擴散耦合係數 D<sub>u</sub></div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-sky-400">
            {diffusionD.toFixed(2)} ×
          </div>
          <div className="text-[10px] text-slate-500">決定波前傳播速率與螺旋螺距</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">活化波前覆蓋率</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-cyan-300">
            {metrics.excitedRatio.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500">波峰 u<sub>max</sub> = {metrics.peakU.toFixed(2)}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">平均抑制劑 Ce<sup>4+</sup></div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-amber-300">
            {(metrics.meanV * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500">高值代表處於不反應尾流區</div>
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">進料化學計量參數 f（控制極限環分岔）</span>
            <span className="font-mono font-bold text-rose-400">{stoichF.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.4}
            max={2.6}
            step={0.05}
            value={stoichF}
            onChange={(e) => setStoichF(parseFloat(e.target.value))}
            className="mt-2 w-full accent-rose-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.40 (過飽和)</span>
            <span className="text-sky-400 font-semibold">1.0–1.8 (典型振盪環)</span>
            <span>2.60 (高門檻可激發)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">空間擴散耦合強度 D<sub>u</sub></span>
            <span className="font-mono font-bold text-sky-400">{diffusionD.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1.8}
            step={0.05}
            value={diffusionD}
            onChange={(e) => setDiffusionD(parseFloat(e.target.value))}
            className="mt-2 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.20 (緩慢細密紋波)</span>
            <span>1.00 (標準液膜)</span>
            <span>1.80 (高速寬波長)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
