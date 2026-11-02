import React, { useState, useEffect, useRef, useMemo } from 'react';

type MaterialMechanism = 'direct' | 'indirect' | 'pseudo_direct';

interface MechanismConfig {
  id: MaterialMechanism;
  nameZh: string;
  materialExample: string;
  bandgap: number; // eV
  absorptionCoeff: number; // 10^4 cm^-1
  bimolecularB: number; // relative recombination rate factor
  descriptionZh: string;
}

export const PhotovoltaicRecombinationSimulator: React.FC = () => {
  const [mechanism, setMechanism] = useState<MaterialMechanism>('pseudo_direct');
  const [lightIntensity, setLightIntensity] = useState<number>(1.0); // 0.2 to 2.5 Suns
  const [defectDensityLog, setDefectDensityLog] = useState<number>(15.0); // 10^14 to 10^17 cm^-3
  const [activeTab, setActiveTab] = useState<'band' | 'decay'>('band');

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const configs: Record<MaterialMechanism, MechanismConfig> = useMemo(
    () => ({
      direct: {
        id: 'direct',
        nameZh: '標準直接能隙 (Direct)',
        materialExample: '如 GaAs、金屬鹵化物鈣鈦礦',
        bandgap: 1.42,
        absorptionCoeff: 12.0, // strong
        bimolecularB: 1.0, // fast
        descriptionZh: '導帶底與價帶頂處於相同晶體動量 (k=0)，光子垂直躍遷吸收極強，但電子與電洞直接碰撞復合速度亦極快。',
      },
      indirect: {
        id: 'indirect',
        nameZh: '標準間接能隙 (Indirect)',
        materialExample: '如 單晶矽 (c-Si)',
        bandgap: 1.12,
        absorptionCoeff: 0.15, // weak, needs phonons
        bimolecularB: 0.005, // very slow
        descriptionZh: '能帶極值在動量空間錯開，吸收需要聲子輔助參與動量守恆，吸收極弱需厚材料，但載子壽命極長。',
      },
      pseudo_direct: {
        id: 'pseudo_direct',
        nameZh: '硫化鉍擬直接能隙 (Bi₂S₃ Pseudo-Direct)',
        materialExample: 'Nature 2026 硫化鉍突破機制',
        bandgap: 1.35,
        absorptionCoeff: 10.5, // strong optical absorption
        bimolecularB: 0.04, // substantially suppressed recombination
        descriptionZh: '垂直光學躍遷能隙產生媲美直接半導體的超強光吸收；載子隨後快速弛豫至鄰近動量極小值，阻隔了直接輻射復合路徑。',
      },
    }),
    []
  );

  const currentConfig = configs[mechanism];

  // Quantitative Physics Computations
  // Minority carrier lifetime tau: 1 / tau = B * n + Trap_SRH
  const currentDefectDensity = Math.pow(10, defectDensityLog);
  const srhRate = (currentDefectDensity / 1e15) * 0.002; // relative Shockley-Read-Hall trap rate
  const radRate = currentConfig.bimolecularB * lightIntensity * 0.02;
  const totalRecombRate = Math.max(0.0001, radRate + srhRate);
  
  // Lifetime in nanoseconds
  const carrierLifetimeNs = Math.round(1 / totalRecombRate);
  
  // Diffusion length L_D = sqrt(D * tau) in microns (D assumed ~ 0.5 cm^2/s)
  const diffusionLengthUm = parseFloat(
    Math.sqrt(0.5 * (carrierLifetimeNs * 1e-9) * 1e8).toFixed(2)
  );

  // Optical absorption depth 1 / alpha (in nanometers)
  const absorptionDepthNm = Math.round((1 / (currentConfig.absorptionCoeff * 1e4)) * 1e7);

  // Photovoltaic collection efficiency proxy = L_D / (L_D + 1/alpha)
  const collectionEfficiencyPercent = Math.min(
    95,
    Math.round((diffusionLengthUm * 1000 / (diffusionLengthUm * 1000 + absorptionDepthNm)) * 100)
  );

  // ─── Canvas Animation Loop (Band Diagram & Carrier Dynamics) ────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.02;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, w, h);

      if (activeTab === 'band') {
        // Draw Energy-Momentum (E - k) Band Diagram
        const midX = w / 2;
        const vbmY = h * 0.68;
        const cbmBaseY = h * 0.28;

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(midX, 20);
        ctx.lineTo(midX, h - 25);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.fillText('k = 0 (Γ點)', midX - 25, h - 10);
        ctx.fillText('+k (晶體動量)', w - 80, h - 10);
        ctx.fillText('能量 E', 10, 20);

        // Draw Valence Band (VBM)
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = 40; x <= w - 40; x++) {
          const kNorm = (x - midX) / (w * 0.35);
          const y = vbmY + kNorm * kNorm * 60;
          if (x === 40) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('價帶 (Valence Band)', 40, vbmY + 35);

        // Draw Conduction Band (CBM) depending on mechanism
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        if (mechanism === 'direct') {
          // Direct bandgap at k = 0
          for (let x = 40; x <= w - 40; x++) {
            const kNorm = (x - midX) / (w * 0.35);
            const y = cbmBaseY + kNorm * kNorm * 70;
            if (x === 40) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Direct vertical transition arrow
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(midX, vbmY);
          ctx.lineTo(midX, cbmBaseY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#fbbf24';
          ctx.fillText('強光子垂直躍遷 (Δk=0)', midX + 8, (vbmY + cbmBaseY) / 2);
          ctx.fillText('快速直接碰撞復合', midX + 8, (vbmY + cbmBaseY) / 2 + 16);
        } else if (mechanism === 'indirect') {
          // Indirect bandgap offset at k > 0
          const offsetK = midX + w * 0.22;
          for (let x = 40; x <= w - 40; x++) {
            const kNorm = (x - offsetK) / (w * 0.35);
            const y = cbmBaseY + 15 + kNorm * kNorm * 65;
            if (x === 40) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Slanted transition requiring phonon
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(midX, vbmY);
          ctx.lineTo(offsetK, cbmBaseY + 15);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#94a3b8';
          ctx.fillText('聲子協助躍遷 (弱吸收)', (midX + offsetK) / 2 - 40, (vbmY + cbmBaseY) / 2);
        } else {
          // Pseudo-direct: Direct vertical absorption + adjacent local minimum valley
          for (let x = 40; x <= w - 40; x++) {
            const kRel = (x - midX) / (w * 0.2);
            // Double-well or direct edge with offset valley
            const yDirect = cbmBaseY + kRel * kRel * 40;
            const yValley = cbmBaseY + 18 + Math.pow(kRel - 1.1, 2) * 50;
            const y = Math.min(yDirect, yValley);
            if (x === 40) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // 1. Direct optical absorption arrow
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(midX, vbmY);
          ctx.lineTo(midX, cbmBaseY);
          ctx.stroke();

          // 2. Ultra-fast thermalization arrow into offset valley
          const valleyX = midX + w * 0.22;
          const valleyY = cbmBaseY + 18;
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(midX, cbmBaseY);
          ctx.quadraticCurveTo((midX + valleyX) / 2, cbmBaseY - 10, valleyX, valleyY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Animated carrier dot in valley
          const dotOsc = Math.sin(t * 3) * 3;
          ctx.fillStyle = '#34d399';
          ctx.beginPath();
          ctx.arc(valleyX + dotOsc, valleyY - 2, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#34d399';
          ctx.font = '10px sans-serif';
          ctx.fillText('超快弛豫至偏離能谷 (Δk 屏障)', valleyX - 45, valleyY - 14);
          ctx.fillStyle = '#fbbf24';
          ctx.fillText('強直接光吸收', midX - 70, (vbmY + cbmBaseY) / 2);
        }
      } else {
        // Draw Carrier Transient Decay Curve: n(t) = n0 * exp(-t / tau)
        const leftX = 50;
        const bottomY = h - 35;
        const topY = 30;
        const graphW = w - 80;
        const graphH = bottomY - topY;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftX, topY);
        ctx.lineTo(leftX, bottomY);
        ctx.lineTo(leftX + graphW, bottomY);
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.fillText('0 ns', leftX - 10, bottomY + 15);
        ctx.fillText('500 ns', leftX + graphW * 0.5 - 15, bottomY + 15);
        ctx.fillText('1000 ns', leftX + graphW - 20, bottomY + 15);
        ctx.fillText('光生電子濃度 n(t)', leftX + 10, topY + 10);

        // Draw exponential decay
        ctx.strokeStyle = mechanism === 'pseudo_direct' ? '#34d399' : mechanism === 'direct' ? '#f59e0b' : '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        for (let px = 0; px <= graphW; px++) {
          const timeNs = (px / graphW) * 1000;
          const nFrac = Math.exp(-timeNs / carrierLifetimeNs);
          const py = bottomY - nFrac * graphH * 0.88;
          if (px === 0) ctx.moveTo(leftX + px, py);
          else ctx.lineTo(leftX + px, py);
        }
        ctx.stroke();

        // Mark 1/e lifetime position
        const tauPx = (carrierLifetimeNs / 1000) * graphW;
        if (tauPx <= graphW) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(leftX + tauPx, topY);
          ctx.lineTo(leftX + tauPx, bottomY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#ffffff';
          ctx.fillText(`τ = ${carrierLifetimeNs} ns`, leftX + tauPx + 5, bottomY - 35);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [mechanism, activeTab, carrierLifetimeNs]);

  return (
    <div className="my-8 rounded-2xl border border-mirari-line bg-white shadow-sm overflow-hidden font-sans">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 border-b border-mirari-line bg-mirari-surfaceAlt/30 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-700 font-mono">
              Nature · 2026 前沿研究解讀模型
            </span>
          </div>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-mirari-ink mt-1">
            硫化鉍擬直接能隙：強光吸收與延遲電荷復合之物理機制
          </h3>
          <p className="text-xs text-mirari-muted mt-0.5">
            比較直接半導體、間接半導體與擬直接半導體在能帶躍遷、載子壽命與擴散長度的差異
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex rounded-xl p-1 bg-mirari-paper border border-mirari-line text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('band')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'band'
                ? 'bg-white shadow-xs text-mirari-ink font-semibold'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            E-k 能帶躍遷圖
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('decay')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'decay'
                ? 'bg-white shadow-xs text-mirari-ink font-semibold'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            光生載子衰減動力學
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* ─── Mechanism Selector Buttons ─────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['direct', 'indirect', 'pseudo_direct'] as const).map((key) => {
            const item = configs[key];
            const isSelected = mechanism === key;
            return (
              <div
                key={key}
                onClick={() => setMechanism(key)}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-mirari-line bg-white hover:border-mirari-border'
                }`}
              >
                <div>
                  <span
                    className={`text-[11px] font-mono font-bold block ${
                      isSelected ? 'text-emerald-700' : 'text-mirari-dim'
                    }`}
                  >
                    {item.materialExample}
                  </span>
                  <h4 className="font-serif text-sm font-bold text-mirari-ink mt-0.5">
                    {item.nameZh}
                  </h4>
                </div>
                <div className="mt-3 pt-2 border-t border-mirari-line/60 flex items-center justify-between text-xs text-mirari-dim font-mono">
                  <span>Eg: {item.bandgap} eV</span>
                  <span className={isSelected ? 'text-emerald-700 font-semibold' : ''}>
                    {isSelected ? '✓ 作用中' : '選取比較'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Controls: Light Intensity & Defect Density ─────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-mirari-line bg-mirari-paper/50">
          {/* Light Intensity */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">入射光照強度 (Solar Irradiance)</span>
              <span className="font-mono text-emerald-700 font-bold">{lightIntensity.toFixed(1)} Suns</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.1"
              value={lightIntensity}
              onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>弱光 (0.2 Sun)</span>
              <span>標準 1.0 Sun (AM1.5G)</span>
              <span>聚光 (2.5 Suns)</span>
            </div>
          </div>

          {/* Defect Density */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">晶格缺陷深能階陷阱濃度 (N_t)</span>
              <span className="font-mono text-mirari-dim">10^{defectDensityLog.toFixed(1)} cm⁻³</span>
            </div>
            <input
              type="range"
              min="14.0"
              max="17.0"
              step="0.2"
              value={defectDensityLog}
              onChange={(e) => setDefectDensityLog(parseFloat(e.target.value))}
              className="w-full accent-slate-700 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>超純結晶 (10¹⁴)</span>
              <span>常規薄膜 (10¹⁵)</span>
              <span>高缺陷多晶 (10¹⁷)</span>
            </div>
          </div>
        </div>

        {/* ─── Canvas View (E-k Diagram / Transient Decay) ────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-mirari-ink">
              {activeTab === 'band'
                ? '晶體動量空間 (k-Space) 能帶極值與載子弛豫路徑'
                : '少數載子暫態濃度衰減曲線 n(t)'}
            </span>
            <span className="text-xs text-mirari-dim font-mono">
              {currentConfig.descriptionZh.slice(0, 40)}...
            </span>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 shadow-inner bg-slate-900">
            <canvas ref={canvasRef} width={640} height={260} className="w-full h-[220px] block" />
          </div>
        </div>

        {/* ─── Dashboard Key Metrics ──────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-mirari-line bg-mirari-paper/40 space-y-1">
            <span className="text-[10px] font-mono text-mirari-dim block uppercase">光吸收係數 (α)</span>
            <div className="flex items-baseline space-x-1">
              <span className="font-mono text-xl font-bold text-mirari-ink">
                {currentConfig.absorptionCoeff >= 1 ? currentConfig.absorptionCoeff : currentConfig.absorptionCoeff.toFixed(2)}
              </span>
              <span className="text-[10px] text-mirari-dim font-mono">×10⁴ cm⁻¹</span>
            </div>
            <span className="text-[10px] text-mirari-muted block leading-tight">
              穿透深度僅 {absorptionDepthNm} nm
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-mirari-line bg-mirari-paper/40 space-y-1">
            <span className="text-[10px] font-mono text-mirari-dim block uppercase">少數載子壽命 (τ)</span>
            <div className="flex items-baseline space-x-1">
              <span className="font-mono text-xl font-bold text-emerald-700">{carrierLifetimeNs}</span>
              <span className="text-[10px] text-mirari-dim font-mono">ns</span>
            </div>
            <span className="text-[10px] text-mirari-muted block leading-tight">
              {mechanism === 'pseudo_direct' ? '延遲復合顯著延長' : '常規熱動力學極限'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-mirari-line bg-mirari-paper/40 space-y-1">
            <span className="text-[10px] font-mono text-mirari-dim block uppercase">載子擴散長度 (L_D)</span>
            <div className="flex items-baseline space-x-1">
              <span className="font-mono text-xl font-bold text-mirari-ink">{diffusionLengthUm}</span>
              <span className="text-[10px] text-mirari-dim font-mono">μm</span>
            </div>
            <span className="text-[10px] text-mirari-muted block leading-tight">
              遠大於光吸收層厚度
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-mirari-line bg-mirari-paper/40 space-y-1">
            <span className="text-[10px] font-mono text-mirari-dim block uppercase">電荷收集幾率估算</span>
            <div className="flex items-baseline space-x-1">
              <span className="font-mono text-xl font-bold text-emerald-700">
                {collectionEfficiencyPercent}%
              </span>
              <span className="text-[10px] text-mirari-dim font-mono">理論上限</span>
            </div>
            <span className="text-[10px] text-mirari-muted block leading-tight">
              光生電荷抵達電極潛力
            </span>
          </div>
        </div>

        {/* ─── Scientific Caveat Box ──────────────────────────────── */}
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-950 text-xs space-y-1.5">
          <div className="flex items-center space-x-1.5 font-semibold">
            <svg className="w-4 h-4 text-emerald-700 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>科學查核與邊界限制說明</span>
          </div>
          <p className="leading-relaxed text-emerald-900/90">
            本互動組件依據 <em>Nature</em> 2026 原始研究（DOI: 10.1038/s41586-026-11223-x）建構。該論文揭示硫化鉍（Bi₂S₃）薄膜具有獨特的「擬直接能隙」物理特性，成功在第一性原理與光譜實驗上解除了「強光吸收通常伴隨強烈雙分子輻射復合」的固有物理制約。
            請特別注意：<strong>本研究展示的是具有高度潛力的微觀物理與材料機制，並非宣稱已經研發出光電轉換效率全面超越現有市售矽晶或商業鈣鈦礦之量產太陽能板模組</strong>；實際電池器件之開路電壓與填充因子仍受介面缺陷與電極接觸等工程限制約束。
          </p>
        </div>
      </div>
    </div>
  );
};
