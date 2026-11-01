import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Info, Sliders, Eye, Sparkles } from 'lucide-react';

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

  // Transit half-chord length on star disk
  const starRadiusPixels = 70;
  const maxImpact = 0.95;
  const effectiveB = Math.min(impactParameter, maxImpact);
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

    // Star position
    const starY = centerY;

    // Outer star corona glow
    const glowGrad = ctx.createRadialGradient(centerX, starY, R_star * 0.8, centerX, starY, R_star * 1.6);
    glowGrad.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
    glowGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.12)');
    glowGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(centerX, starY, R_star * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Host Star Disk with Limb Darkening
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, starY, R_star, 0, Math.PI * 2);
    ctx.clip();

    if (useLimbDarkening) {
      // Limb darkening: bright core, gentle drop to periphery
      const starGrad = ctx.createRadialGradient(centerX, starY, 0, centerX, starY, R_star);
      starGrad.addColorStop(0, '#FFFBEB');
      starGrad.addColorStop(0.4, '#FEF08A');
      starGrad.addColorStop(0.75, '#F59E0B');
      starGrad.addColorStop(1, '#B45309');
      ctx.fillStyle = starGrad;
    } else {
      // Uniform Disk approximation
      ctx.fillStyle = '#FBBF24';
    }
    ctx.fill();
    ctx.restore();

    // Orbital transit trajectory line
    const orbitY = centerY + effectiveB * R_star;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(20, orbitY);
    ctx.lineTo(width - 20, orbitY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Exoplanet Position
    // time ranges from -1.1 to +1.1
    // map time to X coordinate: time = 0 is center
    const transitSpan = R_star * 1.8;
    const planetX = centerX + time * transitSpan;
    const planetY = orbitY;

    // Draw Planet
    const distToCenter = Math.hypot(planetX - centerX, planetY - starY);
    const isTransiting = distToCenter < R_star + R_planet;

    // Planet shadow / silhouette
    ctx.save();
    ctx.beginPath();
    ctx.arc(planetX, planetY, Math.max(3, R_planet), 0, Math.PI * 2);

    if (isTransiting) {
      // Planet silhouette against the star
      ctx.fillStyle = '#080B11';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fill();

      // Atmospheric fringe glow (Rayleigh scattering edge)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      // Outside star transit: slightly lit sphere
      const planetGrad = ctx.createRadialGradient(
        planetX - R_planet * 0.3,
        planetY - R_planet * 0.3,
        0,
        planetX,
        planetY,
        R_planet
      );
      planetGrad.addColorStop(0, '#64748B');
      planetGrad.addColorStop(1, '#0F172A');
      ctx.fillStyle = planetGrad;
      ctx.fill();
    }
    ctx.restore();

    // Planet label when transiting
    if (isTransiting) {
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(`Rp = ${(radiusRatio * 100).toFixed(1)}% R*`, planetX - 30, planetY - R_planet - 8);
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

    // Padding for axes
    const padLeft = 55;
    const padRight = 30;
    const padTop = 25;
    const padBottom = 35;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Baseline flux = 1.0 (at padTop + 10)
    const baseFluxY = padTop + 10;
    // Bottom of the plot corresponds to 1 - maxExpectedDepth
    const maxGraphDepth = Math.max(0.06, transitDepthFraction * 1.35);
    const fluxToY = (f: number) => {
      const dip = 1 - f;
      return baseFluxY + (dip / maxGraphDepth) * (plotH - 20);
    };

    // Draw Grid Lines
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;

    // Flux 1.000 line
    ctx.beginPath();
    ctx.moveTo(padLeft, baseFluxY);
    ctx.lineTo(width - padRight, baseFluxY);
    ctx.stroke();

    // Y-axis labels
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'right';
    ctx.fillText('1.000', padLeft - 8, baseFluxY + 4);

    const bottomDip = 1 - transitDepthFraction;

    if (transitDepthFraction > 0.005) {
      ctx.fillText(bottomDip.toFixed(3), padLeft - 8, fluxToY(bottomDip) + 4);
      // Dip reference dashed line
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.beginPath();
      ctx.moveTo(padLeft, fluxToY(bottomDip));
      ctx.lineTo(width - padRight, fluxToY(bottomDip));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // X-axis baseline & labels
    ctx.strokeStyle = '#1E293B';
    ctx.beginPath();
    ctx.moveTo(padLeft, height - padBottom);
    ctx.lineTo(width - padRight, height - padBottom);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillText('-1.0', padLeft, height - padBottom + 16);
    ctx.fillText('0 (中心食)', padLeft + plotW / 2, height - padBottom + 16);
    ctx.fillText('+1.0', width - padRight, height - padBottom + 16);
    ctx.fillText('標準化軌道時間 t', padLeft + plotW / 2, height - 6);

    // Y-axis title
    ctx.save();
    ctx.translate(14, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('相對光通量 F / F₀', 0, 0);
    ctx.restore();

    // Helper to calculate flux at normalized time tau (-1 to 1)
    const computeFluxAt = (tau: number): number => {
      // Planet normalized position
      const x = tau * 1.8;
      const y = effectiveB;
      const d = Math.sqrt(x * x + y * y);

      if (d >= 1 + radiusRatio) {
        return 1.0; // Out of transit
      }

      if (d <= 1 - radiusRatio) {
        // Complete ingress
        if (useLimbDarkening) {
          // Limb darkening depth variation: center is slightly deeper
          const centerFactor = 1 + 0.35 * (1 - d);
          return 1.0 - transitDepthFraction * centerFactor;
        } else {
          return 1.0 - transitDepthFraction;
        }
      }

      // Partial ingress / egress
      const overlapFraction = Math.max(0, Math.min(1, (1 + radiusRatio - d) / (2 * radiusRatio)));
      return 1.0 - transitDepthFraction * overlapFraction;
    };

    // Draw the full theoretical light curve
    ctx.beginPath();
    const steps = 180;
    for (let i = 0; i <= steps; i++) {
      const tau = -1.1 + (i / steps) * 2.2;
      const px = padLeft + ((tau + 1.1) / 2.2) * plotW;
      const py = fluxToY(computeFluxAt(tau));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Fill under the dip with gentle gradient
    ctx.lineTo(width - padRight, baseFluxY);
    ctx.lineTo(padLeft, baseFluxY);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, baseFluxY, 0, height - padBottom);
    fillGrad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
    fillGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Current Time Marker Line & Bead
    const currentTau = time;
    const curX = padLeft + ((currentTau + 1.1) / 2.2) * plotW;
    const curFlux = computeFluxAt(currentTau);
    const curY = fluxToY(curFlux);

    if (curX >= padLeft && curX <= width - padRight) {
      // Vertical indicator line
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(curX, baseFluxY);
      ctx.lineTo(curX, height - padBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Real-time bead
      ctx.beginPath();
      ctx.arc(curX, curY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Current Flux readout tag
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#F59E0B';
      ctx.textAlign = 'left';
      const textX = Math.min(curX + 8, width - padRight - 65);
      ctx.fillText(`F = ${(curFlux * 100).toFixed(2)}%`, textX, Math.max(padTop + 14, curY - 8));
    }
  }, [time, radiusRatio, effectiveB, useLimbDarkening, transitDepthFraction]);

  // Preset selector handler
  const setPreset = (name: 'earth' | 'neptune' | 'jupiter' | 'super') => {
    switch (name) {
      case 'earth':
        setRadiusRatio(0.04);
        setImpactParameter(0.1);
        break;
      case 'neptune':
        setRadiusRatio(0.08);
        setImpactParameter(0.2);
        break;
      case 'jupiter':
        setRadiusRatio(0.14);
        setImpactParameter(0.2);
        break;
      case 'super':
        setRadiusRatio(0.21);
        setImpactParameter(0.25);
        break;
    }
  };

  return (
    <div
      id="kp-transit-simulator"
      className="my-10 rounded-2xl border border-mirari-border bg-mirari-surface/90 shadow-2xl overflow-hidden backdrop-blur-sm"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-mirari-border px-6 py-4 bg-mirari-card/50">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mirari-cyan/15 text-mirari-cyan border border-mirari-cyan/30">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs uppercase tracking-wider text-mirari-cyan font-semibold">
                INTERACTIVE LAB 01
              </span>
              <span className="inline-flex items-center rounded-full bg-mirari-border px-2 py-0.5 text-[10px] text-mirari-muted">
                雙視角同步
              </span>
            </div>
            <h3 className="font-serif text-lg font-bold text-white tracking-wide">
              系外行星凌日幾何與光度曲線即時模擬器
            </h3>
          </div>
        </div>

        {/* Real-time calculated transit depth readout */}
        <div className="mt-2 sm:mt-0 flex items-center space-x-4 bg-mirari-bg/80 border border-mirari-border px-4 py-2 rounded-xl">
          <div className="text-right">
            <span className="block text-[10px] font-mono uppercase text-mirari-muted">
              凌日深度 ΔF / F₀
            </span>
            <span className="font-mono text-lg font-bold text-mirari-amber">
              {transitDepthPercent.toFixed(2)}%
            </span>
          </div>
          <div className="h-7 w-[1px] bg-mirari-border" />
          <div className="text-right">
            <span className="block text-[10px] font-mono uppercase text-mirari-muted">
              百萬分比 PPM
            </span>
            <span className="font-mono text-sm font-semibold text-mirari-cyan">
              {transitDepthPpm.toLocaleString()} ppm
            </span>
          </div>
        </div>
      </div>

      {/* Main Simulation View Area (Two Columns on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Panel 1: Stellar System Spatial View */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-mirari-muted uppercase tracking-wider flex items-center space-x-1.5">
              <Eye className="w-3.5 h-3.5 text-mirari-amber" />
              <span>恆星系空間投影視圖 (Spatial Projection)</span>
            </span>
            <span className="text-[11px] text-mirari-dim font-mono">
              黃色圓盤：恆星 | 黑色圓盤：行星
            </span>
          </div>

          <div className="relative rounded-xl border border-mirari-border/70 bg-mirari-bg overflow-hidden flex items-center justify-center h-52">
            <canvas ref={starCanvasRef} width={420} height={208} className="w-full h-full object-contain" />
            <div className="absolute top-2 left-3 text-[10px] font-mono text-mirari-muted bg-mirari-surface/80 px-2 py-0.5 rounded border border-mirari-border/50">
              視線方向：自地球遠距離觀測 {isGrazing ? '· (擦邊凌日)' : `· 弦長比 ${(chordHalfLength * 2).toFixed(2)}`}
            </div>
          </div>
        </div>

        {/* Panel 2: Synchronized Light Curve View */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-mirari-muted uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-mirari-cyan" />
              <span>同步恆星光度曲線 (Transit Light Curve)</span>
            </span>
            <span className="text-[11px] text-mirari-dim font-mono">
              曲線深度正比於遮擋面積 (Rp/R*)²
            </span>
          </div>

          <div className="relative rounded-xl border border-mirari-border/70 bg-mirari-bg overflow-hidden flex items-center justify-center h-52">
            <canvas ref={lightCurveCanvasRef} width={420} height={208} className="w-full h-full object-contain" />
            <div className="absolute top-2 right-3 text-[10px] font-mono text-mirari-cyan bg-mirari-surface/80 px-2 py-0.5 rounded border border-mirari-border/50">
              {useLimbDarkening ? '已啟用周邊昏暗 (U型底)' : '均勻圓盤模型 (平底)'}
            </div>
          </div>
        </div>
      </div>

      {/* Control Dashboard */}
      <div className="border-t border-mirari-border bg-mirari-card/30 p-6 space-y-5">
        {/* Preset quick buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-mirari-muted mr-2">行星類型快速預設：</span>
          <button
            onClick={() => setPreset('earth')}
            className={`px-3 py-1 text-xs rounded-lg border transition font-mono ${
              Math.abs(radiusRatio - 0.04) < 0.01
                ? 'bg-mirari-amber/20 text-mirari-amber border-mirari-amber/50 font-medium'
                : 'bg-mirari-surface text-mirari-muted border-mirari-border hover:border-mirari-muted'
            }`}
          >
            地球型 (Rp ≈ 0.04 R*)
          </button>
          <button
            onClick={() => setPreset('neptune')}
            className={`px-3 py-1 text-xs rounded-lg border transition font-mono ${
              Math.abs(radiusRatio - 0.08) < 0.01
                ? 'bg-mirari-amber/20 text-mirari-amber border-mirari-amber/50 font-medium'
                : 'bg-mirari-surface text-mirari-muted border-mirari-border hover:border-mirari-muted'
            }`}
          >
            海王星型 (Rp ≈ 0.08 R*)
          </button>
          <button
            onClick={() => setPreset('jupiter')}
            className={`px-3 py-1 text-xs rounded-lg border transition font-mono ${
              Math.abs(radiusRatio - 0.14) < 0.01
                ? 'bg-mirari-amber/20 text-mirari-amber border-mirari-amber/50 font-medium'
                : 'bg-mirari-surface text-mirari-muted border-mirari-border hover:border-mirari-muted'
            }`}
          >
            木星型 (Rp ≈ 0.14 R*)
          </button>
          <button
            onClick={() => setPreset('super')}
            className={`px-3 py-1 text-xs rounded-lg border transition font-mono ${
              Math.abs(radiusRatio - 0.21) < 0.01
                ? 'bg-mirari-amber/20 text-mirari-amber border-mirari-amber/50 font-medium'
                : 'bg-mirari-surface text-mirari-muted border-mirari-border hover:border-mirari-muted'
            }`}
          >
            巨熱木星 (Rp ≈ 0.21 R*)
          </button>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {/* Slider 1: Radius Ratio */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-white">行星 / 恆星半徑比 (Rp / R*)</span>
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
              className="w-full accent-mirari-amber bg-mirari-surface h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[11px] text-mirari-dim leading-relaxed">
              決定遮蔽面積 $(\pi R_p^2)$ 與光度下降深度。
            </p>
          </div>

          {/* Slider 2: Impact Parameter */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-white">撞擊參數 (Impact Parameter b)</span>
              <span className="font-mono text-mirari-cyan font-semibold">
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
              className="w-full accent-mirari-cyan bg-mirari-surface h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[11px] text-mirari-dim leading-relaxed">
              $b=0$ 掠過恆星正中心；$b$ 越大越偏向邊緣，凌日持續時間越短。
            </p>
          </div>

          {/* Slider 3: Timeline & Playback */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-white">公轉時間軸 (Orbit Time t)</span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 0.5 : 1)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-mirari-surface border border-mirari-border hover:text-white transition"
                  title="切換播放速度"
                >
                  {speed}x
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-1 rounded bg-mirari-surface border border-mirari-border hover:text-white transition"
                  title={isPlaying ? '暫停' : '播放'}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setTime(-1.0)}
                  className="p-1 rounded bg-mirari-surface border border-mirari-border hover:text-white transition"
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
              className="w-full accent-white bg-mirari-surface h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between items-center text-[11px] text-mirari-dim">
              <span>手動拖動檢視任意時刻光通量</span>
              <button
                onClick={() => setUseLimbDarkening(!useLimbDarkening)}
                className={`underline transition ${
                  useLimbDarkening ? 'text-mirari-cyan' : 'text-mirari-muted'
                }`}
              >
                {useLimbDarkening ? '切換為均勻圓盤' : '切換為周邊昏暗'}
              </button>
            </div>
          </div>
        </div>

        {/* Scientific Integrity Box */}
        <div className="rounded-xl border border-mirari-border/60 bg-mirari-bg/60 p-4 text-xs text-mirari-muted flex items-start space-x-3">
          <Info className="w-4 h-4 text-mirari-cyan shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-medium text-white">教學模型之簡化假設聲明：</span>
            <p className="text-mirari-dim leading-relaxed">
              本模擬器採用一階線性周邊昏暗近似（Linear Limb Darkening: $I(\mu) = I_0(1 - u(1 - \mu))$）與正圓對稱軌道。
              真實天文巡天（如 Kepler、TESS 與 JWST）在解算光度曲線時，必須納入非線性四參數昏暗定律、恆星自轉引發之重力昏暗（Gravity Darkening）、恆星表面黑子群（Starspots）以及儀器光度噪聲（Photometric Noise），不得將本簡化模型結果直接等同於任意未經修正之原始觀測數據。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
