import React, { useState, useEffect, useRef, useMemo } from 'react';

type RegimeKind = 'normal' | 'barrierless' | 'inverted';
type PresetKey = 'normal' | 'barrierless' | 'inverted' | 'photosynthesis' | 'custom';

interface ParticleState {
  phase: number;
  freq: number;
  ampScale: number;
  isTransferred: boolean;
  flashAlpha: number;
}

const KB_EV = 8.617333262e-5; // Boltzmann constant in eV / K
const HBAR_EV_S = 6.582119569e-16; // Reduced Planck constant in eV * s
const H_AB_EV = 1.2e-3; // Electronic coupling |H_AB| = 1.2 meV (non-adiabatic regime)

const REGIME_META: Record<
  RegimeKind,
  {
    label: string;
    shortTag: string;
    colorHex: string;
    badgeClass: string;
    toneClass: string;
  }
> = {
  normal: {
    label: '正常區 (Normal Region: -ΔG° < λ)',
    shortTag: '正常區 · q‡ > 0（右壁交點）',
    colorHex: '#38bdf8',
    badgeClass: 'border-sky-400/50 bg-sky-500/15 text-sky-300',
    toneClass: 'text-sky-300',
  },
  barrierless: {
    label: '無壘極大值 (Barrierless Peak: -ΔG° ≈ λ)',
    shortTag: '無壘極大值 · q‡ ≈ 0（穿過反應物谷底）',
    colorHex: '#10b981',
    badgeClass: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300',
    toneClass: 'text-emerald-300',
  },
  inverted: {
    label: '馬庫斯倒置區 (Inverted Region: -ΔG° > λ)',
    shortTag: '倒置區 · q‡ < 0（交點爬上左牆）',
    colorHex: '#fb7185',
    badgeClass: 'border-rose-400/60 bg-rose-500/20 text-rose-300',
    toneClass: 'text-rose-300',
  },
};

function computeActivationEnergy(lambdaEv: number, drivingForceEv: number): number {
  const deltaG0 = -drivingForceEv;
  const sum = lambdaEv + deltaG0;
  return (sum * sum) / (4 * lambdaEv);
}

function computeCrossingCoord(lambdaEv: number, drivingForceEv: number): number {
  const deltaG0 = -drivingForceEv;
  return (lambdaEv + deltaG0) / (2 * lambdaEv);
}

function computeMarcusRate(lambdaEv: number, drivingForceEv: number, tempK: number): number {
  const kBT = KB_EV * tempK;
  const prefactor =
    ((2 * Math.PI) / HBAR_EV_S) *
    ((H_AB_EV * H_AB_EV) / Math.sqrt(4 * Math.PI * lambdaEv * kBT));
  const deltaGAct = computeActivationEnergy(lambdaEv, drivingForceEv);
  const exponent = -deltaGAct / kBT;
  if (exponent < -700) return 0;
  return prefactor * Math.exp(exponent);
}

function computeDiffusionCeilingRate(tempK: number): number {
  // Apparent pseudo-first-order encounter ceiling ~10^8 s^-1 at 298 K, scaling mildly with T
  return 1.0e8 * (tempK / 298);
}

function computeDiffusionLimitedRate(kEt: number, kDiffEff: number): number {
  if (kEt <= 0) return 0;
  return (kDiffEff * kEt) / (kDiffEff + kEt);
}

function formatRateScientific(rate: number): string {
  if (rate <= 0 || !Number.isFinite(rate)) return '< 10⁻¹⁰⁰';
  const exp = Math.floor(Math.log10(rate));
  const mantissa = rate / Math.pow(10, exp);
  return `${mantissa.toFixed(2)} × 10^${exp}`;
}

function getDprCanvasSize(
  canvas: HTMLCanvasElement,
  fallbackW: number,
  heightCss: number
): { w: number; h: number; dpr: number } {
  const measuredW = canvas.clientWidth || fallbackW;
  const w = Math.max(220, Math.floor(measuredW));
  const h = heightCss;
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const targetW = Math.floor(w * dpr);
  const targetH = Math.floor(h * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  return { w, h, dpr };
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleRad: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.45);
  ctx.lineTo(-size, size * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export const MarcusElectronTransferSimulator: React.FC = () => {
  const [lambdaEv, setLambdaEv] = useState<number>(0.8);
  const [drivingForceEv, setDrivingForceEv] = useState<number>(1.55);
  const [tempK, setTempK] = useState<number>(298);
  const [showDiffusionLimit, setShowDiffusionLimit] = useState<boolean>(true);
  const [showPhotoMarker, setShowPhotoMarker] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const parabolaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bellCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const paramsRef = useRef({
    lambdaEv,
    drivingForceEv,
    tempK,
    showDiffusionLimit,
    showPhotoMarker,
    isPaused,
  });

  useEffect(() => {
    paramsRef.current = {
      lambdaEv,
      drivingForceEv,
      tempK,
      showDiffusionLimit,
      showPhotoMarker,
      isPaused,
    };
  }, [lambdaEv, drivingForceEv, tempK, showDiffusionLimit, showPhotoMarker, isPaused]);

  const particlesRef = useRef<ParticleState[]>(
    Array.from({ length: 18 }, (_, i) => ({
      phase: (i * Math.PI * 2) / 18,
      freq: 1.5 + (i % 5) * 0.25,
      ampScale: 0.45 + ((i * 7) % 10) * 0.11,
      isTransferred: false,
      flashAlpha: 0,
    }))
  );

  const regime: RegimeKind = useMemo(() => {
    const diff = drivingForceEv - lambdaEv;
    if (Math.abs(diff) <= 0.035) return 'barrierless';
    return diff < 0 ? 'normal' : 'inverted';
  }, [lambdaEv, drivingForceEv]);

  const activePreset: PresetKey = useMemo(() => {
    if (
      Math.abs(lambdaEv - 0.8) < 0.02 &&
      Math.abs(drivingForceEv - 0.3) < 0.02 &&
      Math.abs(tempK - 298) <= 5
    ) {
      return 'normal';
    }
    if (
      Math.abs(lambdaEv - 0.8) < 0.02 &&
      Math.abs(drivingForceEv - 0.8) < 0.02 &&
      Math.abs(tempK - 298) <= 5
    ) {
      return 'barrierless';
    }
    if (
      Math.abs(lambdaEv - 0.8) < 0.02 &&
      Math.abs(drivingForceEv - 1.55) < 0.02 &&
      Math.abs(tempK - 298) <= 5
    ) {
      return 'inverted';
    }
    if (
      Math.abs(lambdaEv - 0.35) < 0.02 &&
      Math.abs(drivingForceEv - 1.35) < 0.02 &&
      Math.abs(tempK - 298) <= 5
    ) {
      return 'photosynthesis';
    }
    return 'custom';
  }, [lambdaEv, drivingForceEv, tempK]);

  const deltaGAct = useMemo(
    () => computeActivationEnergy(lambdaEv, drivingForceEv),
    [lambdaEv, drivingForceEv]
  );
  const qCross = useMemo(
    () => computeCrossingCoord(lambdaEv, drivingForceEv),
    [lambdaEv, drivingForceEv]
  );
  const kEt = useMemo(
    () => computeMarcusRate(lambdaEv, drivingForceEv, tempK),
    [lambdaEv, drivingForceEv, tempK]
  );
  const kPeak = useMemo(
    () => computeMarcusRate(lambdaEv, lambdaEv, tempK),
    [lambdaEv, tempK]
  );
  const kDiffCeiling = useMemo(() => computeDiffusionCeilingRate(tempK), [tempK]);
  const kDiffLimited = useMemo(
    () => computeDiffusionLimitedRate(kEt, kDiffCeiling),
    [kEt, kDiffCeiling]
  );

  const log10KEt = kEt > 0 ? Math.log10(kEt) : -99;
  const log10KPeak = kPeak > 0 ? Math.log10(kPeak) : 0;

  const applyPreset = (preset: Exclude<PresetKey, 'custom'>) => {
    if (preset === 'normal') {
      setLambdaEv(0.8);
      setDrivingForceEv(0.3);
      setTempK(298);
    } else if (preset === 'barrierless') {
      setLambdaEv(0.8);
      setDrivingForceEv(0.8);
      setTempK(298);
    } else if (preset === 'inverted') {
      setLambdaEv(0.8);
      setDrivingForceEv(1.55);
      setTempK(298);
    } else {
      setLambdaEv(0.35);
      setDrivingForceEv(1.35);
      setTempK(298);
      setShowPhotoMarker(true);
    }
  };

  useEffect(() => {
    let rafId = 0;
    let tAnim = 0;

    const drawParabolas = (
      canvas: HTMLCanvasElement | null,
      lam: number,
      df: number,
      tK: number,
      dtAnim: number
    ) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { w, h, dpr } = getDprCanvasSize(canvas, 460, 300);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = '#060c18';
      ctx.fillRect(0, 0, w, h);

      const dG0 = -df;
      const qCrossVal = (lam + dG0) / (2 * lam);
      const dGActVal = ((lam + dG0) * (lam + dG0)) / (4 * lam);
      const kBT = KB_EV * tK;
      const probCross = Math.exp(-dGActVal / kBT);

      // Coordinate bounds
      const qMin = Math.max(-1.85, Math.min(-0.8, qCrossVal - 0.28));
      const qMax = 1.48;
      const gMin = -2.38;
      const gMax = Math.max(1.75, Math.min(4.2, dGActVal + 0.38, lam + 0.35));

      const padL = 44;
      const padR = 20;
      const padT = 26;
      const padB = 34;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const xOf = (q: number) => padL + ((q - qMin) / (qMax - qMin)) * plotW;
      const yOf = (g: number) => padT + ((gMax - g) / (gMax - gMin)) * plotH;

      // Subtle grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      for (const gTick of [-2, -1, 0, 1, 2, 3]) {
        if (gTick < gMin || gTick > gMax) continue;
        const gy = yOf(gTick);
        ctx.beginPath();
        ctx.moveTo(padL, gy);
        ctx.lineTo(w - padR, gy);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${gTick.toFixed(0)}`, padL - 6, gy + 3);
      }

      // Highlight G = 0 baseline
      const yZero = yOf(0);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, yZero);
      ctx.lineTo(w - padR, yZero);
      ctx.stroke();
      ctx.setLineDash([]);

      // Y axis & X axis labels
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, h - padB);
      ctx.lineTo(w - padR, h - padB);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('G (eV)', 6, padT + 4);
      ctx.textAlign = 'center';
      ctx.fillText('反應座標 q（溶劑偶極與核構型極化）', padL + plotW / 2, h - 8);

      // Tick labels for q = 0 and q = 1
      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('q=0 (R)', xOf(0), h - padB + 13);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('q=1 (P)', xOf(1), h - padB + 13);

      // Clip plot region for parabolas
      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      // Draw Reactant Parabola G_R(q) = lambda * q^2
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const steps = 160;
      for (let i = 0; i <= steps; i++) {
        const q = qMin + (i / steps) * (qMax - qMin);
        const g = lam * q * q;
        const px = xOf(q);
        const py = yOf(g);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Draw Product Parabola G_P(q) = lambda * (q - 1)^2 + dG0
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const q = qMin + (i / steps) * (qMax - qMin);
        const g = lam * (q - 1) * (q - 1) + dG0;
        const px = xOf(q);
        const py = yOf(g);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Draw Franck-Condon vertical transition line at q = 0
      const xQ0 = xOf(0);
      const yGP0 = yOf(lam + dG0);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.38)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(xQ0, yZero);
      ctx.lineTo(xQ0, yGP0);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Reorganization Energy lambda vertical arrow at q = 1 (from G=0 up to G_R(1)=lambda)
      const xQ1 = xOf(1);
      const yGR1 = yOf(lam);
      const yGP1 = yOf(dG0);
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xQ1 - 7, yZero);
      ctx.lineTo(xQ1 - 7, yGR1);
      ctx.stroke();
      drawArrowHead(ctx, xQ1 - 7, yGR1, -Math.PI / 2, 6, '#a78bfa');
      drawArrowHead(ctx, xQ1 - 7, yZero, Math.PI / 2, 6, '#a78bfa');

      ctx.fillStyle = '#c4b5fd';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`λ=${lam.toFixed(2)}`, xQ1 - 12, (yZero + yGR1) / 2 + 3);

      // Draw Driving Force -Delta G0 vertical arrow at q = 1 (from G=0 down to G_P(1)=dG0)
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xQ1 + 7, yZero);
      ctx.lineTo(xQ1 + 7, yGP1);
      ctx.stroke();
      drawArrowHead(ctx, xQ1 + 7, yGP1, Math.PI / 2, 6, '#fbbf24');
      drawArrowHead(ctx, xQ1 + 7, yZero, -Math.PI / 2, 6, '#fbbf24');

      ctx.fillStyle = '#fcd34d';
      ctx.textAlign = 'left';
      const dfLabelX = Math.min(w - padR - 4, xQ1 + 12);
      if (dfLabelX < w - padR - 36) {
        ctx.fillText(`-ΔG°=${df.toFixed(2)}`, dfLabelX, (yZero + yGP1) / 2 + 3);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(`-ΔG°=${df.toFixed(2)}`, xQ1 - 2, (yZero + yGP1) / 2 + 12);
      }

      // Highlight Activation Energy Barrier Delta G‡ at crossing q‡
      const curRegime: RegimeKind =
        Math.abs(df - lam) <= 0.035 ? 'barrierless' : df < lam ? 'normal' : 'inverted';
      const regimeColor = REGIME_META[curRegime].colorHex;

      const qCrossVisible = qCrossVal >= qMin && qCrossVal <= qMax && dGActVal <= gMax;
      if (qCrossVisible) {
        const xCross = xOf(qCrossVal);
        const yCross = yOf(dGActVal);

        // Highlighted barrier ruler
        if (dGActVal > 0.015) {
          ctx.strokeStyle = regimeColor;
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(xCross, yZero);
          ctx.lineTo(xCross, yCross);
          ctx.stroke();

          // Horizontal cap ticks
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(xCross - 5, yZero);
          ctx.lineTo(xCross + 5, yZero);
          ctx.moveTo(xCross - 5, yCross);
          ctx.lineTo(xCross + 5, yCross);
          ctx.stroke();
        }

        // Glow at crossing point
        const grad = ctx.createRadialGradient(xCross, yCross, 1, xCross, yCross, 14);
        grad.addColorStop(0, regimeColor);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(xCross, yCross, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(xCross, yCross, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = regimeColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Barrier label near crossing
        ctx.fillStyle = regimeColor;
        ctx.font = 'bold 10px ui-monospace, monospace';
        const alignRight = xCross > padL + plotW * 0.6;
        ctx.textAlign = alignRight ? 'right' : 'left';
        const lx = alignRight ? xCross - 9 : xCross + 9;
        const ly = Math.max(padT + 14, yCross - 8);
        ctx.fillText(`ΔG‡=${dGActVal.toFixed(2)} eV`, lx, ly);
      } else {
        // Extreme corner indicator when crossing climbs beyond viewport
        ctx.fillStyle = '#fb7185';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(
          `← 左壁交點攀升至 q‡=${qCrossVal.toFixed(2)}, ΔG‡=${dGActVal.toFixed(2)} eV`,
          padL + 6,
          padT + 15
        );
      }

      // Animate Boltzmann-distributed microscopic particles along reactant & crossing
      const sigmaQ = Math.sqrt(kBT / (2 * lam));
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const pt = particles[i];
        pt.phase += dtAnim * pt.freq;

        // Thermal oscillation amplitude proportional to sqrt(kBT / 2*lambda)
        let qPos = Math.sin(pt.phase) * sigmaQ * pt.ampScale * 2.1;

        // Periodic barrier-crossing attempt visualization scaled by Boltzmann factor
        const cycle = (pt.phase / (Math.PI * 2)) % 1;
        const crossWindow = Math.max(0.03, Math.min(0.42, 0.04 + 0.38 * Math.pow(probCross, 0.28)));
        let onProduct = false;

        if (cycle < crossWindow && probCross > 1e-12 && qCrossVisible) {
          const u = cycle / crossWindow;
          if (u < 0.45) {
            qPos = (u / 0.45) * qCrossVal;
          } else {
            onProduct = true;
            qPos = qCrossVal + ((u - 0.45) / 0.55) * (1.0 - qCrossVal);
          }
        }

        const gPos = onProduct
          ? lam * (qPos - 1) * (qPos - 1) + dG0
          : lam * qPos * qPos;
        const px = xOf(qPos);
        const py = yOf(gPos);

        if (px >= padL && px <= w - padR && py >= padT && py <= h - padB) {
          ctx.fillStyle = onProduct
            ? 'rgba(251, 191, 36, 0.92)'
            : 'rgba(56, 189, 248, 0.86)';
          ctx.beginPath();
          ctx.arc(px, py, onProduct ? 3.2 : 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Curve labels inside plot
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText('G_R(q) 反應物', xOf(0) - 28, Math.min(h - padB - 14, yZero + 16));
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'center';
      ctx.fillText('G_P(q) 產物', xOf(1), Math.min(h - padB - 8, yGP1 + 16));

      // Crossing probability watermark
      ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      const probDisplay =
        probCross >= 0.001
          ? `${(probCross * 100).toFixed(2)}%`
          : probCross > 0
          ? probCross.toExponential(1)
          : '< 10⁻⁹⁹';
      ctx.fillText(`熱越障機率 exp(-ΔG‡/kBT) ≈ ${probDisplay}`, padL + 8, padT + 14);

      ctx.restore();
      ctx.restore();
    };

    const drawBellCurve = (
      canvas: HTMLCanvasElement | null,
      lam: number,
      df: number,
      tK: number,
      showDiff: boolean,
      showPhoto: boolean
    ) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { w, h, dpr } = getDprCanvasSize(canvas, 460, 300);
      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#060c18';
      ctx.fillRect(0, 0, w, h);

      const dfMin = 0.0;
      const dfMax = 2.25;
      const logMin = -1.0;
      const logMax = 11.8;

      const padL = 44;
      const padR = 18;
      const padT = 26;
      const padB = 34;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const xOf = (d: number) => padL + ((d - dfMin) / (dfMax - dfMin)) * plotW;
      const yOf = (logR: number) =>
        padT + ((logMax - logR) / (logMax - logMin)) * plotH;

      // Region background tinting (Normal vs Inverted)
      const xLambda = Math.min(w - padR, Math.max(padL, xOf(lam)));
      ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.fillRect(padL, padT, xLambda - padL, plotH);
      ctx.fillStyle = 'rgba(251, 113, 133, 0.06)';
      ctx.fillRect(xLambda, padT, w - padR - xLambda, plotH);

      // Photosynthetic Charge Recombination Suppression Zone marker
      if (showPhoto) {
        const xRecL = xOf(1.15);
        const xRecR = xOf(1.75);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.11)';
        ctx.fillRect(xRecL, padT, xRecR - xRecL, plotH);
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(xRecL, padT, xRecR - xRecL, plotH);
        ctx.setLineDash([]);

        ctx.fillStyle = '#34d399';
        ctx.font = '9.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('光合反應中心', (xRecL + xRecR) / 2, padT + 12);
        ctx.fillText('逆向電荷復合抑制區', (xRecL + xRecR) / 2, padT + 23);
      }

      // Grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      for (let logTick = 0; logTick <= 10; logTick += 2) {
        const gy = yOf(logTick);
        ctx.beginPath();
        ctx.moveTo(padL, gy);
        ctx.lineTo(w - padR, gy);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`10^${logTick}`, padL - 5, gy + 3);
      }

      for (const dfTick of [0.5, 1.0, 1.5, 2.0]) {
        const gx = xOf(dfTick);
        ctx.beginPath();
        ctx.moveTo(gx, padT);
        ctx.lineTo(gx, h - padB);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(dfTick.toFixed(1), gx, h - padB + 13);
      }

      // Axes
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, h - padB);
      ctx.lineTo(w - padR, h - padB);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('k_ET (s⁻¹)', 6, padT - 10);
      ctx.textAlign = 'center';
      ctx.fillText('熱力學驅動力 -ΔG° (eV)', padL + plotW / 2, h - 8);

      // Vertical dashed line at -Delta G° = lambda (Barrierless peak)
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(xLambda, padT);
      ctx.lineTo(xLambda, h - padB);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = xLambda > padL + plotW * 0.72 ? 'right' : 'left';
      ctx.fillText(
        `-ΔG°=λ (${lam.toFixed(2)})`,
        xLambda > padL + plotW * 0.72 ? xLambda - 4 : xLambda + 4,
        h - padB - 6
      );

      // Clip plot curves
      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, plotW, plotH);
      ctx.clip();

      const kDiffEff = computeDiffusionCeilingRate(tK);
      const samples = 180;

      // 1. Intramolecular Rigid Spacer Curve (Full Bell Curve - Miller-Calcaterra-Closs 1984)
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= samples; i++) {
        const d = dfMin + (i / samples) * (dfMax - dfMin);
        const rate = computeMarcusRate(lam, d, tK);
        const logR = rate > 0 ? Math.log10(rate) : logMin - 5;
        const px = xOf(d);
        const py = yOf(Math.max(logMin - 2, logR));
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      // 2. Solution Bimolecular Diffusion-Limited Curve (Flat Plateau Masking!)
      if (showDiff) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
          const d = dfMin + (i / samples) * (dfMax - dfMin);
          const rate = computeMarcusRate(lam, d, tK);
          const obsRate = computeDiffusionLimitedRate(rate, kDiffEff);
          const logR = obsRate > 0 ? Math.log10(obsRate) : logMin - 5;
          const px = xOf(d);
          const py = yOf(Math.max(logMin - 2, logR));
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Label plateau
        const yDiff = yOf(Math.log10(kDiffEff));
        ctx.fillStyle = '#fcd34d';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('雙分子擴散極限平頂 (遮蔽倒置區)', padL + 8, yDiff - 6);
      }

      // Forward Charge Separation mark when photosynthesis overlay is on
      if (showPhoto) {
        const peakRate = computeMarcusRate(lam, lam, tK);
        const yPeak = yOf(Math.log10(peakRate));
        ctx.fillStyle = '#6ee7b7';
        ctx.beginPath();
        ctx.arc(xLambda, yPeak, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Current operating point marker
      const curRate = computeMarcusRate(lam, df, tK);
      const curLog = curRate > 0 ? Math.log10(curRate) : logMin - 2;
      const curX = xOf(df);
      const curY = yOf(Math.max(logMin + 0.15, Math.min(logMax - 0.15, curLog)));
      const curRegime: RegimeKind =
        Math.abs(df - lam) <= 0.035 ? 'barrierless' : df < lam ? 'normal' : 'inverted';
      const dotColor = REGIME_META[curRegime].colorHex;

      // Crosshairs
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(curX, h - padB);
      ctx.lineTo(curX, curY);
      ctx.lineTo(padL, curY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Glow dot
      const pulse = 9 + Math.sin(tAnim * 4) * 2.5;
      const glow = ctx.createRadialGradient(curX, curY, 1, curX, curY, pulse);
      glow.addColorStop(0, dotColor);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(curX, curY, pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(curX, curY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = dotColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label current point
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px ui-monospace, monospace';
      const labelRight = curX < padL + plotW * 0.62;
      ctx.textAlign = labelRight ? 'left' : 'right';
      const rateText =
        curLog >= logMin
          ? `log₁₀ k = ${curLog.toFixed(1)}`
          : `log₁₀ k = ${curLog.toFixed(0)} (極慢)`;
      ctx.fillText(
        rateText,
        labelRight ? curX + 8 : curX - 8,
        Math.max(padT + 14, curY - 8)
      );

      // Region corner text
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.78)';
      ctx.textAlign = 'left';
      ctx.fillText('正常區', padL + 6, h - padB - 8);
      if (xLambda < w - padR - 46) {
        ctx.fillStyle = 'rgba(251, 113, 133, 0.85)';
        ctx.textAlign = 'right';
        ctx.fillText('馬庫斯倒置區', w - padR - 6, h - padB - 8);
      }

      ctx.restore();
      ctx.restore();
    };

    const renderFrame = () => {
      const p = paramsRef.current;
      const dtAnim = p.isPaused ? 0 : 0.028;
      tAnim += dtAnim;

      drawParabolas(parabolaCanvasRef.current, p.lambdaEv, p.drivingForceEv, p.tempK, dtAnim);
      drawBellCurve(
        bellCanvasRef.current,
        p.lambdaEv,
        p.drivingForceEv,
        p.tempK,
        p.showDiffusionLimit,
        p.showPhotoMarker
      );

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const regimeMeta = REGIME_META[regime];

  return (
    <div className="my-8 rounded-2xl border border-slate-800 bg-slate-900/95 p-4 text-slate-100 shadow-xl sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-sky-300">
              馬庫斯電子轉移雙視圖實驗室
            </span>
            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${regimeMeta.badgeClass}`}>
              {regimeMeta.shortTag}
            </span>
          </div>
          <h3 className="mt-1.5 text-base font-bold text-slate-100 sm:text-lg">
            簡諧自由能拋物線交點與對數速率鐘形倒置曲線
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            拖動熱力學驅動力 -ΔG° 跨越重組能 λ，親眼見證兩條拋物線交點如何從右壁滑過反應物谷底，再反過來「爬上左側高牆」推高活化能 ΔG‡。
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPaused((v) => !v)}
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            {isPaused ? '▶ 繼續熱漲落' : '⏸ 暫停粒子'}
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => applyPreset('normal')}
          className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
            activePreset === 'normal'
              ? 'border-sky-400 bg-sky-500/20 text-sky-200'
              : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
          }`}
        >
          正常區 (-ΔG° &lt; λ)
        </button>
        <button
          type="button"
          onClick={() => applyPreset('barrierless')}
          className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
            activePreset === 'barrierless'
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
              : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
          }`}
        >
          無壘極大值 (-ΔG° = λ)
        </button>
        <button
          type="button"
          onClick={() => applyPreset('inverted')}
          className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
            activePreset === 'inverted'
              ? 'border-rose-400 bg-rose-500/20 text-rose-200'
              : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
          }`}
        >
          馬庫斯倒置區 (-ΔG° &gt; λ)
        </button>
        <button
          type="button"
          onClick={() => applyPreset('photosynthesis')}
          className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
            activePreset === 'photosynthesis'
              ? 'border-teal-400 bg-teal-500/20 text-teal-200'
              : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
          }`}
        >
          光合反應中心逆向抑制 (低 λ, 深倒置)
        </button>
      </div>

      {/* Dual Linked Views */}
      <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* Panel 1: Free Energy Parabolas */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 lg:col-span-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              面板一：雙自由能拋物線 G<sub>R</sub>(q), G<sub>P</sub>(q) 相交圖
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-sky-400" />
                反應物 G<sub>R</sub>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-amber-400" />
                產物 G<sub>P</sub>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
                活化能 ΔG<sup>‡</sup>
              </span>
            </div>
          </div>
          <canvas
            ref={parabolaCanvasRef}
            className="block w-full rounded-lg"
            style={{ height: '300px' }}
          />
        </div>

        {/* Panel 2: Bell Curve */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 lg:col-span-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              面板二：log<sub>10</sub> k<sub>ET</sub> vs -ΔG° 鐘形倒置曲線
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-cyan-400" />
                剛性分子內轉移
              </span>
              {showDiffusionLimit && (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-0.5 w-3 border-b border-dashed border-amber-400" />
                  溶液擴散極限
                </span>
              )}
            </div>
          </div>
          <canvas
            ref={bellCanvasRef}
            className="block w-full rounded-lg"
            style={{ height: '300px' }}
          />
          {/* Overlay toggles */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setShowDiffusionLimit((v) => !v)}
              className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                showDiffusionLimit
                  ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {showDiffusionLimit ? '✓ ' : ''}溶液雙分子擴散受限基準（平頂遮蔽）
            </button>
            <button
              type="button"
              onClick={() => setShowPhotoMarker((v) => !v)}
              className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                showPhotoMarker
                  ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {showPhotoMarker ? '✓ ' : ''}光合反應中心逆向復合抑制區標記
            </button>
          </div>
        </div>
      </div>

      {/* Live Telemetry */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">交點座標 q<sup>‡</sup></div>
          <div className={`mt-1 font-mono text-sm font-bold sm:text-base ${regimeMeta.toneClass}`}>
            {qCross.toFixed(3)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            {qCross > 0.02 ? '反應物右壁' : qCross < -0.02 ? '反應物左牆 (倒置)' : '反應物拋物線谷底'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">活化能障礙 ΔG<sup>‡</sup></div>
          <div className={`mt-1 font-mono text-sm font-bold sm:text-base ${regimeMeta.toneClass}`}>
            {deltaGAct.toFixed(3)} <span className="text-xs font-normal text-slate-400">eV</span>
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            (λ + ΔG°)² / (4λ)
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">分子內速率 k<sub>ET</sub></div>
          <div className="mt-1 font-mono text-sm font-bold text-cyan-300 sm:text-base">
            {formatRateScientific(kEt)} <span className="text-xs font-normal text-slate-400">s⁻¹</span>
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            峰值 log₁₀ k<sub>max</sub> = {log10KPeak.toFixed(1)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">速率對比 / 擴散上限</div>
          <div className="mt-1 font-mono text-sm font-bold text-amber-300 sm:text-base">
            {log10KEt > -50 ? `10^${log10KEt.toFixed(1)}` : '< 10⁻⁵⁰'}
            <span className="text-xs font-normal text-slate-400">
              {' '}/ 10^{Math.log10(kDiffLimited).toFixed(1)}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            剛性分子內 vs 溶液擴散表觀
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Slider 1: Reorganization Energy lambda */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">重組能 λ (內層+溶劑)</span>
            <span className="font-mono font-bold text-purple-300">{lambdaEv.toFixed(2)} eV</span>
          </div>
          <input
            type="range"
            min={0.25}
            max={1.5}
            step={0.05}
            value={lambdaEv}
            onChange={(e) => setLambdaEv(parseFloat(e.target.value))}
            className="mt-2 w-full cursor-pointer accent-purple-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0.25 (低極性蛋白)</span>
            <span>0.80</span>
            <span>1.50 (強極性溶劑)</span>
          </div>
        </div>

        {/* Slider 2: Thermodynamic Driving Force -Delta G0 */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">熱力學驅動力 -ΔG°</span>
            <span className={`font-mono font-bold ${regimeMeta.toneClass}`}>
              {drivingForceEv.toFixed(2)} eV
            </span>
          </div>
          <input
            type="range"
            min={0.05}
            max={2.2}
            step={0.05}
            value={drivingForceEv}
            onChange={(e) => setDrivingForceEv(parseFloat(e.target.value))}
            className="mt-2 w-full cursor-pointer accent-cyan-500"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>0.05</span>
            <button
              type="button"
              onClick={() => setDrivingForceEv(lambdaEv)}
              className="cursor-pointer rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300 hover:bg-emerald-500/20"
            >
              對齊峰頂 λ={lambdaEv.toFixed(2)}
            </button>
            <span>2.20 eV</span>
          </div>
        </div>

        {/* Slider 3: Temperature T */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">反應溫度 T</span>
            <span className="font-mono font-bold text-amber-300">
              {tempK} K (k<sub>B</sub>T={(KB_EV * tempK * 1000).toFixed(1)} meV)
            </span>
          </div>
          <input
            type="range"
            min={150}
            max={450}
            step={5}
            value={tempK}
            onChange={(e) => setTempK(parseInt(e.target.value, 10))}
            className="mt-2 w-full cursor-pointer accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>150 K (低溫銳化)</span>
            <span>298 K</span>
            <span>450 K (熱寬化)</span>
          </div>
        </div>
      </div>

      {/* Explicit Model Boundary Annotation */}
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs leading-relaxed text-amber-100/90">
        <div className="font-semibold text-amber-300">模型近似與物理邊界聲明</div>
        <p className="mt-1">
          高溫經典／半經典簡諧等曲率拋物線模型（預設非絕熱電子耦合{' '}
          <span className="font-mono">|H_AB| = 1.2 meV</span>）；在極低溫或強烈高頻分子內振動模耦合時，量子核穿隧將使倒置區速率衰減呈現較經典拋物線平緩的指數尾。此外，溶液雙分子擴散基準以表觀碰撞速率上限（約 10⁸ s⁻¹）呈現擴散平頂遮蔽機制。
        </p>
      </div>
    </div>
  );
};
