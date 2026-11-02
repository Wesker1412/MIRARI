import React from 'react';
import type { ArticleDocument } from '../../types';

interface CoverVisualCardProps {
  article: ArticleDocument;
  onClick: () => void;
}

export const CoverVisualCard: React.FC<CoverVisualCardProps> = ({ article, onClick }) => {
  // Determine tailored scientific visual based on article characteristics
  const isTransit = article.slug.includes('transit') || article.slug.includes('starlight');
  const isChaos = article.slug.includes('chaos') || article.slug.includes('pendulum');
  const isActionPotential = article.slug.includes('action-potential') || article.slug.includes('hodgkin');
  const isMaxwellDemon = article.slug.includes('maxwell') || article.slug.includes('entropy');
  const isAmygdala = article.slug.includes('amygdala') || article.slug.includes('memory-encoding');
  const isBismuth = article.slug.includes('bismuth') || article.slug.includes('recombination');
  const isNuclearClock = article.slug.includes('thorium') || article.slug.includes('nuclear-clock');

  return (
    <div
      onClick={onClick}
      className="group relative rounded-3xl bg-mirari-space p-6 sm:p-8 cursor-pointer shadow-xl overflow-hidden border border-mirari-spaceBorder transition-all duration-300 hover:border-mirari-amber/40 select-none h-[340px] sm:h-[380px] flex flex-col justify-between"
    >
      {/* ─── Case 1: Exoplanet Transit Visual ─────────────────────── */}
      {isTransit && (
        <>
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-6 border-b border-white/10 pb-3">
            <span>TRANSIT OBSERVATION</span>
            <span className="text-amber-400">ΔF / F₀ = (Rp/R*)²</span>
          </div>

          <div className="relative h-48 rounded-2xl bg-gradient-to-tr from-mirari-spacePlate to-slate-900 border border-white/10 flex items-center justify-center overflow-hidden">
            {/* Star */}
            <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-100 shadow-[0_0_40px_rgba(245,158,11,0.5)] flex items-center justify-center relative">
              {/* Planet transit shadow */}
              <div className="w-6 h-6 rounded-full bg-black border border-sky-400/80 absolute -left-2 shadow-md animate-pulse" />
            </div>
            {/* Transit line */}
            <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-sky-400/30" />
            {/* Flux dip curve preview */}
            <div className="absolute bottom-3 left-4 right-4 flex justify-between text-[10px] font-mono text-slate-400">
              <span>t_ingress</span>
              <span className="text-amber-300">深度 0.84%</span>
              <span>t_egress</span>
            </div>
          </div>
        </>
      )}

      {/* ─── Case 2: Double Pendulum Chaos Visual ──────────────────── */}
      {isChaos && (
        <>
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-6 border-b border-white/10 pb-3">
            <span>PHASE SPACE METRICS</span>
            <span className="text-sky-400">λ &gt; 0 (LYAPUNOV)</span>
          </div>

          <div className="relative h-48 rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-sky-950/40 border border-white/10 flex items-center justify-center overflow-hidden p-4">
            {/* Phase Orbit SVG */}
            <svg className="w-full h-full text-sky-400/80" viewBox="0 0 200 120" fill="none">
              <path
                d="M 20 60 C 40 10, 80 110, 100 60 C 120 10, 160 110, 180 60"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="4 2"
                className="opacity-40"
              />
              <path
                d="M 20 60 C 42 8, 78 114, 102 58 C 124 16, 158 104, 182 62"
                stroke="#F59E0B"
                strokeWidth="2"
                className="animate-pulse"
              />
              <circle cx="102" cy="58" r="4" fill="#F59E0B" />
              <circle cx="100" cy="60" r="4" fill="#38BDF8" />
            </svg>

            <div className="absolute top-3 left-4 text-[10px] font-mono text-slate-400">
              Δθ₀ = 0.001 rad
            </div>
            <div className="absolute bottom-3 right-4 text-[10px] font-mono text-amber-400">
              確定性發散軌跡
            </div>
          </div>
        </>
      )}

      {/* ─── Case 3: Action Potential Biophysics Visual ────────────── */}
      {isActionPotential && (
        <>
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-6 border-b border-white/10 pb-3">
            <span>HODGKIN-HUXLEY OSCILLOSCOPE</span>
            <span className="text-emerald-400">Vm: -65 → +40 mV</span>
          </div>

          <div className="relative h-48 rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-emerald-950/30 border border-white/10 flex items-center justify-center overflow-hidden p-4">
            {/* Oscilloscope Spike SVG */}
            <svg className="w-full h-full text-emerald-400" viewBox="0 0 220 120" fill="none">
              {/* Baseline */}
              <line x1="10" y1="90" x2="210" y2="90" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
              {/* Action Potential Spike Wave */}
              <path
                d="M 10 90 L 60 90 L 70 85 L 90 20 L 110 105 L 130 95 L 160 90 L 210 90"
                stroke="#34D399"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="90" cy="20" r="3.5" fill="#F59E0B" />
            </svg>

            <div className="absolute top-3 left-4 text-[10px] font-mono text-slate-400">
              Na⁺ 快門開 / K⁺ 慢閘復極
            </div>
            <div className="absolute bottom-3 right-4 text-[10px] font-mono text-emerald-400">
              動態膜電位激發
            </div>
          </div>
        </>
      )}

      {/* ─── Case 4: Maxwell's Demon Visual ───────────────────────── */}
      {isMaxwellDemon && (
        <>
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-6 border-b border-white/10 pb-3">
            <span>LANDAUER LIMIT VERIFICATION</span>
            <span className="text-purple-400">W ≥ kB T ln 2</span>
          </div>

          <div className="relative h-48 rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950/40 border border-white/10 flex items-center justify-center overflow-hidden p-4">
            {/* Dual Partition Chamber */}
            <div className="w-full h-full flex items-center justify-between px-6 relative">
              {/* Left Cold Chamber */}
              <div className="flex-1 text-center">
                <span className="text-[11px] font-mono text-blue-400 block mb-1">左室 TL: 280K</span>
                <div className="flex justify-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping opacity-75" />
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-300" />
                </div>
              </div>

              {/* Central Barrier & Demon Gate */}
              <div className="w-0.5 h-32 bg-slate-600 relative flex items-center justify-center">
                <div className="w-3 h-8 bg-amber-400/80 rounded-full border border-white" />
              </div>

              {/* Right Hot Chamber */}
              <div className="flex-1 text-center">
                <span className="text-[11px] font-mono text-red-400 block mb-1">右室 TR: 320K</span>
                <div className="flex justify-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping opacity-75" />
                  <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
                </div>
              </div>
            </div>

            <div className="absolute bottom-3 right-4 text-[10px] font-mono text-purple-300">
              資訊抹除熱耗散
            </div>
          </div>
        </>
      )}

      {/* ─── Case 5: Amygdala Memory Encoding Visual ──────────────── */}
      {isAmygdala && (
        <>
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-6 border-b border-white/10 pb-3">
            <span>NEURAL ENCODING CORRELATION</span>
            <span className="text-rose-400">P(Recall) = 1/(1 + e^-z)</span>
          </div>

          <div className="relative h-48 rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-rose-950/30 border border-white/10 flex items-center justify-center overflow-hidden p-4">
            {/* Multi-channel raster & logistic curve SVG */}
            <svg className="w-full h-full" viewBox="0 0 220 120" fill="none">
              {/* Raster lines */}
              <line x1="20" y1="25" x2="200" y2="25" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 3" />
              <line x1="20" y1="45" x2="200" y2="45" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 3" />
              <line x1="20" y1="65" x2="200" y2="65" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 3" />
              
              {/* Spike ticks */}
              {[35, 52, 70, 88, 92, 105, 120, 145, 160, 185].map((x, i) => (
                <line key={`sp1-${i}`} x1={x} y1="20" x2={x} y2="30" stroke="#FB7185" strokeWidth="1.5" />
              ))}
              {[40, 68, 86, 94, 110, 114, 138, 155, 172].map((x, i) => (
                <line key={`sp2-${i}`} x1={x} y1="40" x2={x} y2="50" stroke="#F43F5E" strokeWidth="1.5" />
              ))}
              {[50, 75, 90, 102, 108, 125, 165].map((x, i) => (
                <line key={`sp3-${i}`} x1={x} y1="60" x2={x} y2="70" stroke="#FDA4AF" strokeWidth="1.5" />
              ))}

              {/* SME Logistic Probability curve */}
              <path
                d="M 20 110 C 70 110, 110 95, 130 55 C 150 15, 180 15, 200 15"
                stroke="#F59E0B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="130" cy="55" r="3.5" fill="#F59E0B" className="animate-ping opacity-75" />
              <circle cx="130" cy="55" r="3" fill="#FFE4E6" />
            </svg>

            <div className="absolute top-2 left-4 text-[10px] font-mono text-slate-400">
              刺激範疇調諧 / 脈衝光柵
            </div>
            <div className="absolute bottom-2 right-4 text-[10px] font-mono text-rose-300">
              SME 記憶表現相關預測
            </div>
          </div>
        </>
      )}

      {/* ─── Case 6: Photovoltaic Bandgap Dynamics Visual ───────────── */}
      {isBismuth && (
        <>
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-6 border-b border-white/10 pb-3">
            <span>PSEUDO-DIRECT BANDGAP</span>
            <span className="text-amber-400">Bi₂S₃ (Eg = 1.3 eV)</span>
          </div>

          <div className="relative h-48 rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-amber-950/30 border border-white/10 flex items-center justify-center overflow-hidden p-4">
            {/* E-k dispersion curve preview */}
            <svg className="w-full h-full" viewBox="0 0 220 120" fill="none">
              {/* Gamma line */}
              <line x1="110" y1="10" x2="110" y2="110" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
              
              {/* Conduction band (parabolic valley shifted slightly) */}
              <path
                d="M 40 20 Q 110 55, 140 50 Q 170 55, 200 20"
                stroke="#FBBF24"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Direct optical excitation arrow */}
              <line x1="110" y1="95" x2="110" y2="52" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="2 2" />
              <polygon points="110,48 106,56 114,56" fill="#38BDF8" />

              {/* Delayed Recombination phonon path arrow */}
              <path
                d="M 115 54 C 130 54, 138 52, 140 50"
                stroke="#34D399"
                strokeWidth="2"
              />

              {/* Valence band */}
              <path
                d="M 40 115 Q 110 90, 180 115"
                stroke="#94A3B8"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            <div className="absolute top-2 left-4 text-[10px] font-mono text-sky-400">
              垂直強光學吸收 (α &gt; 10⁵)
            </div>
            <div className="absolute bottom-2 right-4 text-[10px] font-mono text-emerald-400">
              聲子解耦 / 復合延遲
            </div>
          </div>
        </>
      )}

      {/* ─── Case 7: Thorium-229 Nuclear Clock Visual ───────────────── */}
      {isNuclearClock && (
        <>
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-6 border-b border-white/10 pb-3">
            <span>ISOMERIC OPTICAL RESONANCE</span>
            <span className="text-cyan-400">²²⁹mTh: 8.338 eV (148 nm)</span>
          </div>

          <div className="relative h-48 rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-cyan-950/30 border border-white/10 flex items-center justify-center overflow-hidden p-4">
            {/* Laser VUV Resonance Curve & Error Signal */}
            <svg className="w-full h-full" viewBox="0 0 220 120" fill="none">
              {/* Zero error center line */}
              <line x1="20" y1="60" x2="200" y2="60" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
              
              {/* Lorentzian absorption peak (semi-transparent) */}
              <path
                d="M 30 100 Q 80 100, 100 80 Q 110 20, 120 80 Q 140 100, 190 100"
                stroke="#38BDF8"
                strokeWidth="1.5"
                strokeOpacity="0.4"
                fill="none"
              />

              {/* Dispersion Error Signal S(Δν) */}
              <path
                d="M 40 60 C 80 60, 95 35, 110 60 C 125 85, 140 60, 180 60"
                stroke="#06B6D4"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Lock center target point */}
              <circle cx="110" cy="60" r="3.5" fill="#F59E0B" className="animate-ping opacity-80" />
              <circle cx="110" cy="60" r="2.5" fill="#FFFFFF" />
            </svg>

            <div className="absolute top-2 left-4 text-[10px] font-mono text-cyan-300">
              VUV 雷射鎖相迴路
            </div>
            <div className="absolute bottom-2 right-4 text-[10px] font-mono text-amber-300">
              磁雜訊免疫 / 理論潛力 10⁻¹⁹
            </div>
          </div>
        </>
      )}

      {/* ─── Case 8: Generic Future Scientific Visual ──────────────── */}
      {!isTransit && !isChaos && !isActionPotential && !isMaxwellDemon && !isAmygdala && !isBismuth && !isNuclearClock && (
        <>
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-6 border-b border-white/10 pb-3">
            <span>SCIENTIFIC DISCOVERY</span>
            <span className="text-amber-400">FIRST PRINCIPLES</span>
          </div>

          <div className="relative h-48 rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-amber-950/30 border border-white/10 flex flex-col items-center justify-center overflow-hidden p-6 text-center space-y-2">
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider">
              {article.formatBadgeText || '互動科學實證'}
            </span>
            <p className="font-serif text-sm text-slate-200 line-clamp-2 italic">
              「{article.quoteLead || article.subtitle}」
            </p>
            <div className="pt-2 text-[10px] font-mono text-slate-400">
              數值模擬與可驗證文獻
            </div>
          </div>
        </>
      )}

      {/* Card Action Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400 font-sans">
        <span>點選直接體驗互動實驗</span>
        <span className="text-white group-hover:text-amber-400 font-medium transition">
          開始探索 →
        </span>
      </div>
    </div>
  );
};
