import React, { useState, useEffect, useRef, useMemo } from 'react';

type ClockType = 'thorium_nuclear' | 'strontium_atomic';

export const NuclearClockSimulator: React.FC = () => {
  const [clockType, setClockType] = useState<ClockType>('thorium_nuclear');
  const [feedbackEnabled, setFeedbackEnabled] = useState<boolean>(true);
  const [feedbackGain, setFeedbackGain] = useState<number>(1.2); // 0.2 to 3.0
  const [magneticPerturbation, setMagneticPerturbation] = useState<boolean>(false);
  const [laserDriftRate, setLaserDriftRate] = useState<number>(0.8); // 0.1 to 2.5
  
  // Real-time dynamic state
  const [currentDetuning, setCurrentDetuning] = useState<number>(0.0); // MHz offset
  const [laserPhaseError, setLaserPhaseError] = useState<number>(0.0);

  const scopeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Clock physical specifications
  const specs = useMemo(() => {
    if (clockType === 'thorium_nuclear') {
      return {
        nameZh: '釷-229 固態核時鐘 (Thorium-229 Nuclear Clock)',
        transitionNature: '原子核同質異能躍遷 (Nuclear Isomer)',
        carrierParticle: '核子 (質子/中子) 空間分佈',
        scaleMeters: '10⁻¹⁵ m (飛米量級，原子核內部)',
        resonanceFrequencyThz: 2020.4, // ~8.36 eV (148.4 nm VUV)
        linewidhkHz: 10.0, // Narrow resonance in CaF2 crystal
        bFieldSensitivity: '極低 (核磁矩比電子磁矩小 ~1000 倍)',
        measuredUncertainty: '約 10⁻¹³ ~ 10⁻¹⁴ (Nature 2026 原型實測)',
        theoreticalPotential: '10⁻¹⁹ (固態高密度、極低環境微擾)',
        description:
          '雷射直接激發固態氟化鈣 (CaF₂) 晶體中摻雜的釷-229 原子核。原子核深藏於電子雲內，對外部雜散電磁場與黑體輻射極度不敏感。',
      };
    } else {
      return {
        nameZh: '鍶-87 光學晶格原子鐘 (Strontium-87 Optical Clock)',
        transitionNature: '最外層電子軌域躍遷 (Electronic Shell)',
        carrierParticle: '原子價電子雲 (Valence Electron)',
        scaleMeters: '10⁻¹⁰ m (埃量級，外層電子軌道)',
        resonanceFrequencyThz: 429.2, // ~698 nm (紅光)
        linewidhkHz: 1.0, // Ultra-narrow clock transition
        bFieldSensitivity: '顯著 (電子雲易受黑體輻射 Stark 效應干擾)',
        measuredUncertainty: '10⁻¹⁸ ~ 10⁻¹⁹ (現役世界最高精度標準)',
        theoreticalPotential: '10⁻¹⁸ (受真空腔黑體輻射溫控極限限制)',
        description:
          '將超冷鍶原子禁錮於光學晶格中，利用窄線寬雷射鎖定最外層電子的禁戒躍遷，為當前人類實測時間精度的巔峰標準。',
      };
    }
  }, [clockType]);

  // Real-time Feedback Loop Simulation
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      setCurrentDetuning((prev) => {
        // Natural thermal/environmental laser frequency drift
        const noiseWalk = (Math.random() - 0.5) * laserDriftRate * 2.0;
        
        // External magnetic interference
        const bFieldShift = magneticPerturbation
          ? clockType === 'strontium_atomic'
            ? 3.2 // High sensitivity for atomic electron shell
            : 0.15 // Protected nuclear moment (suppressed by factor of ~20x)
          : 0;

        let nextDetuning = prev + noiseWalk * dt + bFieldShift * dt * 0.5;

        // Feedback error correction: Error signal S = -detuning / (1 + detuning^2)
        if (feedbackEnabled) {
          const errorSignal = -nextDetuning / (1 + Math.pow(nextDetuning / 2.0, 2));
          const correction = errorSignal * feedbackGain * 4.0 * dt;
          nextDetuning += correction;
        }

        setLaserPhaseError(Math.abs(nextDetuning));
        return nextDetuning;
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [feedbackEnabled, feedbackGain, magneticPerturbation, laserDriftRate, clockType]);

  // Fractional frequency instability proxy = (laserPhaseError / resonanceFrequency)
  const fractionalInstability = useMemo(() => {
    const baseInstability = clockType === 'strontium_atomic' ? 2e-18 : 8e-14;
    const feedbackFactor = feedbackEnabled ? 1.0 / (1.0 + feedbackGain * 5.0) : 15.0;
    const noiseFactor = 1.0 + laserPhaseError * 0.4;
    return (baseInstability * feedbackFactor * noiseFactor).toExponential(2);
  }, [clockType, feedbackEnabled, feedbackGain, laserPhaseError]);

  // ─── Scope Visualization (Resonance & Error Signal) ─────────────
  useEffect(() => {
    const canvas = scopeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark high-tech oscilloscope background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Coordinate grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
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

    const midX = w / 2;
    const midY = h / 2;

    // Center zero axis
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(midX, 20);
    ctx.lineTo(midX, h - 25);
    ctx.moveTo(30, midY);
    ctx.lineTo(w - 30, midY);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.fillText('共振中心 (Δν = 0)', midX - 38, h - 10);
    ctx.fillText('-Δν', 35, midY - 6);
    ctx.fillText('+Δν (失諧頻率)', w - 85, midY - 6);

    // 1. Draw Lorentzian Absorption Profile: L(x) = 1 / (1 + x^2)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const gamma = clockType === 'thorium_nuclear' ? 45 : 30; // resonance width in pixels
    for (let px = 30; px <= w - 30; px++) {
      const deltaX = (px - midX) / gamma;
      const lorentzian = 1 / (1 + deltaX * deltaX);
      const py = midY - lorentzian * (h * 0.38);
      if (px === 30) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('光學吸收譜線 (Lorentzian Profile)', 40, 30);

    // 2. Draw Dispersive Feedback Error Signal: S(x) = -x / (1 + x^2)
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 30; px <= w - 30; px++) {
      const deltaX = (px - midX) / gamma;
      const errorSignal = -deltaX / (1 + deltaX * deltaX);
      const py = midY - errorSignal * (h * 0.3);
      if (px === 30) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('回饋鑑頻誤差信號 S(Δν)', w - 170, 30);

    // 3. Current Laser Frequency Spot
    const laserPixelX = midX + (currentDetuning / 2.0) * gamma;
    const clampedX = Math.max(35, Math.min(w - 35, laserPixelX));

    // Vertical cursor
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(clampedX, 25);
    ctx.lineTo(clampedX, h - 25);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glow dot
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(clampedX, midY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Laser position readout
    ctx.fillStyle = '#ef4444';
    ctx.font = '10px monospace';
    ctx.fillText(
      `雷射瞬時失諧: ${currentDetuning >= 0 ? '+' : ''}${currentDetuning.toFixed(2)} MHz`,
      clampedX + 8,
      midY - 14
    );
  }, [currentDetuning, clockType]);

  return (
    <div className="my-8 rounded-2xl border border-mirari-line bg-white shadow-sm overflow-hidden font-sans">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 border-b border-mirari-line bg-mirari-surfaceAlt/30 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs uppercase tracking-wider font-semibold text-mirari-amber font-mono">
              Nature · 2026 前沿研究解讀模型
            </span>
          </div>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-mirari-ink mt-1">
            釷-229 光學核時鐘：同質異能共振與雷射鎖定閉環實驗
          </h3>
          <p className="text-xs text-mirari-muted mt-0.5">
            比較原子外層電子雲躍遷與原子核內部躍遷之物理尺度、環境抗噪能力與雷射回饋校正
          </p>
        </div>

        {/* Clock Selector Tabs */}
        <div className="flex rounded-xl p-1 bg-mirari-paper border border-mirari-line text-xs font-medium">
          <button
            type="button"
            onClick={() => setClockType('thorium_nuclear')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              clockType === 'thorium_nuclear'
                ? 'bg-amber-600 text-white font-semibold shadow-xs'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            釷-229 固態核時鐘
          </button>
          <button
            type="button"
            onClick={() => setClockType('strontium_atomic')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              clockType === 'strontium_atomic'
                ? 'bg-mirari-ink text-white font-semibold shadow-xs'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            鍶-87 光學原子鐘
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* ─── Physical Mechanism Comparison Grid ─────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-mirari-line bg-mirari-paper/40">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-mirari-dim block">躍遷物理本質</span>
            <span className="text-xs font-bold text-mirari-ink block">{specs.transitionNature}</span>
            <span className="text-[11px] text-mirari-muted block leading-tight font-mono">
              載體空間尺度: {specs.scaleMeters}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-mirari-dim block">時鐘躍遷頻率</span>
            <div className="flex items-baseline space-x-1">
              <span className="font-mono text-lg font-bold text-amber-600">
                {specs.resonanceFrequencyThz}
              </span>
              <span className="text-[10px] font-mono text-mirari-dim">THz (兆赫)</span>
            </div>
            <span className="text-[11px] text-mirari-muted block leading-tight">
              {clockType === 'thorium_nuclear' ? '真空紫外光 (VUV, 148 nm)' : '光學紅光 (698 nm)'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-mirari-dim block">環境磁場與熱干擾敏感度</span>
            <span
              className={`text-xs font-bold block ${
                clockType === 'thorium_nuclear' ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {specs.bFieldSensitivity}
            </span>
            <span className="text-[11px] text-mirari-muted block leading-tight">
              {clockType === 'thorium_nuclear' ? '電子雲提供天然屏蔽層' : '電子雲大易受外界極化'}
            </span>
          </div>
        </div>

        {/* ─── Feedback Loop Controls ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-mirari-line bg-white shadow-xs">
          {/* Feedback Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-mirari-ink block">雷射鑑頻回饋鎖定閉環 (Feedback Loop)</label>
            <button
              type="button"
              onClick={() => setFeedbackEnabled((prev) => !prev)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                feedbackEnabled
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 border border-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${feedbackEnabled ? 'bg-white' : 'bg-slate-400'}`} />
              <span>{feedbackEnabled ? '✓ 鎖定迴路運作中' : '關閉回饋 (自由漂移)'}</span>
            </button>
          </div>

          {/* Feedback Gain */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">回饋校正增益 (Gain)</span>
              <span className="font-mono text-mirari-amber font-bold">{feedbackGain.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.1"
              disabled={!feedbackEnabled}
              value={feedbackGain}
              onChange={(e) => setFeedbackGain(parseFloat(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer disabled:opacity-40"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>弱阻尼</span>
              <span>強阻尼抑制</span>
            </div>
          </div>

          {/* Laser Drift Rate */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">雷射腔體本底熱漂移強度</span>
              <span className="font-mono text-cyan-600 font-bold">{laserDriftRate.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.1"
              value={laserDriftRate}
              onChange={(e) => setLaserDriftRate(parseFloat(e.target.value))}
              className="w-full accent-cyan-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>極低擾動</span>
              <span>劇烈熱漂移</span>
            </div>
          </div>

          {/* Magnetic Noise Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-mirari-ink block">外部雜散環境干擾測試 (Stray B-field)</label>
            <button
              type="button"
              onClick={() => setMagneticPerturbation((prev) => !prev)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                magneticPerturbation
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-mirari-paper border border-mirari-line text-mirari-muted hover:text-mirari-ink'
              }`}
            >
              <span>{magneticPerturbation ? '⚠️ 注入強雜散磁場干擾' : '正常低噪實驗室環境'}</span>
            </button>
          </div>
        </div>

        {/* ─── Oscilloscope Canvas View ───────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-mirari-ink">
              鑑頻器譜線、誤差信號 S(Δν) 與雷射瞬時鎖定狀態
            </span>
            <span className="text-xs text-mirari-dim font-mono">
              {feedbackEnabled ? '零交叉點閉環伺服控制中' : '無回饋控制，雷射中心持續漂移'}
            </span>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 shadow-inner bg-slate-900">
            <canvas ref={scopeCanvasRef} width={640} height={260} className="w-full h-[220px] block" />
          </div>
        </div>

        {/* ─── Precision & Status Dashboard ───────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-mirari-line bg-mirari-paper/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-mirari-dim block">當前瞬時相對頻率不穩定度</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-mono text-2xl font-bold text-amber-600">
                {fractionalInstability}
              </span>
              <span className="text-xs text-mirari-dim font-mono">Δf / f₀</span>
            </div>
            <p className="text-[11px] text-mirari-muted leading-tight">
              鑑頻誤差與迴路伺服校正計算之等效艾倫方差 (Allan deviation proxy)
            </p>
          </div>

          <div className="p-4 rounded-xl border border-mirari-line bg-mirari-paper/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-mirari-dim block">科學界已實測達到的精度</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-mono text-xl font-bold text-mirari-ink">
                {specs.measuredUncertainty}
              </span>
            </div>
            <p className="text-[11px] text-mirari-muted leading-tight">
              {clockType === 'thorium_nuclear'
                ? 'Nature 2026 首次實現固態晶體雷射共振反饋閉環'
                : '現役各國國家計量院最高標準，精準保持領先地位'}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-mirari-line bg-mirari-paper/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-mirari-dim block">未來長遠發展潛力</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-mono text-xl font-bold text-emerald-700">
                {specs.theoreticalPotential}
              </span>
            </div>
            <p className="text-[11px] text-mirari-muted leading-tight">
              {clockType === 'thorium_nuclear'
                ? '固態緊湊型封裝、可攜帶性、暗物質時空微擾超敏探測'
                : '大型超高真空低溫腔體，作為基準原器'}
            </p>
          </div>
        </div>

        {/* ─── Scientific Caveat Box ──────────────────────────────── */}
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-950 text-xs space-y-1.5">
          <div className="flex items-center space-x-1.5 font-semibold">
            <svg className="w-4 h-4 text-amber-700 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>科學查核與邊界限制說明</span>
          </div>
          <p className="leading-relaxed text-amber-900/90">
            本互動組件依據 <em>Nature</em> 2026 年 10 月發表的兩項關鍵突破（DOI: 10.1038/s41586-026-11084-4 與 DOI: 10.1038/s41586-026-11122-1）建構。論文報導了在室溫氟化鈣晶體中實現釷-229 光學核時鐘的反饋鎖定，並完成核時鐘與鍶原子時鐘的頻率比值測量。
            請嚴格區分：<strong>論文實測達成的核時鐘不確定度約在 10⁻¹³ ~ 10⁻¹⁴ 數量級，這是一項重大的概念驗證里程碑，但現階段世界上最精準的計時原器仍為光學晶格鍶/鐿原子時鐘（實測精度達 10⁻¹⁸ ~ 10⁻¹⁹）</strong>；核時鐘未來超越原子時鐘之潛力（如 10⁻¹⁹ 固態超穩度）仍屬理論目標，尚未於現階段全面超越。
          </p>
        </div>
      </div>
    </div>
  );
};
