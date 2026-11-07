import React, { useState, useEffect, useRef } from 'react';

export const CarTCellKineticsSimulator: React.FC = () => {
  const [costimDomain, setCostimDomain] = useState<'cd28' | 'bb41'>('bb41');
  const [antigenDensity, setAntigenDensity] = useState<number>(3500); // molecules/cell (500 to 8000)
  const [etRatio, setEtRatio] = useState<number>(2.0); // Effector to Target ratio (0.5 to 5.0)

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Biological kinetics calculations
  // Activation threshold ~ 1000 molecules/cell. Below threshold, kinetic proofreading fails to trigger lysis.
  const isAboveThreshold = antigenDensity >= 1200;

  // CD28 gives rapid initial killing but accelerates exhaustion; 4-1BB gives sustained killing with low exhaustion
  const killRateMultiplier = costimDomain === 'cd28' ? 1.6 : 1.1;
  const exhaustionRate = costimDomain === 'cd28' ? 0.015 : 0.004;

  const [simMetrics, setSimMetrics] = useState({
    tumorCount: 100,
    carTCount: 50,
    exhaustionPercent: 0,
    lysisRatePerHour: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    let tumorCells = 100;
    let activeCarT = Math.round(50 * etRatio);
    let exhaustedCarT = 0;

    // Visual particles for animation
    const cells: {
      type: 'cart' | 'tumor';
      x: number;
      y: number;
      vx: number;
      vy: number;
      hp: number;
      engaged: boolean;
    }[] = [];

    // Add tumor cells
    for (let i = 0; i < 28; i++) {
      cells.push({
        type: 'tumor',
        x: Math.random() * 420 + 30,
        y: Math.random() * 220 + 30,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        hp: 1.0,
        engaged: false,
      });
    }

    // Add CAR-T cells
    const initialT = Math.min(22, Math.round(10 * etRatio));
    for (let i = 0; i < initialT; i++) {
      cells.push({
        type: 'cart',
        x: Math.random() * 420 + 30,
        y: Math.random() * 220 + 30,
        vx: (Math.random() - 0.5) * 1.8,
        vy: (Math.random() - 0.5) * 1.8,
        hp: 1.0,
        engaged: false,
      });
    }

    let frameCount = 0;

    const render = () => {
      if (!isRunning) return;
      frameCount++;

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, 480, 280);

      // Kinetics updates every ~30 frames
      if (frameCount % 30 === 0) {
        if (isAboveThreshold && tumorCells > 0 && activeCarT > 0) {
          const lysisThisStep = Math.min(tumorCells, Math.round(activeCarT * 0.08 * killRateMultiplier));
          tumorCells = Math.max(0, tumorCells - lysisThisStep);
          // Exhaustion accumulation
          const newlyExhausted = Math.round(activeCarT * exhaustionRate);
          exhaustedCarT += newlyExhausted;
          activeCarT = Math.max(0, activeCarT - newlyExhausted);
        }

        const exPct = activeCarT + exhaustedCarT > 0 ? (exhaustedCarT / (activeCarT + exhaustedCarT)) * 100 : 0;
        setSimMetrics({
          tumorCount: tumorCells,
          carTCount: activeCarT,
          exhaustionPercent: Math.round(exPct),
          lysisRatePerHour: isAboveThreshold ? Math.round(killRateMultiplier * etRatio * 18) : 0,
        });
      }

      // Draw and move cells
      cells.forEach((c) => {
        c.x += c.vx;
        c.y += c.vy;
        if (c.x < 20 || c.x > 460) c.vx *= -1;
        if (c.y < 20 || c.y > 260) c.vy *= -1;

        if (c.type === 'tumor') {
          // Tumor cell (large amber/rose with CD19 antigen spikes)
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
          ctx.fill();

          // CD19 antigen spikes around surface
          ctx.strokeStyle = '#fda4af';
          ctx.lineWidth = 1;
          const numSpikes = Math.min(10, Math.round((antigenDensity / 8000) * 10));
          for (let s = 0; s < numSpikes; s++) {
            const angle = (s * 2 * Math.PI) / numSpikes;
            const sx = c.x + Math.cos(angle) * 13;
            const sy = c.y + Math.sin(angle) * 13;
            ctx.beginPath();
            ctx.moveTo(c.x + Math.cos(angle) * 9, c.y + Math.sin(angle) * 9);
            ctx.lineTo(sx, sy);
            ctx.stroke();
          }
        } else {
          // CAR-T cell (cyan/purple with scFv receptor head)
          ctx.fillStyle = costimDomain === 'cd28' ? '#06b6d4' : '#a855f7';
          ctx.beginPath();
          ctx.arc(c.x, c.y, 6.5, 0, Math.PI * 2);
          ctx.fill();

          // Receptor hook
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x + c.vx * 3.5, c.y + c.vy * 3.5);
          ctx.stroke();
        }
      });

      // Threshold Warning on Canvas if below activation limit
      if (!isAboveThreshold) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fillRect(15, 15, 450, 36);
        ctx.strokeStyle = '#ef4444';
        ctx.strokeRect(15, 15, 450, 36);
        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('抗原逃逸風險：CD19 密度低於動態動能閾值 (~1200)，免疫突觸無法激發細胞溶解', 240, 37);
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      isRunning = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [costimDomain, antigenDensity, etRatio, isAboveThreshold, killRateMultiplier, exhaustionRate]);

  return (
    <div className="my-8 rounded-xl border border-slate-700 bg-slate-900/95 p-5 text-slate-100 shadow-2xl backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-wide text-rose-400">
            CAR-T 合成免疫受體動力學與抗原逃逸模擬器
          </h3>
          <p className="text-xs text-slate-400">
            scFv 抗原識別 → CD28 / 4-1BB 共刺激訊號 → 免疫突觸細胞溶解與耗竭動態
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCostimDomain('cd28')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              costimDomain === 'cd28'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            CD28 共刺激 (強爆發 / 易耗竭)
          </button>
          <button
            type="button"
            onClick={() => setCostimDomain('bb41')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              costimDomain === 'bb41'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            4-1BB 共刺激 (長效持久 / 低耗竭)
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
        <canvas
          ref={canvasRef}
          width={480}
          height={280}
          className="h-68 w-full rounded border border-slate-800 bg-slate-950"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">腫瘤細胞存活殘餘</div>
          <div className="mt-1 text-2xl font-mono font-bold text-rose-400">
            {simMetrics.tumorCount} <span className="text-xs font-normal text-slate-400">%</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {simMetrics.tumorCount === 0 ? '完全緩解 (CR)' : '腫瘤負荷殘存'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">活躍 CAR-T 細胞</div>
          <div className="mt-1 text-2xl font-mono font-bold text-cyan-400">
            {simMetrics.carTCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            體內擴增活性存活數
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">T 細胞耗竭指數</div>
          <div className="mt-1 text-2xl font-mono font-bold text-amber-400">
            {simMetrics.exhaustionPercent}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            PD-1 / TIM-3 表現比例
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">每小時溶解速率</div>
          <div className="mt-1 text-2xl font-mono font-bold text-emerald-400">
            {simMetrics.lysisRatePerHour} <span className="text-xs font-normal text-slate-400">細胞/hr</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            穿孔素與顆粒酶殺傷
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>靶抗原密度 (CD19 表面分子數):</span>
            <span className="font-mono text-rose-400 font-bold">{antigenDensity} 分子/細胞</span>
          </div>
          <input
            type="range"
            min={500}
            max={7500}
            step={250}
            value={antigenDensity}
            onChange={(e) => setAntigenDensity(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-rose-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            低於 1200 時引發抗原逃逸（Antigen Escape），T 細胞無法有效去極化放毒
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>效靶比 (E:T Ratio):</span>
            <span className="font-mono text-cyan-400 font-bold">{etRatio.toFixed(1)} : 1</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={4.0}
            step={0.5}
            value={etRatio}
            onChange={(e) => setEtRatio(parseFloat(e.target.value))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            CAR-T 與腫瘤細胞的接觸濃度比例，影響清除速度與細胞介質釋放風暴風險
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">合成生物學關鍵洞見：</span>
        CAR-T 細胞打破了天然 T 細胞對 MHC 分子呈遞的依賴，以單鏈抗體可變片段（scFv）直接鎖定腫瘤表面未經加工的完整蛋白（如 CD19）。
        共刺激訊號結構域的選擇深刻決定了細胞命運：
        <strong className="text-cyan-300">CD28 結構域</strong>以糖解作用主導，殺傷迅速但易提早耗竭；而
        <strong className="text-purple-300">4-1BB（CD137）結構域</strong>促進粒線體脂肪酸氧化，賦予細胞長達數年的記憶性體內存續，為患者建立持久防線。
      </div>
    </div>
  );
};
