import React, { useState, useEffect, useRef, useCallback } from 'react';

export const SpikingNeuronSimulator: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [inputRateHz, setInputRateHz] = useState<number>(35); // 5 to 100 Hz input firing
  const [synapticWeight, setSynapticWeight] = useState<number>(4.5); // mV EPSP amplitude
  const [membraneTau, setMembraneTau] = useState<number>(20); // tau_m: 10 to 50 ms
  const [thresholdV, setThresholdV] = useState<number>(-50); // V_th: -55 to -40 mV
  
  // Biological baseline constants
  const V_REST = -70; // mV
  const V_RESET = -75; // mV
  const REFRAC_PERIOD_MS = 3; // ms

  // Simulation State
  const simStateRef = useRef({
    v: V_REST,
    refracTimer: 0,
    totalSpikesIn: 0,
    totalSpikesOut: 0,
    timeMs: 0,
    snnEnergyFJ: 0, // Event-driven energy in femtojoules
    annEnergyFJ: 0, // Traditional synchronous MAC energy in femtojoules
  });

  // History buffers for plotting (last 400 ms)
  const historyRef = useRef<{
    time: number[];
    v: number[];
    spikesIn: number[];
    spikesOut: boolean[];
  }>({
    time: [],
    v: [],
    spikesIn: [],
    spikesOut: [],
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [readoutStats, setReadoutStats] = useState({
    spikesIn: 0,
    spikesOut: 0,
    firingRateOut: 0,
    snnJoules: 0,
    annJoules: 0,
    energySavingFactor: 1,
  });

  // Reset simulation
  const resetSimulation = useCallback(() => {
    simStateRef.current = {
      v: V_REST,
      refracTimer: 0,
      totalSpikesIn: 0,
      totalSpikesOut: 0,
      timeMs: 0,
      snnEnergyFJ: 0,
      annEnergyFJ: 0,
    };
    historyRef.current = {
      time: [],
      v: [],
      spikesIn: [],
      spikesOut: [],
    };
    setReadoutStats({
      spikesIn: 0,
      spikesOut: 0,
      firingRateOut: 0,
      snnJoules: 0,
      annJoules: 0,
      energySavingFactor: 1,
    });
  }, []);

  // Simulation Step Function (dt = 1 ms)
  const stepSim = useCallback(() => {
    const dt = 1; // 1 ms per tick
    const s = simStateRef.current;
    s.timeMs += dt;

    // 1. Poisson input arrival check: prob = rate * dt / 1000
    const spikeProb = (inputRateHz * dt) / 1000;
    const hasInputSpike = Math.random() < spikeProb;
    let inputCurrent = 0;

    if (hasInputSpike) {
      s.totalSpikesIn++;
      inputCurrent = synapticWeight;
      // Neuromorphic SOP (Synaptic Operation) energy: ~50 fJ per event
      s.snnEnergyFJ += 50;
    }

    // Traditional Synchronous Clocked Architecture:
    // Dissipates clock gating + floating point MAC (~3.2 pJ = 3200 fJ per cycle continuously)
    s.annEnergyFJ += 3200;

    // 2. LIF Membrane dynamics
    let hasOutputSpike = false;
    if (s.refracTimer > 0) {
      s.refracTimer -= dt;
      s.v = V_RESET;
    } else {
      // Leaky integration: dv/dt = -(v - v_rest) / tau_m + I
      const dv = (-(s.v - V_REST) / membraneTau) * dt + inputCurrent;
      s.v += dv;

      // Spike emission check
      if (s.v >= thresholdV) {
        hasOutputSpike = true;
        s.totalSpikesOut++;
        s.v = 20; // action potential peak for visual
        s.refracTimer = REFRAC_PERIOD_MS;
        // Output axon transmission energy: ~150 fJ
        s.snnEnergyFJ += 150;
      }
    }

    // Push into history buffers (keep last 350 samples)
    const h = historyRef.current;
    h.time.push(s.timeMs);
    h.v.push(s.v);
    h.spikesIn.push(hasInputSpike ? 1 : 0);
    h.spikesOut.push(hasOutputSpike);

    if (h.time.length > 350) {
      h.time.shift();
      h.v.shift();
      h.spikesIn.shift();
      h.spikesOut.shift();
    }
  }, [inputRateHz, synapticWeight, membraneTau, thresholdV]);

  // Main simulation tick loop
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      // Run 3 ms of simulation per frame tick for smooth animation
      stepSim();
      stepSim();
      stepSim();

      const s = simStateRef.current;
      const durationSec = Math.max(0.001, s.timeMs / 1000);
      const outHz = s.totalSpikesOut / durationSec;
      const ratio = s.snnEnergyFJ > 0 ? s.annEnergyFJ / s.snnEnergyFJ : 1;

      setReadoutStats({
        spikesIn: s.totalSpikesIn,
        spikesOut: s.totalSpikesOut,
        firingRateOut: parseFloat(outHz.toFixed(1)),
        snnJoules: s.snnEnergyFJ / 1e15, // in Joules
        annJoules: s.annEnergyFJ / 1e15, // in Joules
        energySavingFactor: parseFloat(ratio.toFixed(1)),
      });
    }, 30);

    return () => clearInterval(interval);
  }, [isRunning, stepSim]);

  // Render Canvas (Live Oscilloscope)
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

    const padLeft = 55;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 30;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Divide plot into two tracks:
    // Top track: Input spikes (raster ticks) (height 40px)
    // Bottom track: Membrane potential V(t) (height plotH - 50px)
    const rasterH = 40;
    const vPlotTop = padTop + rasterH + 15;
    const vPlotH = plotH - rasterH - 15;

    // Raster background line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop + rasterH);
    ctx.lineTo(width - padRight, padTop + rasterH);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('輸入脈衝', padLeft - 8, padTop + 24);

    // Membrane voltage grid
    const vMin = -80;
    const vMax = 25;
    const getYForV = (voltage: number) => {
      const norm = (voltage - vMin) / (vMax - vMin);
      return vPlotTop + vPlotH * (1 - norm);
    };

    [-70, -50, 0].forEach((volt) => {
      const y = getYForV(volt);
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = volt === -70 ? '#38bdf8' : volt === 0 ? '#64748b' : '#f59e0b';
      ctx.fillText(`${volt} mV`, padLeft - 8, y + 3);
    });

    // Draw Threshold Line (Dashed Amber)
    const threshY = getYForV(thresholdV);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, threshY);
    ctx.lineTo(width - padRight, threshY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f59e0b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`發火閾值 V_th (${thresholdV} mV)`, padLeft + 6, threshY - 4);

    // Draw History Data
    const h = historyRef.current;
    const len = h.time.length;
    if (len > 1) {
      // 1. Draw input spikes
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < len; i++) {
        if (h.spikesIn[i]) {
          const x = padLeft + (i / 350) * plotW;
          ctx.beginPath();
          ctx.moveTo(x, padTop + 8);
          ctx.lineTo(x, padTop + rasterH - 6);
          ctx.stroke();
        }
      }

      // 2. Draw membrane potential curve V(t)
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const x = padLeft + (i / 350) * plotW;
        const y = getYForV(h.v[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 3. Highlight Output Spikes with red vertical flashes
      ctx.fillStyle = '#ef4444';
      for (let i = 0; i < len; i++) {
        if (h.spikesOut[i]) {
          const x = padLeft + (i / 350) * plotW;
          ctx.beginPath();
          ctx.arc(x, getYForV(20), 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Time axis label
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('即時時間窗口 (滾動示波器, 350 ms)', padLeft + plotW / 2, height - 8);
  }, [thresholdV]);

  return (
    <div className="my-8 rounded-xl border border-slate-700 bg-slate-900/95 p-5 text-slate-100 shadow-2xl backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-wide text-purple-400">
            類腦神經元洩漏整合放電 (LIF) 與事件驅動能耗模擬器
          </h3>
          <p className="text-xs text-slate-400">
            Leaky Integrate-and-Fire 膜電位動力學 → 異步非連續事件點陣 → 類腦 vs 馮紐曼能耗對決
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              isRunning
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500'
            }`}
          >
            {isRunning ? '暫停監控' : '恢復監控'}
          </button>
          <button
            type="button"
            onClick={resetSimulation}
            className="rounded-lg bg-rose-950/60 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-900/80"
          >
            重設
          </button>
        </div>
      </div>

      {/* Main Live Oscilloscope */}
      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
        <canvas
          ref={canvasRef}
          width={800}
          height={300}
          className="h-68 w-full rounded border border-slate-800 bg-slate-950"
        />
      </div>

      {/* Energy Efficiency & Spiking Readouts */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">輸出脈衝率 (Spike Rate)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-rose-400">
            {readoutStats.firingRateOut}{' '}
            <span className="text-xs font-normal text-slate-400">Hz</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            總輸出: {readoutStats.spikesOut} 次
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">類腦事件驅動能耗 (SNN)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-emerald-400">
            {(readoutStats.snnJoules * 1e9).toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">nJ</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-500">
            靜態無脈衝時功耗近乎歸零
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">傳統時鐘架構能耗 (ANN/GPU)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-amber-400">
            {(readoutStats.annJoules * 1e9).toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">nJ</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            無論有無資訊皆持續週期性 MAC
          </div>
        </div>

        <div className="rounded-lg border border-purple-900/50 bg-purple-950/20 p-3">
          <div className="text-[11px] text-purple-300 font-semibold">實測能源效率倍率</div>
          <div className="mt-1 text-2xl font-mono font-bold text-cyan-300">
            {readoutStats.energySavingFactor}x
          </div>
          <div className="mt-1 text-[11px] text-purple-400">
            稀疏度賦予的極致能效比
          </div>
        </div>
      </div>

      {/* Dynamic Controls */}
      <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-4">
        {/* Input Rate */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>輸入突觸脈衝率:</span>
            <span className="font-mono text-cyan-400 font-bold">{inputRateHz} Hz</span>
          </div>
          <input
            type="range"
            min={5}
            max={90}
            step={5}
            value={inputRateHz}
            onChange={(e) => setInputRateHz(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            外在刺激強度直接轉化為輸入脈衝頻率
          </div>
        </div>

        {/* Synaptic Weight */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>突觸權重 (EPSP 幅度):</span>
            <span className="font-mono text-purple-400 font-bold">+{synapticWeight} mV</span>
          </div>
          <input
            type="range"
            min={1.0}
            max={9.0}
            step={0.5}
            value={synapticWeight}
            onChange={(e) => setSynapticWeight(parseFloat(e.target.value))}
            className="mt-2 w-full accent-purple-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            單個脈衝抵達時引起的膜電位瞬間去極化
          </div>
        </div>

        {/* Membrane Tau */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>膜時間常數 (τ_m):</span>
            <span className="font-mono text-emerald-400 font-bold">{membraneTau} ms</span>
          </div>
          <input
            type="range"
            min={10}
            max={45}
            step={5}
            value={membraneTau}
            onChange={(e) => setMembraneTau(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            決定電荷洩漏速率與時域整合記憶視窗
          </div>
        </div>

        {/* Threshold Voltage */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>發火閾值 (V_th):</span>
            <span className="font-mono text-amber-400 font-bold">{thresholdV} mV</span>
          </div>
          <input
            type="range"
            min={-55}
            max={-42}
            step={1}
            value={thresholdV}
            onChange={(e) => setThresholdV(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            膜電位超過此值時觸發雪崩式動作電位
          </div>
        </div>
      </div>

      {/* Deep Insight Footer */}
      <div className="mt-4 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">破除馮紐曼瓶頸的核心哲學：</span>
        傳統人工神經網路（如 GPU 上的 Transformer）每經過一個時間步長，無論畫面有無變化，都必須對所有數億個權重進行密集的矩陣乘法與記憶體搬移（Memory Wall）；
        而神經形態晶片（如天機晶片 Tianjic 或 Intel Loihi）採用生物大腦的「**事件驅動（Event-driven）**」架構——
        <strong className="text-emerald-300">沒有脈衝就沒有計算，沒有計算就沒有能量耗散</strong>。
        動態時空的極端稀疏性，正是人類大腦以僅僅 20 瓦功率完成驚人智慧運算的根本秘密。
      </div>
    </div>
  );
};
