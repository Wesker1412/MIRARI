import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface Trajectory {
  id: number;
  color: string;
  history: number[]; // frequency at each generation
  status: 'active' | 'fixed' | 'lost';
}

export const NeutralDriftSimulator: React.FC = () => {
  const [popSize, setPopSize] = useState<number>(50); // Ne = 20 to 500 (2Ne alleles = 40 to 1000)
  const [initFreq, setInitFreq] = useState<number>(0.2); // p0: 0.01 to 0.8
  const [selectionS, setSelectionS] = useState<number>(0.0); // -0.05 to +0.05
  const [maxGenerations] = useState<number>(250);
  const [numTrajectories] = useState<number>(10);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentGen, setCurrentGen] = useState<number>(0);

  const [trajectories, setTrajectories] = useState<Trajectory[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Colors for lines
  const LINE_COLORS = [
    '#38bdf8', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6',
    '#06b6d4', '#eab308', '#84cc16', '#f43f5e', '#a855f7',
    '#64748b', '#14b8a6',
  ];

  // Theoretical Kimura Fixation Probability
  const theoreticalFixation = useMemo(() => {
    const twoN = 2 * popSize;
    if (Math.abs(selectionS) < 1e-5) {
      return initFreq; // Neutral: P_fix = p0
    }
    // Kimura formula: P_fix = (1 - exp(-2 * twoN * s * p0)) / (1 - exp(-2 * twoN * s))
    const numerator = 1 - Math.exp(-2 * twoN * selectionS * initFreq);
    const denominator = 1 - Math.exp(-2 * twoN * selectionS);
    if (Math.abs(denominator) < 1e-9) return initFreq;
    return Math.max(0, Math.min(1, numerator / denominator));
  }, [popSize, initFreq, selectionS]);

  // Theoretical Mean Fixation Time (Kimura 1968 for neutral allele)
  const theoreticalFixationTime = useMemo(() => {
    // For fixed neutral alleles: t_bar = -4 Ne * [ (1-p0)/p0 * ln(1-p0) ] -> for p0 << 1, t_bar ~ 4 Ne
    return Math.round(4 * popSize);
  }, [popSize]);

  // Initialize or reset trajectories
  const initSimulation = useCallback(() => {
    setIsRunning(false);
    setCurrentGen(0);
    const newTrajs: Trajectory[] = [];
    for (let i = 0; i < numTrajectories; i++) {
      newTrajs.push({
        id: i,
        color: LINE_COLORS[i % LINE_COLORS.length],
        history: [initFreq],
        status: 'active',
      });
    }
    setTrajectories(newTrajs);
  }, [numTrajectories, initFreq]);

  useEffect(() => {
    initSimulation();
  }, [popSize, initFreq, selectionS, numTrajectories, initSimulation]);

  // Binomial random variable generator using Poisson/Gaussian approximation for large N or exact
  const sampleBinomial = (n: number, p: number): number => {
    if (p <= 0) return 0;
    if (p >= 1) return n;

    // Normal approximation when np > 10 and n(1-p) > 10
    if (n * p > 10 && n * (1 - p) > 10) {
      const mean = n * p;
      const std = Math.sqrt(n * p * (1 - p));
      // Box-Muller
      const u1 = Math.max(1e-10, Math.random());
      const u2 = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const val = Math.round(mean + z * std);
      return Math.max(0, Math.min(n, val));
    }

    // Exact Bernoulli trials for smaller sizes
    let successes = 0;
    for (let i = 0; i < n; i++) {
      if (Math.random() < p) successes++;
    }
    return successes;
  };

  // Step generation
  const stepOneGeneration = useCallback(() => {
    setTrajectories((prev) => {
      let anyActive = false;
      const next = prev.map((traj) => {
        if (traj.status !== 'active') return traj;
        anyActive = true;
        const currentP = traj.history[traj.history.length - 1];

        // Apply natural selection adjustment p' = p(1+s) / (1 + sp)
        const adjustedP = Math.max(0, Math.min(1, (currentP * (1 + selectionS)) / (1 + selectionS * currentP)));

        // Wright-Fisher random genetic drift: 2 * Ne gene copies
        const totalAlleles = 2 * popSize;
        const count = sampleBinomial(totalAlleles, adjustedP);
        const nextP = count / totalAlleles;

        let status: 'active' | 'fixed' | 'lost' = 'active';
        if (nextP >= 1.0) status = 'fixed';
        else if (nextP <= 0.0) status = 'lost';

        return {
          ...traj,
          history: [...traj.history, nextP],
          status,
        };
      });

      if (!anyActive) {
        setIsRunning(false);
      }
      return next;
    });
    setCurrentGen((g) => g + 1);
  }, [popSize, selectionS]);

  // Run animation loop
  useEffect(() => {
    if (!isRunning) return;
    if (currentGen >= maxGenerations) {
      setIsRunning(false);
      return;
    }

    const timer = setTimeout(() => {
      stepOneGeneration();
    }, 40);

    return () => clearTimeout(timer);
  }, [isRunning, currentGen, maxGenerations, stepOneGeneration]);

  // Counts of current outcomes
  const outcomeStats = useMemo(() => {
    let fixed = 0;
    let lost = 0;
    let active = 0;
    trajectories.forEach((t) => {
      if (t.status === 'fixed') fixed++;
      else if (t.status === 'lost') lost++;
      else active++;
    });
    return { fixed, lost, active, total: trajectories.length };
  }, [trajectories]);

  // Render Canvas Chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Dark sleek background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    const padLeft = 45;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 35;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Horizontal Grid Lines & Frequency Axis
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    [0.0, 0.25, 0.5, 0.75, 1.0].forEach((freq) => {
      const y = padTop + plotH * (1 - freq);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = freq === 1.0 ? '#10b981' : freq === 0.0 ? '#ef4444' : '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(freq.toFixed(2), padLeft - 8, y + 3);
    });

    // Fixation line label (p=1)
    ctx.fillStyle = '#10b981';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('固定 (Fixation p=1.0)', padLeft + 6, padTop + 14);

    // Extinction line label (p=0)
    ctx.fillStyle = '#ef4444';
    ctx.fillText('滅絕 (Loss p=0.0)', padLeft + 6, padTop + plotH - 6);

    // Draw Trajectories
    const maxGenToPlot = Math.max(1, maxGenerations);
    trajectories.forEach((traj) => {
      if (traj.history.length === 0) return;
      ctx.strokeStyle = traj.color;
      ctx.lineWidth = traj.status === 'active' ? 1.8 : 2.4;
      ctx.beginPath();

      traj.history.forEach((freq, gen) => {
        const x = padLeft + (gen / maxGenToPlot) * plotW;
        const y = padTop + plotH * (1 - freq);
        if (gen === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Endpoint marker
      const lastGen = traj.history.length - 1;
      const lastFreq = traj.history[lastGen];
      const xEnd = padLeft + (lastGen / maxGenToPlot) * plotW;
      const yEnd = padTop + plotH * (1 - lastFreq);

      ctx.fillStyle = traj.color;
      ctx.beginPath();
      ctx.arc(xEnd, yEnd, traj.status === 'active' ? 3 : 4.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // X Axis Label
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`世代數 (Generations, 0 - ${maxGenerations})`, padLeft + plotW / 2, height - 8);
  }, [trajectories, maxGenerations]);

  return (
    <div className="my-8 rounded-xl border border-slate-700 bg-slate-900/95 p-5 text-slate-100 shadow-2xl backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-wide text-emerald-400">
            賴特-費雪隨機漂變與木村中性演化模擬器
          </h3>
          <p className="text-xs text-slate-400">
            Wright-Fisher 二項取樣馬可夫鏈 → 有限族群隨機等位基因漂變 → 固著機率與替代速率
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-300">
            當前世代: <strong className="text-emerald-300">{currentGen}</strong> / {maxGenerations}
          </span>
          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              isRunning
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500'
            }`}
          >
            {isRunning ? '暫停演化' : currentGen >= maxGenerations ? '演化結束' : '開始演化'}
          </button>
          <button
            type="button"
            onClick={stepOneGeneration}
            disabled={isRunning || currentGen >= maxGenerations}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
          >
            步進 +1
          </button>
          <button
            type="button"
            onClick={initSimulation}
            className="rounded-lg bg-rose-950/60 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-900/80"
          >
            重置
          </button>
        </div>
      </div>

      {/* Main Plot */}
      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
        <canvas
          ref={canvasRef}
          width={800}
          height={320}
          className="h-72 w-full rounded border border-slate-800 bg-slate-950"
        />
      </div>

      {/* Live Statistics & Theoretical Readout */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">已固定等位基因 (p=1)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-emerald-400">
            {outcomeStats.fixed}{' '}
            <span className="text-xs font-normal text-slate-400">
              / {outcomeStats.total} ({((outcomeStats.fixed / outcomeStats.total) * 100).toFixed(0)}%)
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">已丟失/滅絕 (p=0)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-rose-400">
            {outcomeStats.lost}{' '}
            <span className="text-xs font-normal text-slate-400">
              / {outcomeStats.total} ({((outcomeStats.lost / outcomeStats.total) * 100).toFixed(0)}%)
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">木村理論固定率 (P_fix)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-cyan-400">
            {(theoreticalFixation * 100).toFixed(1)}%
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">中性平均固定時間 (t̄)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-amber-400">
            ~{theoreticalFixationTime}{' '}
            <span className="text-xs font-normal text-slate-400">世代 (4Ne)</span>
          </div>
        </div>
      </div>

      {/* Control Sliders */}
      <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-3">
        {/* Effective Population Size Ne */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>有效族群大小 (N_e):</span>
            <span className="font-mono text-emerald-400 font-bold">{popSize} 隻個體 ({2 * popSize} 等位基因)</span>
          </div>
          <input
            type="range"
            min={20}
            max={300}
            step={10}
            value={popSize}
            onChange={(e) => setPopSize(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            N_e 越小，每代隨機取樣方差越劇烈，漂變主導越顯著
          </div>
        </div>

        {/* Initial Allele Frequency p0 */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>初始等位基因頻率 (p₀):</span>
            <span className="font-mono text-cyan-400 font-bold">{(initFreq * 100).toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={0.8}
            step={0.05}
            value={initFreq}
            onChange={(e) => setInitFreq(parseFloat(e.target.value))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>新突變極限: 1/(2Ne) = {((1 / (2 * popSize)) * 100).toFixed(2)}%</span>
            <button
              type="button"
              onClick={() => setInitFreq(1 / (2 * popSize))}
              className="text-xs text-cyan-400 underline hover:text-cyan-300"
            >
              設為單一新突變
            </button>
          </div>
        </div>

        {/* Natural Selection Coefficient s */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>天擇選擇係數 (s):</span>
            <span
              className={`font-mono font-bold ${
                selectionS > 0 ? 'text-emerald-400' : selectionS < 0 ? 'text-rose-400' : 'text-slate-300'
              }`}
            >
              {selectionS > 0 ? `+${selectionS.toFixed(2)} (有利)` : selectionS < 0 ? `${selectionS.toFixed(2)} (輕度有害)` : '0.00 (純中性)'}
            </span>
          </div>
          <input
            type="range"
            min={-0.04}
            max={0.04}
            step={0.01}
            value={selectionS}
            onChange={(e) => setSelectionS(parseFloat(e.target.value))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            當 |2Ne·s| &lt; 1 時，天擇完全失效，基因命運完全由隨機漂變裁決
          </div>
        </div>
      </div>

      {/* Deep Insight Footer */}
      <div className="mt-4 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">木村資生中性演化核心定理：</span>
        一個新突變等位基因的中性固定率恰好是其初始頻率 <strong className="text-cyan-300">P_fix = 1 / (2N_e)</strong>。
        若族群每代突變率為 μ，則全族群每代產生的新突變總數為 2N_e·μ。
        二者相乘得出長期分子演化替換率：
        <strong className="text-emerald-400 font-mono"> k = 2N_e·μ × (1 / 2N_e) = μ</strong>！
        令人震驚的是，<strong className="text-slate-200">分子演化的長期時鐘速率與族群大小 N_e 完全無關</strong>，完全由純粹的中性突變率決定！
      </div>
    </div>
  );
};
