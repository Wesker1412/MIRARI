import React, { useState, useEffect, useRef, useMemo } from 'react';

type FlowRegime = 'laminar_weak' | 'fully_developed' | 'energy_burst';

export const TurbulenceCascadeSimulator: React.FC = () => {
  const [regime, setRegime] = useState<FlowRegime>('fully_developed');
  const [reynoldsNumber, setReynoldsNumber] = useState<number>(12000); // 200 to 50000
  const [energyInjectionRate, setEnergyInjectionRate] = useState<number>(2.5); // epsilon: m^2/s^3 (0.5 to 10)
  const [viscosityExp, setViscosityExp] = useState<number>(-5); // nu = 10^viscosityExp m^2/s (-6 to -3)

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);

  // Physical Kolmogorov calculations
  const kinematicViscosity = useMemo(() => Math.pow(10, viscosityExp), [viscosityExp]);
  
  // Kolmogorov microscale: eta = (nu^3 / epsilon)^(1/4)
  const kolmogorovEta = useMemo(() => {
    const val = Math.pow(Math.pow(kinematicViscosity, 3) / energyInjectionRate, 0.25);
    return val; // in meters
  }, [kinematicViscosity, energyInjectionRate]);

  // Kolmogorov dissipation wavenumber: k_eta = 1 / eta
  const kolmogorovKEta = useMemo(() => {
    return 1.0 / kolmogorovEta; // in 1/m
  }, [kolmogorovEta]);

  // Integral large eddy scale L = eta * Re^(3/4)
  const integralScaleL = useMemo(() => {
    return kolmogorovEta * Math.pow(reynoldsNumber, 0.75);
  }, [kolmogorovEta, reynoldsNumber]);

  // Decades of inertial subrange: log10(k_eta / k_0) = (3/4) * log10(Re)
  const inertialDecades = useMemo(() => {
    return ((3 / 4) * Math.log10(Math.max(10, reynoldsNumber))).toFixed(1);
  }, [reynoldsNumber]);

  // Regime configuration
  const handleRegimeChange = (newRegime: FlowRegime) => {
    setRegime(newRegime);
    if (newRegime === 'laminar_weak') {
      setReynoldsNumber(350);
      setEnergyInjectionRate(0.8);
      setViscosityExp(-4);
    } else if (newRegime === 'fully_developed') {
      setReynoldsNumber(15000);
      setEnergyInjectionRate(3.0);
      setViscosityExp(-5);
    } else {
      setReynoldsNumber(45000);
      setEnergyInjectionRate(9.0);
      setViscosityExp(-6);
    }
  };

  // ─── Vortex Particles Simulation for 2D Canvas ───────────────────
  const particlesRef = useRef<
    { x: number; y: number; vx: number; vy: number; radius: number; life: number; color: string }[]
  >([]);

  useEffect(() => {
    // Initialize multi-scale vortex particles
    const pts = [];
    const count = 180;
    for (let i = 0; i < count; i++) {
      pts.push({
        x: Math.random() * 640,
        y: Math.random() * 240,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        radius: Math.random() > 0.85 ? Math.random() * 35 + 20 : Math.random() * 12 + 4,
        life: Math.random(),
        color: Math.random() > 0.5 ? '#38bdf8' : '#f59e0b',
      });
    }
    particlesRef.current = pts;
  }, []);

  // Real-time animation loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(0.04, (time - lastTime) / 1000);
      lastTime = time;

      // Update particle positions in simulated multi-scale vortex velocity field
      const particles = particlesRef.current;
      const w = 640;
      const h = 240;

      // Turbulent velocity scale U ~ (epsilon * L)^(1/3)
      const uTurb = Math.pow(energyInjectionRate * Math.max(0.1, integralScaleL), 1 / 3) * 15;

      particles.forEach((p) => {
        // Multi-frequency stream function: psi(x,y) = sum A_n * sin(k_n x) * cos(k_n y)
        const kLarge = 0.01;
        const kMedium = 0.035;
        const kSmall = Math.min(0.12, 0.02 + Math.log10(reynoldsNumber) * 0.02);

        // Compute local velocity from curl of stream function
        const vx1 = Math.cos(kLarge * p.y + time * 0.001) * uTurb;
        const vy1 = -Math.sin(kLarge * p.x + time * 0.001) * uTurb;

        const vx2 = Math.cos(kMedium * p.y * 1.5 - time * 0.002) * (uTurb * 0.55);
        const vy2 = -Math.sin(kMedium * p.x * 1.5 + time * 0.002) * (uTurb * 0.55);

        const vx3 = Math.cos(kSmall * p.y * 2.5 + time * 0.004) * (uTurb * 0.28);
        const vy3 = -Math.sin(kSmall * p.x * 2.5 - time * 0.004) * (uTurb * 0.28);

        // Total advective velocity
        p.vx = vx1 + vx2 + vx3;
        p.vy = vy1 + vy2 + vy3;

        p.x = (p.x + p.vx * dt + w) % w;
        p.y = (p.y + p.vy * dt + h) % h;
        p.life += dt * 0.5;
        if (p.life > 1) p.life = 0;
      });

      // ─── Render Vorticity Canvas ─────────────────────────────────
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#070b14';
          ctx.fillRect(0, 0, w, h);

          // Background turbulence energy fog
          const grad = ctx.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, 'rgba(14, 116, 144, 0.08)');
          grad.addColorStop(0.5, 'rgba(180, 83, 9, 0.08)');
          grad.addColorStop(1, 'rgba(6, 78, 59, 0.08)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);

          // Draw large-scale injection eddies
          const tSec = time * 0.0008;
          const largeWhirlCenters = [
            { x: w * 0.25 + Math.sin(tSec) * 30, y: h * 0.45 + Math.cos(tSec) * 20, r: 55, dir: 1 },
            { x: w * 0.7 + Math.cos(tSec) * 25, y: h * 0.55 - Math.sin(tSec) * 20, r: 65, dir: -1 },
          ];

          largeWhirlCenters.forEach((whirl) => {
            ctx.strokeStyle = whirl.dir > 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(245, 158, 11, 0.25)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(whirl.x, whirl.y, whirl.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Direction arrow
            ctx.fillStyle = whirl.dir > 0 ? '#38bdf8' : '#f59e0b';
            ctx.font = '9px monospace';
            ctx.fillText(
              whirl.dir > 0 ? '大尺度能量注入渦旋 L ↻' : '大尺度反轉渦旋 L ↺',
              whirl.x - 45,
              whirl.y - whirl.r - 4
            );
          });

          // Draw multi-scale vortex filament particles
          particles.forEach((p) => {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = Math.max(0.8, p.radius * 0.1);
            ctx.globalAlpha = Math.max(0.15, 1 - p.life);

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * (0.6 + 0.4 * (1 - p.life)), 0, Math.PI * 1.5);
            ctx.stroke();

            // Core center
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.globalAlpha = 1.0;

          // Annotations
          ctx.fillStyle = '#94a3b8';
          ctx.font = '10px monospace';
          ctx.fillText(`多尺度渦旋示意流場（合成模型） | 雷諾數 Re = ${reynoldsNumber.toLocaleString()}`, 16, 22);
          ctx.fillText(
            `能量耗散率 ε = ${energyInjectionRate.toFixed(1)} m²/s³ | 耗散微尺度 η = ${(kolmogorovEta * 1000).toFixed(2)} mm`,
            16,
            h - 12
          );
        }
      }

      // ─── Render Energy Spectrum E(k) Log-Log Canvas ─────────────
      const specCanvas = spectrumCanvasRef.current;
      if (specCanvas) {
        const sCtx = specCanvas.getContext('2d');
        if (sCtx) {
          const sw = specCanvas.width;
          const sh = specCanvas.height;
          sCtx.clearRect(0, 0, sw, sh);

          sCtx.fillStyle = '#090d16';
          sCtx.fillRect(0, 0, sw, sh);

          // Grid coordinates
          sCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          sCtx.lineWidth = 1;
          for (let gx = 50; gx < sw - 20; gx += 50) {
            sCtx.beginPath();
            sCtx.moveTo(gx, 20);
            sCtx.lineTo(gx, sh - 30);
            sCtx.stroke();
          }
          for (let gy = 20; gy < sh - 30; gy += 30) {
            sCtx.beginPath();
            sCtx.moveTo(50, gy);
            sCtx.lineTo(sw - 20, gy);
            sCtx.stroke();
          }

          // Draw Theoretical Kolmogorov -5/3 Slope Line: E(k) = C_K * epsilon^(2/3) * k^(-5/3)
          sCtx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
          sCtx.lineWidth = 1.5;
          sCtx.setLineDash([4, 4]);

          // Reference -5/3 line
          const refStartX = 110;
          const refStartY = 50;
          const refEndX = sw - 120;
          // slope deltaY = (5/3) * (deltaX_log)
          const refEndY = refStartY + (refEndX - refStartX) * 0.52;
          sCtx.beginPath();
          sCtx.moveTo(refStartX, refStartY);
          sCtx.lineTo(refEndX, refEndY);
          sCtx.stroke();
          sCtx.setLineDash([]);

          sCtx.fillStyle = '#f59e0b';
          sCtx.font = '10px monospace';
          sCtx.fillText('理論柯爾莫哥洛夫 -5/3 冪律斜率 (Inertial Subrange)', refStartX + 10, refStartY - 6);

          // Draw Simulated Dynamic Energy Spectrum Curve
          sCtx.strokeStyle = '#38bdf8';
          sCtx.lineWidth = 2.5;
          sCtx.beginPath();

          const kMinLog = 0.5; // log10(k)
          const kMaxLog = 4.5;
          const kEtaLog = Math.log10(Math.max(10, kolmogorovKEta));

          for (let px = 50; px <= sw - 25; px += 3) {
            const fracX = (px - 50) / (sw - 75);
            const kLog = kMinLog + fracX * (kMaxLog - kMinLog);
            const kVal = Math.pow(10, kLog);

            // Energy spectrum shape:
            // 1. Energy-containing range: rises as k^2 to peak at k_0
            // 2. Inertial subrange: E ~ k^(-5/3)
            // 3. Viscous dissipation: exp(-beta * k / k_eta)
            const k0 = 1.0 / Math.max(0.01, integralScaleL);
            const peakFactor = Math.pow(kVal / k0, 2) / (1 + Math.pow(kVal / k0, 2 + 5 / 3));
            const dissipationFactor = Math.exp(-Math.pow(kVal / kolmogorovKEta, 1.5) * 2.2);

            // Amplitude scaled by epsilon^(2/3)
            const logE =
              Math.log10(Math.pow(energyInjectionRate, 2 / 3) * 100 * peakFactor * dissipationFactor + 1e-12);

            // Map logE to Y (range from 2.0 to -6.0)
            const py = sh - 35 - ((logE + 6) / 8.5) * (sh - 60);
            const clampedPy = Math.max(20, Math.min(sh - 32, py));

            if (px === 50) sCtx.moveTo(px, clampedPy);
            else sCtx.lineTo(px, clampedPy);
          }
          sCtx.stroke();

          // Mark Kolmogorov wavenumber k_eta position
          const kEtaPx = 50 + ((kEtaLog - kMinLog) / (kMaxLog - kMinLog)) * (sw - 75);
          if (kEtaPx >= 50 && kEtaPx <= sw - 25) {
            sCtx.strokeStyle = '#ef4444';
            sCtx.lineWidth = 1.5;
            sCtx.beginPath();
            sCtx.moveTo(kEtaPx, 20);
            sCtx.lineTo(kEtaPx, sh - 30);
            sCtx.stroke();
            sCtx.fillStyle = '#ef4444';
            sCtx.font = '9px monospace';
            sCtx.fillText('耗散截止 k_η', kEtaPx - 25, sh - 38);
          }

          // Axis labels
          sCtx.fillStyle = '#94a3b8';
          sCtx.font = '10px monospace';
          sCtx.fillText('log₁₀ k (空間波數 1/m)', sw - 145, sh - 10);
          sCtx.fillText('log₁₀ E(k) (動能譜密度 m³/s²)', 10, 16);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [energyInjectionRate, reynoldsNumber, kolmogorovEta, kolmogorovKEta, integralScaleL]);

  return (
    <div className="my-8 rounded-2xl border border-mirari-line bg-white shadow-sm overflow-hidden font-sans">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 border-b border-mirari-line bg-mirari-surfaceAlt/30 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs uppercase tracking-wider font-semibold text-mirari-amber font-mono">
              流體動力學 · 柯爾莫哥洛夫能譜模擬器
            </span>
          </div>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-mirari-ink mt-1">
            湍流能量串級：大尺度注入、慣性子區 -5/3 冪律與微觀黏滯耗散
          </h3>
          <p className="text-xs text-mirari-muted mt-0.5">
            理查森級聯之數學實體化：能量自低波數注入，無黏滯耗散地逐級粉碎傳遞，直至微觀尺度轉化為熱能
          </p>
        </div>

        {/* Regime Selector */}
        <div className="flex rounded-xl p-1 bg-mirari-paper border border-mirari-line text-xs font-medium">
          <button
            type="button"
            onClick={() => handleRegimeChange('laminar_weak')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              regime === 'laminar_weak'
                ? 'bg-amber-600 text-white font-semibold shadow-xs'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            低雷諾數層流 (Re ~ 350)
          </button>
          <button
            type="button"
            onClick={() => handleRegimeChange('fully_developed')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              regime === 'fully_developed'
                ? 'bg-mirari-ink text-white font-semibold shadow-xs'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            完全發展湍流 (Re ~ 15,000)
          </button>
          <button
            type="button"
            onClick={() => handleRegimeChange('energy_burst')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              regime === 'energy_burst'
                ? 'bg-rose-600 text-white font-semibold shadow-xs'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            暴風級高能量注入
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* ─── Dual Canvas Viewports ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Viewport 1: Vorticity Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-mirari-ink">空間幾何：多尺度合成渦旋示意模型</span>
              <span className="text-[10px] text-mirari-dim font-mono">
                積分尺度 L ≈ {(integralScaleL * 100).toFixed(1)} cm
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
              <canvas ref={canvasRef} width={640} height={240} className="w-full h-[220px] block" />
            </div>
          </div>

          {/* Viewport 2: Power Spectrum E(k) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-mirari-ink">頻譜空間：K41 理論能譜示意曲線（非流場即時數值解算）</span>
              <span className="text-[10px] text-amber-700 font-mono font-bold">
                E(k) ∝ ε²/³ · k⁻⁵/³
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
              <canvas ref={spectrumCanvasRef} width={640} height={240} className="w-full h-[220px] block" />
            </div>
          </div>
        </div>

        {/* ─── Control Knobs ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-mirari-line bg-mirari-paper/40">
          {/* Reynolds Number Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">雷諾數 (Reynolds Number Re)</span>
              <span className="font-mono text-mirari-amber font-bold">{reynoldsNumber.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="300"
              max="50000"
              step="500"
              value={reynoldsNumber}
              onChange={(e) => setReynoldsNumber(parseInt(e.target.value, 10))}
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>低 Re (黏滯主導)</span>
              <span>高 Re (無黏性慣性子區廣)</span>
            </div>
          </div>

          {/* Energy Injection Rate Epsilon */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">能量注入率 / 串級傳遞率 ε</span>
              <span className="font-mono text-emerald-700 font-bold">{energyInjectionRate.toFixed(1)} m²/s³</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="10.0"
              step="0.5"
              value={energyInjectionRate}
              onChange={(e) => setEnergyInjectionRate(parseFloat(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>微弱擾動</span>
              <span>劇烈機械攪拌</span>
            </div>
          </div>

          {/* Kinematic Viscosity Nu */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">運動黏滯係數 ν (Kinematic Viscosity)</span>
              <span className="font-mono text-cyan-700 font-bold">10^{viscosityExp} m²/s</span>
            </div>
            <input
              type="range"
              min="-6"
              max="-3"
              step="0.2"
              value={viscosityExp}
              onChange={(e) => setViscosityExp(parseFloat(e.target.value))}
              className="w-full accent-cyan-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>極低黏滯 (水/大氣)</span>
              <span>高黏滯 (甘油/糖漿)</span>
            </div>
          </div>
        </div>

        {/* ─── Quantitative Dashboard Cards ───────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-mirari-line bg-mirari-paper/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-mirari-dim block">柯爾莫哥洛夫微觀耗散尺度 η</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-mono text-2xl font-bold text-amber-600">
                {(kolmogorovEta * 1000).toFixed(2)}
              </span>
              <span className="text-xs font-mono text-mirari-muted">mm (毫米)</span>
            </div>
            <span className="text-[11px] text-mirari-muted block leading-tight font-mono">
              η = (ν³ / ε)¹/⁴ · 動能直接轉化為分子熱動能的尺度
            </span>
          </div>

          <div className="p-4 rounded-xl border border-mirari-line bg-mirari-paper/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-mirari-dim block">慣性子區寬度 (跨越數量級)</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-mono text-2xl font-bold text-emerald-700">
                {inertialDecades}
              </span>
              <span className="text-xs font-mono text-mirari-muted">個十年 (Decades)</span>
            </div>
            <span className="text-[11px] text-mirari-muted block leading-tight font-mono">
              Δ(log k) ≈ 0.75 · log₁₀(Re) · 尺度無關能量守恆傳遞
            </span>
          </div>

          <div className="p-4 rounded-xl border border-mirari-line bg-mirari-paper/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-mirari-dim block">耗散截止截止波數 k_η</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-mono text-2xl font-bold text-cyan-700">
                {Math.round(kolmogorovKEta).toLocaleString()}
              </span>
              <span className="text-xs font-mono text-mirari-muted">m⁻¹</span>
            </div>
            <span className="text-[11px] text-mirari-muted block leading-tight font-mono">
              k_η = 1 / η · 黏滯效應切斷能量級聯的高波數臨界
            </span>
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
            <span>科學邊界與模型簡化說明：K41 理論與間歇性修正</span>
          </div>
          <p className="leading-relaxed text-amber-800">
            本模擬器為教育視覺化示意模型，左側流場採用多頻流函數疊加示意多尺度渦旋，右側為 K41 理論能譜解析曲線，非直接解算三維 Navier-Stokes 方程。特別注意：真實三維湍流依賴渦旋拉伸產生由大到小的正向能量串級（k⁻⁵/³）；而在純二維流體中，由於缺乏渦旋拉伸且渦量平方（Enstrophy）守恆，會產生能量向大尺度的逆向串級與向小尺度的渦量平方串級（Kraichnan 1967）。在真實三維極端高雷諾數流動中，亦存在空間「間歇性效應」，使真實指數微偏離 -5/3。
          </p>
        </div>
      </div>
    </div>
  );
};
