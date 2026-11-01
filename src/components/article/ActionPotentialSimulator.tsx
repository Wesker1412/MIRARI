import React, { useState, useEffect, useRef } from 'react';

interface HHState {
  V: number;
  m: number;
  h: number;
  n: number;
}

export const ActionPotentialSimulator: React.FC = () => {
  // Stimulation parameters
  const [stimulusCurrent, setStimulusCurrent] = useState<number>(10.0); // uA/cm^2
  const [stimulusDuration, setStimulusDuration] = useState<number>(2.0); // ms
  const [blockSodium, setBlockSodium] = useState<boolean>(false); // TTX block toggle
  const [blockPotassium, setBlockPotassium] = useState<boolean>(false); // TEA block toggle
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Peak metrics
  const [peakVoltage, setPeakVoltage] = useState<number>(-65.0);
  const [firedSpike, setFiredSpike] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // HH Standard Parameters
  const C_m = 1.0;
  const g_Na_max = 120.0;
  const E_Na = 50.0;
  const g_K_max = 36.0;
  const E_K = -77.0;
  const g_L = 0.3;
  const E_L = -54.387;

  // Rate coefficients
  const alphaM = (v: number) => {
    const num = 0.1 * (v + 40);
    const den = 1 - Math.exp(-(v + 40) / 10);
    return Math.abs(den) < 1e-6 ? 1.0 : num / den;
  };
  const betaM = (v: number) => 4.0 * Math.exp(-(v + 65) / 18);

  const alphaH = (v: number) => 0.07 * Math.exp(-(v + 65) / 20);
  const betaH = (v: number) => 1.0 / (1.0 + Math.exp(-(v + 35) / 10));

  const alphaN = (v: number) => {
    const num = 0.01 * (v + 55);
    const den = 1 - Math.exp(-(v + 55) / 10);
    return Math.abs(den) < 1e-6 ? 0.1 : num / den;
  };
  const betaN = (v: number) => 0.125 * Math.exp(-(v + 65) / 80);

  // Simulation time series buffer
  const historyRef = useRef<{ t: number; V: number; m: number; h: number; n: number; I: number }[]>([]);
  const stateRef = useRef<HHState>({
    V: -65.0,
    m: 0.0529,
    h: 0.5961,
    n: 0.3177,
  });
  const timeRef = useRef<number>(0);

  // Manual Trigger Pulse
  const [triggerPulseTime, setTriggerPulseTime] = useState<number>(5.0);

  const handleInjectPulse = () => {
    setTriggerPulseTime(timeRef.current + 2.0);
  };

  const handleReset = () => {
    timeRef.current = 0;
    stateRef.current = {
      V: -65.0,
      m: 0.0529,
      h: 0.5961,
      n: 0.3177,
    };
    historyRef.current = [];
    setTriggerPulseTime(5.0);
    setPeakVoltage(-65.0);
    setFiredSpike(false);
  };

  // Integration step (Euler/Runge-Kutta numerical solver)
  const stepHH = (dt: number, I_ext: number) => {
    const { V, m, h, n } = stateRef.current;

    const gNa = blockSodium ? 0 : g_Na_max * m * m * m * h;
    const gK = blockPotassium ? 0 : g_K_max * n * n * n * n;

    const I_Na = gNa * (V - E_Na);
    const I_K = gK * (V - E_K);
    const I_Leak = g_L * (V - E_L);

    const dV = (I_ext - I_Na - I_K - I_Leak) / C_m;
    const dm = alphaM(V) * (1 - m) - betaM(V) * m;
    const dh = alphaH(V) * (1 - h) - betaH(V) * h;
    const dn = alphaN(V) * (1 - n) - betaN(V) * n;

    stateRef.current = {
      V: V + dV * dt,
      m: Math.max(0, Math.min(1, m + dm * dt)),
      h: Math.max(0, Math.min(1, h + dh * dt)),
      n: Math.max(0, Math.min(1, n + dn * dt)),
    };
  };

  // Animation & Rendering loop
  useEffect(() => {
    let animId: number;
    const dt = 0.025; // ms

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      if (isPlaying) {
        // Run 4 simulation steps per frame
        for (let i = 0; i < 4; i++) {
          const t = timeRef.current;
          // Apply pulse between triggerPulseTime and triggerPulseTime + stimulusDuration
          const isStimActive = t >= triggerPulseTime && t < triggerPulseTime + stimulusDuration;
          const currentI = isStimActive ? stimulusCurrent : 0;

          stepHH(dt, currentI);
          timeRef.current += dt;

          historyRef.current.push({
            t: timeRef.current,
            V: stateRef.current.V,
            m: stateRef.current.m,
            h: stateRef.current.h,
            n: stateRef.current.n,
            I: currentI,
          });

          if (stateRef.current.V > peakVoltage) {
            setPeakVoltage(stateRef.current.V);
          }
          if (stateRef.current.V > 0 && !firedSpike) {
            setFiredSpike(true);
          }

          // Loop every 40 ms window
          if (timeRef.current > 40.0) {
            timeRef.current = 0;
            stateRef.current = { V: -65.0, m: 0.0529, h: 0.5961, n: 0.3177 };
            historyRef.current = [];
            setTriggerPulseTime(5.0);
            setFiredSpike(false);
            setPeakVoltage(-65.0);
          }
        }
      }

      // Draw Oscilloscope Display
      ctx.clearRect(0, 0, w, h);

      // Grid background (Oscilloscope green phosphor / slate clean aesthetic)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Zero and Threshold Reference Lines
      const vToY = (val: number) => {
        // Range: -90 mV to +50 mV => height range 20px to (h * 0.65)
        const vMin = -90;
        const vMax = 50;
        const norm = (val - vMin) / (vMax - vMin);
        return (h * 0.65) - norm * (h * 0.55);
      };

      // Firing Threshold (-55 mV line)
      const yThreshold = vToY(-55);
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, yThreshold);
      ctx.lineTo(w, yThreshold);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(234, 179, 8, 0.7)';
      ctx.font = '10px monospace';
      ctx.fillText('動作電位閥值 (-55 mV)', 10, yThreshold - 4);

      // Resting Potential (-65 mV)
      const yResting = vToY(-65);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.beginPath();
      ctx.moveTo(0, yResting);
      ctx.lineTo(w, yResting);
      ctx.stroke();
      ctx.fillText('靜止膜電位 (-65 mV)', 10, yResting + 12);

      // Draw Voltage Curve V(t)
      const hist = historyRef.current;
      if (hist.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#38bdf8'; // Electric cyan
        ctx.lineWidth = 2.5;
        for (let i = 0; i < hist.length; i++) {
          const pt = hist[i];
          const px = (pt.t / 40.0) * w;
          const py = vToY(pt.V);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Draw Stimulus Pulse bar at bottom
        ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
        for (let i = 0; i < hist.length; i++) {
          if (hist[i].I > 0) {
            const px = (hist[i].t / 40.0) * w;
            ctx.fillRect(px, h - 35, 2, 25);
          }
        }

        // Draw Gating Variables m, h, n in lower trace
        const gToY = (val: number) => h - 45 - val * 45;

        // m: Na+ activation (orange)
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const px = (hist[i].t / 40.0) * w;
          const py = gToY(hist[i].m);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // h: Na+ inactivation (emerald)
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const px = (hist[i].t / 40.0) * w;
          const py = gToY(hist[i].h);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // n: K+ delayed activation (purple)
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const px = (hist[i].t / 40.0) * w;
          const py = gToY(hist[i].n);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, stimulusCurrent, stimulusDuration, blockSodium, blockPotassium, triggerPulseTime]);

  return (
    <div className="rounded-2xl border border-mirari-line bg-white p-4 sm:p-6 shadow-sm space-y-5 font-sans">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-mirari-line gap-2">
        <div>
          <span className="text-[11px] font-mono text-emerald-700 uppercase tracking-wider font-semibold block">
            ELECTROPHYSIOLOGY · HODGKIN-HUXLEY (1952)
          </span>
          <h4 className="font-serif text-lg font-bold text-mirari-ink">
            神經元動作電位全或無定律與離子通道示波器
          </h4>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1.5 rounded-lg border border-mirari-line hover:bg-mirari-surfaceAlt text-mirari-muted transition font-medium"
          >
            {isPlaying ? '暫停示波器' : '繼續運行'}
          </button>
          <button
            onClick={handleInjectPulse}
            className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition font-medium"
          >
            注入刺激電流脈衝
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg border border-mirari-line hover:bg-mirari-surfaceAlt text-mirari-muted transition"
          >
            重置示波器
          </button>
        </div>
      </div>

      {/* Oscilloscope Canvas */}
      <div className="relative rounded-xl border border-slate-800 overflow-hidden shadow-inner">
        <canvas ref={canvasRef} width={640} height={360} className="w-full max-w-[640px] h-[300px] sm:h-[360px]" />

        {/* Legend */}
        <div className="absolute top-3 right-3 bg-slate-900/85 backdrop-blur-sm border border-slate-700 rounded-lg p-2.5 text-[11px] font-mono text-slate-300 space-y-1 shadow-sm">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-1 bg-sky-400 inline-block" />
            <span>膜電位 Vm (mV)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-1 bg-orange-500 inline-block" />
            <span>m 閘門 (Na⁺ 激發)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-1 bg-emerald-500 inline-block" />
            <span>h 閘門 (Na⁺ 關閉失活)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-1 bg-purple-400 inline-block" />
            <span>n 閘門 (K⁺ 延遲復極)</span>
          </div>
        </div>

        {/* Status Callout */}
        <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1 text-[11px] font-mono text-slate-200">
          當前峰值膜電位: <strong className={firedSpike ? 'text-sky-300' : 'text-slate-400'}>{peakVoltage.toFixed(1)} mV</strong>
          {' · '}
          狀態: {firedSpike ? (
            <span className="text-emerald-400 font-bold">已激發動作電位（全或無定律生效）</span>
          ) : (
            <span className="text-amber-400">次閥值局部被動電位（無激發）</span>
          )}
        </div>
      </div>

      {/* Biological Control Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans pt-1">
        <div className="space-y-1.5">
          <div className="flex justify-between text-mirari-dim">
            <span>刺激電流強度 (I_ext)</span>
            <span className="font-mono text-mirari-ink font-semibold">{stimulusCurrent} μA/cm²</span>
          </div>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={stimulusCurrent}
            onChange={(e) => setStimulusCurrent(Number(e.target.value))}
            className="w-full accent-emerald-700 cursor-pointer"
          />
          <span className="text-[10px] text-mirari-dim block">
            試試看小於 7 (不激發) 與大於 8 (全面爆發)
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-mirari-dim">
            <span>刺激持續時間</span>
            <span className="font-mono text-mirari-ink font-semibold">{stimulusDuration} ms</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={5.0}
            step={0.5}
            value={stimulusDuration}
            onChange={(e) => setStimulusDuration(Number(e.target.value))}
            className="w-full accent-emerald-700 cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-mirari-dim block">藥理學離子通道阻斷</span>
          <div className="flex flex-col space-y-1.5 pt-0.5">
            <button
              onClick={() => setBlockSodium(!blockSodium)}
              className={`py-1.5 px-2.5 rounded border text-[11px] text-left transition font-sans ${
                blockSodium
                  ? 'bg-rose-50 border-rose-300 text-rose-800 font-medium'
                  : 'border-mirari-line hover:bg-mirari-surfaceAlt text-mirari-muted'
              }`}
            >
              {blockSodium ? '✓ 河豚毒素 (TTX) 阻斷鈉通道' : '加入 TTX 阻斷鈉通道'}
            </button>
            <button
              onClick={() => setBlockPotassium(!blockPotassium)}
              className={`py-1.5 px-2.5 rounded border text-[11px] text-left transition font-sans ${
                blockPotassium
                  ? 'bg-purple-50 border-purple-300 text-purple-800 font-medium'
                  : 'border-mirari-line hover:bg-mirari-surfaceAlt text-mirari-muted'
              }`}
            >
              {blockPotassium ? '✓ 四乙基銨 (TEA) 阻斷鉀通道' : '加入 TEA 阻斷鉀通道'}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-mirari-dim block">科學發現要點</span>
          <p className="text-[11px] text-mirari-muted leading-relaxed p-2 rounded bg-mirari-paper border border-mirari-line">
            神經衝動不是連續增大的類比信號，而是像數位位元一樣「全或無」；一旦超過閥值，振幅恆定不變。
          </p>
        </div>
      </div>
    </div>
  );
};
