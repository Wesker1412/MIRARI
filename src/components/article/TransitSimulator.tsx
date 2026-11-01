import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface TransitSimulatorProps {
  onParameterChange?: (params: { radiusRatio: number; transitDepthPercent: number }) => void;
}

export const TransitSimulator: React.FC<TransitSimulatorProps> = ({ onParameterChange }) => {
  // Model parameters
  const [radiusRatio, setRadiusRatio] = useState<number>(0.12); // Rp / R* (0.03 to 0.22)
  const [impactParameter, setImpactParameter] = useState<number>(0.2); // b (0 to 0.85)
  const [useLimbDarkening, setUseLimbDarkening] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [time, setTime] = useState<number>(-0.6); // Normalized time from -1.0 to 1.0
  const [speed, setSpeed] = useState<number>(1);

  const starCanvasRef = useRef<HTMLCanvasElement>(null);
  const lightCurveCanvasRef = useRef<HTMLCanvasElement>(null);

  // Derived calculations
  const transitDepthFraction = radiusRatio * radiusRatio;
  const transitDepthPercent = transitDepthFraction * 100;
  const transitDepthPpm = Math.round(transitDepthFraction * 1_000_000);

  // Transit chord length calculation
  const starRadiusPixels = 70;
  const effectiveB = Math.min(impactParameter, 0.95);
  const chordHalfLength = effectiveB < 1 ? Math.sqrt(Math.max(0, 1 - effectiveB * effectiveB)) : 0;
  const isGrazing = effectiveB + radiusRatio > 1;

  useEffect(() => {
    if (onParameterChange) {
      onParameterChange({ radiusRatio, transitDepthPercent });
    }
  }, [radiusRatio, transitDepthPercent, onParameterChange]);

  // Animation Loop for orbital motion
  useEffect(() => {
    let animId: number;
    let lastStamp = performance.now();

    const loop = (stamp: number) => {
      const dt = (stamp - lastStamp) / 1000;
      lastStamp = stamp;

      if (isPlaying) {
        setTime((prev) => {
          let next = prev + dt * 0.35 * speed;
          if (next > 1.1) return -1.1; // Loop back
          return next;
        });
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, speed]);

  // ─── Draw Stellar System View ────────────────────────────────
  useEffect(() => {
    const canvas = starCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const R_star = starRadiusPixels;
    const R_planet = R_star * radiusRatio;
    const starY = centerY;

    // Outer star corona glow
    const glowGrad = ctx.createRadialGradient(centerX, starY, R_star * 0.8, centerX, starY, R_star * 1.5);
    glowGrad.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
    glowGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.12)');
    glowGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(centerX, starY, R_star * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Host Star Disk
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, starY, R_star, 0, Math.PI * 2);
    ctx.clip();

    if (useLimbDarkening) {
      // Limb darkening: bright core, gentle drop to periphery
      const starGrad = ctx.createRadialGradient(centerX, starY, 0, centerX, starY, R_star);
      starGrad.addColorStop(0, '#FFFBEB');
      starGrad.addColorStop(0.4, '#FDE68A');
      starGrad.addColorStop(0.75, '#F59E0B');
      starGrad.addColorStop(1, '#92400E');
      ctx.fillStyle = starGrad;
    } else {
      ctx.fillStyle = '#FBBF24';
    }
    ctx.fill();
    ctx.restore();

    // Orbital transit trajectory line
    const orbitY = centerY + effectiveB * R_star;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(15, orbitY);
    ctx.lineTo(width - 15, orbitY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Exoplanet Position
    const transitSpan = R_star * 1.8;
    const planetX = centerX + time * transitSpan;
    const planetY = orbitY;
    const distToCenter = Math.hypot(planetX - centerX, planetY - starY);
    const isTransiting = distToCenter < R_star + R_planet;

    // Draw Planet
    ctx.save();
    ctx.beginPath();
    ctx.arc(planetX, planetY, Math.max(3, R_planet), 0, Math.PI * 2);

    if (isTransiting) {
      ctx.fillStyle = '#080B10';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fill();

      // Atmospheric limb ring
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      const planetGrad = ctx.createRadialGradient(
        planetX - R_planet * 0.3,
        planetY - R_planet * 0.3,
        0,
        planetX,
        planetY,
        R_planet
      );
      planetGrad.addColorStop(0, '#94A3B8');
      planetGrad.addColorStop(1, '#1E293B');
      ctx.fillStyle = planetGrad;
      ctx.fill();
    }
    ctx.restore();

    if (isTransiting) {
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#7DD3FC';
      ctx.fillText(`Rp = ${(radiusRatio * 100).toFixed(1)}% R*`, planetX - 25, planetY - R_planet - 6);
    }
  }, [time, radiusRatio, effectiveB, useLimbDarkening]);

  // ─── Draw Real-time Transit Light Curve ───────────────────────
  useEffect(() => {
    const canvas = lightCurveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const padLeft = 48;
    const padRight = 24;
    const padTop = 22;
    const padBottom = 30;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const baseFluxY = padTop + 8;
    const maxGraphDepth = Math.max(0.06, transitDepthFraction * 1.35);
    const fluxToY = (f: number) => {
      const dip = 1 - f;
      return baseFluxY + (dip / maxGraphDepth) * (plotH - 16);
    };

    // Grid baseline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, baseFluxY);
    ctx.lineTo(width - padRight, baseFluxY);
    ctx.stroke();

    // Y labels
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'right';
    ctx.fillText('1.000', padLeft - 6, baseFluxY + 3);

    const bottomDip = 1 - transitDepthFraction;
    if (transitDepthFraction > 0.005) {
      ctx.fillText(bottomDip.toFixed(3), padLeft - 6, fluxToY(bottomDip) + 3);
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(194, 65, 12, 0.3)';
      ctx.beginPath();
      ctx.moveTo(padLeft, fluxToY(bottomDip));
      ctx.lineTo(width - padRight, fluxToY(bottomDip));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // X axis
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(padLeft, height - padBottom);
    ctx.lineTo(width - padRight, height - padBottom);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillText('-1.0', padLeft, height - padBottom + 14);
    ctx.fillText('0 (中心食)', padLeft + plotW / 2, height - padBottom + 14);
    ctx.fillText('+1.0', width - padRight, height - padBottom + 14);

    const computeFluxAt = (tau: number): number => {
      const x = tau * 1.8;
      const y = effectiveB;
      const d = Math.sqrt(x * x + y * y);

      if (d >= 1 + radiusRatio) return 1.0;
      if (d <= 1 - radiusRatio) {
        if (useLimbDarkening) {
          const centerFactor = 1 + 0.35 * (1 - d);
          return 1.0 - transitDepthFraction * centerFactor;
        } else {
          return 1.0 - transitDepthFraction;
        }
      }
      const overlapFraction = Math.max(0, Math.min(1, (1 + radiusRatio - d) / (2 * radiusRatio)));
      return 1.0 - transitDepthFraction * overlapFraction;
    };

    // Draw curve
    ctx.beginPath();
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const tau = -1.1 + (i / steps) * 2.2;
      const px = padLeft + ((tau + 1.1) / 2.2) * plotW;
      const py = fluxToY(computeFluxAt(tau));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill under dip
    ctx.lineTo(width - padRight, baseFluxY);
    ctx.lineTo(padLeft, baseFluxY);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, baseFluxY, 0, height - padBottom);
    fillGrad.addColorStop(0, 'rgba(56, 189, 248, 0.1)');
    fillGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Real-time bead
    const currentTau = time;
    const curX = padLeft + ((currentTau + 1.1) / 2.2) * plotW;
    const curFlux = computeFluxAt(currentTau);
    const curY = fluxToY(curFlux);

    if (curX >= padLeft && curX <= width - padRight) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(curX, baseFluxY);
      ctx.lineTo(curX, height - padBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(curX, curY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#C2410C';
      ctx.fill();

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FB923C';
      ctx.textAlign = 'left';
      const textX = Math.min(curX + 6, width - padRight - 58);
      ctx.fillText(`${(curFlux * 100).toFixed(2)}%`, textX, Math.max(padTop + 12, curY - 6));
    }
  }, [time, radiusRatio, effectiveB, useLimbDarkening, transitDepthFraction]);

  return (
    <figure
      id="kp-transit-simulator"
      className="my-8 rounded-2xl border border-mirari-border bg-white shadow-sm overflow-hidden"
    >
      {/* Figure Title & Readout */}
      <div className="flex flex-wrap items-center justify-between border-b border-mirari-line px-6 py-4 bg-mirari-paper/50">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-mirari-amber font-semibold block">
            圖 1.1 即時物理實驗
          </span>
          <h3 className="font-serif text-lg font-bold text-mirari-ink">
            系外行星凌日投影與光度曲線即時觀測
          </h3>
        </div>

        {/* Real-time calculated transit depth readout */}
        <div className="mt-2 sm:mt-0 flex items-center space-x-4 bg-white border border-mirari-line px-3.5 py-1.5 rounded-xl">
          <div>
            <span className="block text-[10px] font-mono text-mirari-dim">
              凌日深度 ΔF / F₀
            </span>
            <span className="font-mono text-base font-bold text-mirari-amber">
              {transitDepthPercent.toFixed(2)}%
            </span>
          </div>
          <div className="h-6 w-[1px] bg-mirari-line" />
          <div>
            <span className="block text-[10px] font-mono text-mirari-dim">
              百萬分比 PPM
            </span>
            <span className="font-mono text-xs font-semibold text-mirari-muted">
              {transitDepthPpm.toLocaleString()} ppm
            </span>
          </div>
        </div>
      </div>

      {/* Main Dual Observation Plate */}
      <div className="bg-mirari-space p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Panel 1: Star & Planet Spatial Projection */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
            <span>空間投影視圖 (自地球觀測)</span>
            <span>{isGrazing ? '擦邊凌日' : `弦長比 ${(chordHalfLength * 2).toFixed(2)}`}</span>
          </div>
          <div className="relative rounded-xl border border-mirari-spaceBorder bg-mirari-spacePlate overflow-hidden flex items-center justify-center h-48">
            <canvas ref={starCanvasRef} width={380} height={192} className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Panel 2: Synchronized Light Curve */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
            <span>相對光通量曲線 F / F₀</span>
            <span className="text-mirari-amber">
              {useLimbDarkening ? '周邊昏暗 (U型底)' : '均勻圓盤模型'}
            </span>
          </div>
          <div className="relative rounded-xl border border-mirari-spaceBorder bg-mirari-spacePlate overflow-hidden flex items-center justify-center h-48">
            <canvas ref={lightCurveCanvasRef} width={380} height={192} className="w-full h-full object-contain" />
          </div>
        </div>
      </div>

      {/* Control Dashboard */}
      <div className="p-5 sm:p-6 bg-white space-y-5">
        {/* Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-sans text-mirari-muted mr-1">尺度預設：</span>
          <button
            type="button"
            onClick={() => { setRadiusRatio(0.04); setImpactParameter(0.1); }}
            className={`px-2.5 py-1 text-xs rounded-lg border transition font-sans ${
              Math.abs(radiusRatio - 0.04) < 0.01
                ? 'bg-mirari-amberLight text-mirari-amber border-mirari-amber/40 font-medium'
                : 'bg-mirari-paper text-mirari-muted border-mirari-line hover:border-mirari-border'
            }`}
          >
            地球型 (Rp ≈ 0.04 R*)
          </button>
          <button
            type="button"
            onClick={() => { setRadiusRatio(0.08); setImpactParameter(0.2); }}
            className={`px-2.5 py-1 text-xs rounded-lg border transition font-sans ${
              Math.abs(radiusRatio - 0.08) < 0.01
                ? 'bg-mirari-amberLight text-mirari-amber border-mirari-amber/40 font-medium'
                : 'bg-mirari-paper text-mirari-muted border-mirari-line hover:border-mirari-border'
            }`}
          >
            海王星型 (Rp ≈ 0.08 R*)
          </button>
          <button
            type="button"
            onClick={() => { setRadiusRatio(0.14); setImpactParameter(0.2); }}
            className={`px-2.5 py-1 text-xs rounded-lg border transition font-sans ${
              Math.abs(radiusRatio - 0.14) < 0.01
                ? 'bg-mirari-amberLight text-mirari-amber border-mirari-amber/40 font-medium'
                : 'bg-mirari-paper text-mirari-muted border-mirari-line hover:border-mirari-border'
            }`}
          >
            木星型 (Rp ≈ 0.14 R*)
          </button>
          <button
            type="button"
            onClick={() => { setRadiusRatio(0.21); setImpactParameter(0.25); }}
            className={`px-2.5 py-1 text-xs rounded-lg border transition font-sans ${
              Math.abs(radiusRatio - 0.21) < 0.01
                ? 'bg-mirari-amberLight text-mirari-amber border-mirari-amber/40 font-medium'
                : 'bg-mirari-paper text-mirari-muted border-mirari-line hover:border-mirari-border'
            }`}
          >
            巨熱木星 (Rp ≈ 0.21 R*)
          </button>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-1">
          {/* Slider 1: Radius Ratio */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-mirari-ink">行星半徑比 (Rp / R*)</span>
              <span className="font-mono text-mirari-amber font-semibold">
                {radiusRatio.toFixed(2)} ({(radiusRatio * 100).toFixed(0)}%)
              </span>
            </div>
            <input
              type="range"
              min="0.03"
              max="0.22"
              step="0.01"
              value={radiusRatio}
              onChange={(e) => setRadiusRatio(parseFloat(e.target.value))}
              className="w-full accent-mirari-amber h-1.5 bg-mirari-surfaceAlt rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[11px] text-mirari-dim block">
              決定遮光截面積與曲線下陷深度
            </span>
          </div>

          {/* Slider 2: Impact Parameter */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-mirari-ink">撞擊參數 (b)</span>
              <span className="font-mono text-mirari-cobalt font-semibold">
                b = {impactParameter.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.8"
              step="0.05"
              value={impactParameter}
              onChange={(e) => setImpactParameter(parseFloat(e.target.value))}
              className="w-full accent-mirari-cobalt h-1.5 bg-mirari-surfaceAlt rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[11px] text-mirari-dim block">
              b=0 穿越正中心，b 越大越偏向邊緣
            </span>
          </div>

          {/* Slider 3: Timeline & Playback */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-mirari-ink">公轉時間軸 (t)</span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 0.5 : 1)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-mirari-paper border border-mirari-line hover:text-mirari-ink transition"
                >
                  {speed}x
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-1 rounded bg-mirari-paper border border-mirari-line hover:text-mirari-ink transition"
                  title={isPlaying ? '暫停' : '播放'}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setTime(-1.0)}
                  className="p-1 rounded bg-mirari-paper border border-mirari-line hover:text-mirari-ink transition"
                  title="重設起點"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <input
              type="range"
              min="-1.1"
              max="1.1"
              step="0.02"
              value={time}
              onChange={(e) => {
                setTime(parseFloat(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full accent-mirari-ink h-1.5 bg-mirari-surfaceAlt rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between items-center text-[11px] text-mirari-dim">
              <span>手動拖動檢視任意時刻光量</span>
              <button
                type="button"
                onClick={() => setUseLimbDarkening(!useLimbDarkening)}
                className="underline hover:text-mirari-ink transition"
              >
                {useLimbDarkening ? '切換均勻圓盤' : '切換周邊昏暗'}
              </button>
            </div>
          </div>
        </div>

        {/* Scientific Footnote */}
        <figcaption className="pt-3 border-t border-mirari-line text-xs text-mirari-dim leading-relaxed">
          <strong className="text-mirari-muted font-medium">模型說明：</strong>
          本模擬採用一階線性周邊昏暗近似（$I(\mu) = I_0[1 - u(1 - \mu)]$）與共面圓軌道。在實際天文觀測中，解算光度曲線需進一步考慮恆星表面黑子群、非線性大氣昏暗係數與儀器噪聲。
        </figcaption>
      </div>
    </figure>
  );
};
