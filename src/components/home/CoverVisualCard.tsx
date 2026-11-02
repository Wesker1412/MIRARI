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

      {/* ─── Case 5: Generic Future Scientific Visual ──────────────── */}
      {!isTransit && !isChaos && !isActionPotential && !isMaxwellDemon && (
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
