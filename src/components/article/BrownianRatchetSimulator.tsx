import React, { useState, useEffect, useRef, useMemo } from 'react';

type RatchetMode = 'isothermal_equilibrium' | 'atp_driven_flashing' | 'high_load_stall';

export const BrownianRatchetSimulator: React.FC = () => {
  const [mode, setMode] = useState<RatchetMode>('atp_driven_flashing');
  const [temperature, setTemperature] = useState<number>(300); // Kelvin (100 to 500)
  const [atpRate, setAtpRate] = useState<number>(4.0); // Hz (1 to 10)
  const [loadForce, setLoadForce] = useState<number>(1.5); // pN (0 to 8)
  const [potentialDepth, setPotentialDepth] = useState<number>(12); // k_B * T units (4 to 25)

  // Simulation particle state in Refs for 60fps canvas performance
  const particlePosRef = useRef<number>(0.0); // in nm
  const netVelocityRef = useRef<number>(0.0); // nm/s
  const stepCountRef = useRef<number>(0);

  // Throttled UI display metrics (updated at ~5 Hz to prevent DOM thrashing)
  const [metrics, setMetrics] = useState({
    pos: 0.0,
    velocity: 0.0,
    steps: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphCanvasRef = useRef<HTMLCanvasElement>(null);

  // Time series of displacement x(t) for tracking
  const trajectoryRef = useRef<{ t: number; x: number }[]>([]);
  const simTimeRef = useRef<number>(0);
  const flashPhaseRef = useRef<number>(0);
  const lastMetricsUpdateRef = useRef<number>(0);

  // Physical parameters
  const periodL = 8.0; // nm (tubulin dimer spacing ~ 8 nm for kinesin)
  const asymmetryAlpha = 0.25; // steep side 25%, gentle slope 75%
  const stallForce = 6.5; // pN typical for single kinesin motor

  // Mode descriptions
  const modeInfo = useMemo(() => {
    switch (mode) {
      case 'isothermal_equilibrium':
        return {
          title: '等溫熱平衡 (Isothermal Equilibrium, T₁ = T₂)',
          desc: '費曼布朗棘輪思想實驗：在單一溫度下，即便空間勢阱齒形高度非對稱，棘爪本身的熱擾動使其隨機跳動，正反向跳躍幾率嚴格等同，淨位移平均為零（細緻平衡 Detailed Balance）。',
          color: 'text-amber-600',
        };
      case 'atp_driven_flashing':
        return {
          title: 'ATP 水解化學力學偶聯 (Flashing Ratchet / Power Stroke)',
          desc: '非平衡能量注入：每個 ATP 分子水解注入 ~20-25 k_BT 自由能，周期性週期開關或傾斜非對稱勢阱，打破時間反演對稱性，熱噪聲被整流為定向行走。',
          color: 'text-emerald-600',
        };
      case 'high_load_stall':
        return {
          title: '逆向負載阻滯 (Stall Force Boundary)',
          desc: '力學極限：施加反向拖曳力 F_load。當阻力達到失速力（~6-7 pN）時，分子馬達停止前進；若外力進一步加大，甚至會被強行拖拽逆行。',
          color: 'text-rose-600',
        };
    }
  }, [mode]);

  // Handle mode switches
  const handleModeChange = (newMode: RatchetMode) => {
    setMode(newMode);
    trajectoryRef.current = [];
    simTimeRef.current = 0;
    particlePosRef.current = 0;
    netVelocityRef.current = 0;
    stepCountRef.current = 0;
    setMetrics({ pos: 0, velocity: 0, steps: 0 });
    if (newMode === 'isothermal_equilibrium') {
      setLoadForce(0);
    } else if (newMode === 'high_load_stall') {
      setLoadForce(stallForce);
    } else {
      setLoadForce(1.5);
    }
  };

  // Main Physics Simulation & Canvas Rendering Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(0.04, (time - lastTime) / 1000);
      lastTime = time;
      simTimeRef.current += dt;

      // Update flashing state (ATP cycle)
      flashPhaseRef.current += dt * atpRate * Math.PI * 2;
      const isPotentialOn =
        mode === 'isothermal_equilibrium'
          ? true
          : Math.sin(flashPhaseRef.current) > -0.2; // 60% on, 40% off (diffusive relaxation)

      // Langevin Dynamics: γ * dx/dt = - dU/dx - F_load + ξ(t)
      // Diffusion coefficient D = k_B * T / γ
      const kB = 1.38e-2; // in pN * nm / K
      const kBT = kB * temperature; // ~4.14 pN * nm at 300K
      const gamma = 0.05; // effective friction pN * s / nm

      // Thermal Gaussian noise: <ξ(t) ξ(t')> = 2 * γ * k_B * T * δ(t - t')
      const noiseAmp = Math.sqrt((2 * kBT * gamma) / dt);
      const u1 = Math.random() || 1e-6;
      const u2 = Math.random() || 1e-6;
      const gaussianNoise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const thermalForce = gaussianNoise * noiseAmp;

      // Force from asymmetric ratchet potential U(x)
      let potentialForce = 0;
      const currentPos = particlePosRef.current;
      if (isPotentialOn) {
        const localX = ((currentPos % periodL) + periodL) % periodL;
        const uMax = (potentialDepth * kBT) / periodL; // pN
        if (localX < periodL * asymmetryAlpha) {
          potentialForce = -uMax / asymmetryAlpha;
        } else {
          potentialForce = uMax / (1 - asymmetryAlpha);
        }
      }

      // External mechanical load resisting forward motion
      const effectiveLoad = mode === 'isothermal_equilibrium' ? 0 : -loadForce;
      const totalForce = potentialForce + effectiveLoad + thermalForce;
      const dx = (totalForce / gamma) * dt;

      // Bounded numerical integration step
      const clampedDx = Math.max(-15 * dt, Math.min(15 * dt, dx));
      const newPos = currentPos + clampedDx;
      particlePosRef.current = newPos;

      // Record displacement trajectory for graph (every ~0.05s)
      const traj = trajectoryRef.current;
      if (traj.length === 0 || simTimeRef.current - traj[traj.length - 1].t > 0.04) {
        traj.push({ t: simTimeRef.current, x: newPos });
        if (traj.length > 120) traj.shift();
      }

      // Calculate moving average net velocity
      if (traj.length > 10) {
        const dtSpan = traj[traj.length - 1].t - traj[0].t;
        const dxSpan = traj[traj.length - 1].x - traj[0].x;
        if (dtSpan > 0.1) {
          netVelocityRef.current = dxSpan / dtSpan;
        }
      }

      stepCountRef.current = Math.floor(newPos / periodL);

      // Throttled UI state updates (~4 times per sec) to avoid React re-render DOM thrashing
      if (simTimeRef.current - lastMetricsUpdateRef.current > 0.25) {
        lastMetricsUpdateRef.current = simTimeRef.current;
        setMetrics({
          pos: newPos,
          velocity: netVelocityRef.current,
          steps: stepCountRef.current,
        });
      }

      // ─── Direct 60 FPS Canvas 1: Ratchet Potential & Motor Render ──
      const canvas1 = canvasRef.current;
      if (canvas1) {
        const ctx = canvas1.getContext('2d');
        if (ctx) {
          const w = canvas1.width;
          const h = canvas1.height;
          ctx.clearRect(0, 0, w, h);

          // Dark biology viewport
          ctx.fillStyle = '#0a0f1d';
          ctx.fillRect(0, 0, w, h);

          // Microtubule track grid
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.lineWidth = 1;
          for (let x = 0; x < w; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }

          // Microtubule backbone cylinder (bottom)
          const trackY = h * 0.72;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, trackY, w, 28);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, trackY, w, 28);

          // Tubulin dimer marks
          const scalePxPerNm = 6.0;
          const viewOffsetPx = (w / 2) - newPos * scalePxPerNm;

          for (let nm = -60; nm <= 120; nm += periodL) {
            const px = viewOffsetPx + nm * scalePxPerNm;
            if (px >= -20 && px <= w + 20) {
              ctx.fillStyle = '#38bdf8';
              ctx.beginPath();
              ctx.arc(px, trackY + 14, 5, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#94a3b8';
              ctx.font = '8px monospace';
              ctx.fillText(`${nm}nm`, px - 12, trackY + 38);
            }
          }

          // Draw Asymmetric Potential Energy Curve U(x)
          const potBaseY = h * 0.42;
          const potAmpY = 55;
          const isFlashingOff = mode === 'atp_driven_flashing' && !isPotentialOn;

          ctx.strokeStyle = isFlashingOff ? 'rgba(148, 163, 184, 0.25)' : '#f59e0b';
          ctx.lineWidth = isFlashingOff ? 1.5 : 2.5;
          if (isFlashingOff) {
            ctx.setLineDash([4, 4]);
          } else {
            ctx.setLineDash([]);
          }

          ctx.beginPath();
          for (let xPx = 0; xPx <= w; xPx += 2) {
            const nmX = (xPx - viewOffsetPx) / scalePxPerNm;
            const localNm = ((nmX % periodL) + periodL) % periodL;
            let energyFrac = 0;

            if (!isFlashingOff) {
              if (localNm < periodL * asymmetryAlpha) {
                energyFrac = localNm / (periodL * asymmetryAlpha);
              } else {
                energyFrac = 1.0 - (localNm - periodL * asymmetryAlpha) / (periodL * (1 - asymmetryAlpha));
              }
            }
            const yPx = potBaseY - energyFrac * potAmpY;
            if (xPx === 0) ctx.moveTo(xPx, yPx);
            else ctx.lineTo(xPx, yPx);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Potential label
          ctx.fillStyle = isFlashingOff ? '#64748b' : '#f59e0b';
          ctx.font = '10px monospace';
          ctx.fillText(
            isFlashingOff
              ? '平坦勢阱態 (ATP水解擴散鬆弛期 Off-state)'
              : `非對稱鋸齒勢阱 U(x) (深度 ΔU = ${potentialDepth} kBT)`,
            20,
            28
          );

          // Draw Brownian Particle & Kinesin Head Structure
          const particleScreenX = w / 2;
          const localParticleNm = ((newPos % periodL) + periodL) % periodL;
          let particleEnergyFrac = 0;
          if (!isFlashingOff) {
            if (localParticleNm < periodL * asymmetryAlpha) {
              particleEnergyFrac = localParticleNm / (periodL * asymmetryAlpha);
            } else {
              particleEnergyFrac = 1.0 - (localParticleNm - periodL * asymmetryAlpha) / (periodL * (1 - asymmetryAlpha));
            }
          }
          const particleScreenY = potBaseY - particleEnergyFrac * potAmpY;

          // Load force vector arrow pointing left
          if (loadForce > 0.2 && mode !== 'isothermal_equilibrium') {
            const arrowLen = Math.min(50, loadForce * 6.5);
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(particleScreenX, particleScreenY);
            ctx.lineTo(particleScreenX - arrowLen, particleScreenY);
            ctx.stroke();
            // Arrow head
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.moveTo(particleScreenX - arrowLen, particleScreenY);
            ctx.lineTo(particleScreenX - arrowLen + 6, particleScreenY - 4);
            ctx.lineTo(particleScreenX - arrowLen + 6, particleScreenY + 4);
            ctx.closePath();
            ctx.fill();
            ctx.font = '9px monospace';
            ctx.fillText(`F_load: ${loadForce}pN`, particleScreenX - arrowLen - 20, particleScreenY - 8);
          }

          // Connecting mechanical stalk to microtubule
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(particleScreenX, particleScreenY);
          ctx.quadraticCurveTo(particleScreenX + 12, (particleScreenY + trackY) / 2, particleScreenX, trackY);
          ctx.stroke();

          // Molecular motor body (glowing sphere)
          const glowGrad = ctx.createRadialGradient(
            particleScreenX,
            particleScreenY,
            2,
            particleScreenX,
            particleScreenY,
            14
          );
          glowGrad.addColorStop(0, '#ffffff');
          glowGrad.addColorStop(0.3, '#34d399');
          glowGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(particleScreenX, particleScreenY, 14, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(particleScreenX, particleScreenY, 6.5, 0, Math.PI * 2);
          ctx.fill();

          // Walking direction arrow indicator
          ctx.fillStyle = '#38bdf8';
          ctx.font = '10px monospace';
          ctx.fillText('(+) 端順向生長端 →', w - 130, trackY + 38);
        }
      }

      // ─── Direct 60 FPS Canvas 2: Real-time Trajectory x(t) Graph ───
      const canvas2 = graphCanvasRef.current;
      if (canvas2) {
        const ctx = canvas2.getContext('2d');
        if (ctx) {
          const w = canvas2.width;
          const h = canvas2.height;
          ctx.clearRect(0, 0, w, h);

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, w, h);

          if (traj.length >= 2) {
            const tMin = traj[0].t;
            const tMax = Math.max(tMin + 3.0, traj[traj.length - 1].t);
            const xVals = traj.map((p) => p.x);
            const xMin = Math.min(-10, Math.min(...xVals));
            const xMax = Math.max(20, Math.max(...xVals));

            const getPx = (t: number) => 40 + ((t - tMin) / (tMax - tMin)) * (w - 60);
            const getPy = (x: number) => h - 25 - ((x - xMin) / (xMax - xMin || 1)) * (h - 45);

            // Axes
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(40, 15);
            ctx.lineTo(40, h - 25);
            ctx.lineTo(w - 15, h - 25);
            ctx.stroke();

            // Zero line
            const zeroY = getPy(0);
            if (zeroY >= 15 && zeroY <= h - 25) {
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.moveTo(40, zeroY);
              ctx.lineTo(w - 15, zeroY);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.fillStyle = '#64748b';
              ctx.font = '9px monospace';
              ctx.fillText('x = 0', 10, zeroY + 3);
            }

            // Trajectory path
            ctx.strokeStyle = mode === 'isothermal_equilibrium' ? '#fbbf24' : '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            traj.forEach((pt, idx) => {
              const px = getPx(pt.t);
              const py = getPy(pt.x);
              if (idx === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.stroke();

            ctx.fillStyle = '#94a3b8';
            ctx.font = '9px monospace';
            ctx.fillText('時間 t (s)', w - 65, h - 8);
            ctx.fillText('位移 x (nm)', 45, 22);
          }
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [mode, temperature, atpRate, loadForce, potentialDepth]);

  // Derived metrics
  const mechanicalPowerAW = useMemo(() => {
    // P = F_load * velocity (pN * nm/s = 10^-12 N * 10^-9 m/s = 10^-21 W = 10^-3 aW)
    if (mode === 'isothermal_equilibrium' || metrics.velocity <= 0) return 0.0;
    return (loadForce * metrics.velocity).toFixed(1);
  }, [mode, loadForce, metrics.velocity]);

  return (
    <div className="my-8 rounded-2xl border border-mirari-line bg-white shadow-sm overflow-hidden font-sans">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 border-b border-mirari-line bg-mirari-surfaceAlt/30 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-700 font-mono">
              非平衡態統計物理 · 布朗棘輪模擬器
            </span>
          </div>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-mirari-ink mt-1">
            {modeInfo.title}
          </h3>
          <p className="text-xs text-mirari-muted mt-0.5 max-w-2xl">{modeInfo.desc}</p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex rounded-xl p-1 bg-mirari-paper border border-mirari-line text-xs font-medium">
          <button
            type="button"
            onClick={() => handleModeChange('isothermal_equilibrium')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              mode === 'isothermal_equilibrium'
                ? 'bg-amber-600 text-white font-semibold shadow-xs'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            等溫熱平衡 (淨位移=0)
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('atp_driven_flashing')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              mode === 'atp_driven_flashing'
                ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            ATP 驅動整流行走
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('high_load_stall')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              mode === 'high_load_stall'
                ? 'bg-rose-600 text-white font-semibold shadow-xs'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            極限負載失速阻滯
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* ─── Physical Viewport Canvas ───────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-mirari-ink">微觀微管軌道、非對稱勢阱 U(x) 與驅動蛋白步進實況</span>
            <span className="text-xs text-mirari-dim font-mono">
              單步步長: 8.0 nm (微管蛋白二聚體週期)
            </span>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 shadow-inner bg-slate-950">
            <canvas ref={canvasRef} width={680} height={230} className="w-full h-[200px] block" />
          </div>
        </div>

        {/* ─── Control Knobs Grid ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-mirari-line bg-mirari-paper/40">
          {/* Temperature Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">環境溫度 (Temperature)</span>
              <span className="font-mono text-amber-700 font-bold">{temperature} K</span>
            </div>
            <input
              type="range"
              min="100"
              max="450"
              step="10"
              value={temperature}
              onChange={(e) => setTemperature(parseInt(e.target.value, 10))}
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>低溫微弱熱噪</span>
              <span>高溫劇烈碰撞</span>
            </div>
          </div>

          {/* ATP Hydrolysis Rate */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">ATP 水解循環頻率</span>
              <span className="font-mono text-emerald-700 font-bold">
                {mode === 'isothermal_equilibrium' ? '0 (無能量注入)' : `${atpRate.toFixed(1)} Hz`}
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="8.0"
              step="0.5"
              disabled={mode === 'isothermal_equilibrium'}
              value={atpRate}
              onChange={(e) => setAtpRate(parseFloat(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer disabled:opacity-40"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>低頻率步進</span>
              <span>飽和高速水解</span>
            </div>
          </div>

          {/* Load Force */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">逆向負載拉力 (Load Force)</span>
              <span className="font-mono text-rose-600 font-bold">
                {mode === 'isothermal_equilibrium' ? '0.0 pN' : `${loadForce.toFixed(1)} pN`}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="8.0"
              step="0.2"
              disabled={mode === 'isothermal_equilibrium'}
              value={loadForce}
              onChange={(e) => setLoadForce(parseFloat(e.target.value))}
              className="w-full accent-rose-600 cursor-pointer disabled:opacity-40"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>無阻力前進</span>
              <span>失速極限 (~6.5 pN)</span>
            </div>
          </div>

          {/* Ratchet Asymmetric Potential Depth */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">棘輪勢阱深度 (ΔU / kBT)</span>
              <span className="font-mono text-cyan-700 font-bold">{potentialDepth}</span>
            </div>
            <input
              type="range"
              min="4"
              max="24"
              step="1"
              value={potentialDepth}
              onChange={(e) => setPotentialDepth(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>淺勢阱易越障</span>
              <span>深勢阱強束縛</span>
            </div>
          </div>
        </div>

        {/* ─── Trajectory Graph & Performance Metrics ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-mirari-ink">位移軌跡 x(t)：細緻平衡隨機游走 vs 定向整流斜率</span>
              <span className="text-xs text-mirari-dim font-mono">
                {mode === 'isothermal_equilibrium'
                  ? '〈x(t)〉 ≈ 0 (細緻平衡無定向淨功)'
                  : metrics.velocity > 0
                  ? `順向平均漂移速度: ${metrics.velocity.toFixed(1)} nm/s`
                  : `逆向拖曳失速中: ${metrics.velocity.toFixed(1)} nm/s`}
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner">
              <canvas ref={graphCanvasRef} width={500} height={140} className="w-full h-[120px] block" />
            </div>
          </div>

          {/* Real-time Dashboard Cards */}
          <div className="flex flex-col justify-between space-y-3">
            <div className="p-3.5 rounded-xl border border-mirari-line bg-mirari-paper/50">
              <span className="text-[10px] font-mono uppercase text-mirari-dim block">當前累計步數與位移</span>
              <div className="flex items-baseline space-x-2 mt-0.5">
                <span className="font-mono text-xl font-bold text-mirari-ink">
                  {metrics.pos.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-mirari-muted">nm ({metrics.steps} 步)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-mirari-line bg-mirari-paper/50">
              <span className="text-[10px] font-mono uppercase text-mirari-dim block">微觀輸出機械功率 (P = F·v)</span>
              <div className="flex items-baseline space-x-2 mt-0.5">
                <span className="font-mono text-xl font-bold text-emerald-700">
                  {mechanicalPowerAW}
                </span>
                <span className="text-xs font-mono text-mirari-muted">× 10⁻¹⁸ W (aW)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-mirari-line bg-mirari-paper/50">
              <span className="text-[10px] font-mono uppercase text-mirari-dim block">熱力學第二定律檢驗</span>
              <span
                className={`text-xs font-bold block mt-1 ${
                  mode === 'isothermal_equilibrium' ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {mode === 'isothermal_equilibrium'
                  ? '✓ 嚴格遵守：單一熱源無外功時無淨定向流'
                  : '✓ 化學能驅動：ATP 水解推動非平衡態穩態熵增'}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Scientific Caveat Box ──────────────────────────────── */}
        <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 space-y-1">
          <div className="flex items-center space-x-1.5 font-bold">
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>科學邊界與模型簡化說明：朗之萬方程與細緻平衡</span>
          </div>
          <p className="leading-relaxed text-amber-800">
            本模擬器基於一維過阻尼朗之萬動力學（Overdamped Langevin Dynamics），採用經典閃爍棘輪（Flashing Ratchet）機制示範熱平衡細緻平衡之不可逾越性與非平衡態定向做功。真實細胞內的驅動蛋白（Kinesin）具有雙頭協同「手搭手」（Hand-over-hand）行進構造，每消耗一個 ATP 邁出一個 8 nm 步長，能量轉換效率高達 50-60%，其內部構象變化涉及更複雜的多維自由能曲面。
          </p>
        </div>
      </div>
    </div>
  );
};
