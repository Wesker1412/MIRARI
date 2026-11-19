import React, { useState, useEffect, useRef, useMemo } from 'react';

type ForecastMode = 'deterministic_mse' | 'classical_ensemble' | 'diffusion_denoising';

interface TrackPoint {
  x: number; // normalized [0, 1]
  y: number; // normalized [0, 1]
  intensity: number; // relative vortex strength [0, 1]
}

interface EnsembleMember {
  id: number;
  branch: 'landfall' | 'recurve';
  points: TrackPoint[];
  finalLandfallDist: number;
}

const NUM_MEMBERS = 14;
const TOTAL_STEPS = 30; // Day 0 -> Day 15 in 12h steps (360h)
const MAX_DENOISE_K = 20;

// Deterministic pseudo-random generator (Mulberry32) so seed switching is reproducible
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianFromRng(rng: () => number): number {
  const u1 = Math.max(1e-6, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Compute physical-like 2D bimodal cyclone track from initial perturbation and steering bifurcation
function generateMemberTrack(
  rng: () => number,
  uncertaintySigma: number,
  isLandfallBias: boolean,
  id: number
): EnsembleMember {
  const g1 = gaussianFromRng(rng);
  const g2 = gaussianFromRng(rng);
  const g3 = gaussianFromRng(rng);

  // Initial storm origin in western tropical ocean (bottom-right quadrant)
  const startX = 0.78 + g1 * 0.012 * uncertaintySigma;
  const startY = 0.80 + g2 * 0.012 * uncertaintySigma;

  // Bifurcation probability modulated by uncertaintySigma and steering saddle
  const branchScore = (isLandfallBias ? -0.45 : 0.45) + g3 * (0.25 + 0.55 * uncertaintySigma);
  const branch: 'landfall' | 'recurve' = branchScore < 0 ? 'landfall' : 'recurve';

  const points: TrackPoint[] = [];
  const spreadScale = 0.025 + 0.095 * uncertaintySigma;

  for (let step = 0; step <= TOTAL_STEPS; step++) {
    const tau = step / TOTAL_STEPS; // 0 (Day 0) -> 1 (Day 15)
    // Common early WNW drift before hitting the subtropical ridge saddle (~tau = 0.25..0.35)
    const commonX = startX - 0.24 * Math.min(tau, 0.32) - 0.04 * tau;
    const commonY = startY - 0.30 * Math.min(tau, 0.32);

    // Post-saddle bifurcation factor
    const split = Math.max(0, (tau - 0.24) / 0.76);
    const splitSmooth = split * split * (3 - 2 * split);

    let bx = 0;
    let by = 0;
    let intensity = 0.65 + 0.3 * Math.sin(tau * Math.PI * 0.85);

    if (branch === 'landfall') {
      // Branch A: Subtropical ridge holds firm -> storm tracks WNW into coastline (x ~ 0.16, y ~ 0.30)
      bx = -0.34 * splitSmooth + g1 * spreadScale * Math.pow(tau, 0.85) * 0.55;
      by = -0.22 * splitSmooth + g2 * spreadScale * Math.pow(tau, 0.85) * 0.55;
      // Slight dissipation after landfall near the end
      if (tau > 0.78) {
        intensity *= Math.max(0.45, 1 - (tau - 0.78) * 1.9);
      }
    } else {
      // Branch B: Ridge weakens -> storm recurves NNE into mid-latitude westerlies (x ~ 0.76, y ~ 0.12)
      bx = 0.28 * Math.pow(splitSmooth, 1.15) + g1 * spreadScale * Math.pow(tau, 0.9) * 0.65;
      by = -0.44 * splitSmooth + g2 * spreadScale * Math.pow(tau, 0.9) * 0.55;
      intensity *= 0.92;
    }

    // Subtle synoptic wiggle
    const wiggle = Math.sin(tau * Math.PI * 3 + id * 0.9) * 0.012 * uncertaintySigma * splitSmooth;

    points.push({
      x: Math.max(0.05, Math.min(0.95, commonX + bx + wiggle)),
      y: Math.max(0.06, Math.min(0.94, commonY + by - wiggle * 0.6)),
      intensity: Math.max(0.25, Math.min(1.0, intensity)),
    });
  }

  const endPt = points[points.length - 1];
  const coastX = 0.24;
  const finalLandfallDist = Math.max(0, endPt.x - coastX);

  return {
    id,
    branch,
    points,
    finalLandfallDist,
  };
}

function getDprCanvasSize(
  canvas: HTMLCanvasElement,
  fallbackW: number,
  fallbackH: number
): { w: number; h: number; dpr: number } {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(240, Math.round(rect.width || fallbackW));
  const h = Math.max(180, Math.round(rect.height || fallbackH));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const targetW = Math.round(w * dpr);
  const targetH = Math.round(h * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  return { w, h, dpr };
}

export const GenCastEnsembleSimulator: React.FC = () => {
  const [mode, setMode] = useState<ForecastMode>('diffusion_denoising');
  const [denoiseStepK, setDenoiseStepK] = useState<number>(0); // 20 = pure Gaussian noise, 0 = fully denoised
  const [uncertaintySigma, setUncertaintySigma] = useState<number>(0.65);
  const [seed, setSeed] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const spatialCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [resizeTick, setResizeTick] = useState<number>(0);

  // Observe container resize for crisp responsive canvas rendering (390px -> 1280px)
  useEffect(() => {
    const el = spatialCanvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => {
      setResizeTick((t) => (t + 1) % 10000);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Playback timer for diffusion reverse denoising k: 20 -> 0
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setDenoiseStepK((prev) => {
        if (prev <= 0) {
          setIsPlaying(false);
          return 0;
        }
        return prev - 1;
      });
    }, 150);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  // Compute ensemble members, MSE mean path, and Day 1..15 CRPS & spread-skill curves
  const sim = useMemo(() => {
    const rng = mulberry32(seed * 7919 + 104729);
    const members: EnsembleMember[] = [];
    for (let i = 0; i < NUM_MEMBERS; i++) {
      // Alternate prior bias so bifurcation remains physically balanced at moderate/high uncertainty
      const bias = i % 2 === 0;
      members.push(generateMemberTrack(rng, uncertaintySigma, bias, i));
    }

    // Compute deterministic MSE mean path (conditional expectation across bimodal tracks)
    const mseMeanPath: TrackPoint[] = [];
    for (let step = 0; step <= TOTAL_STEPS; step++) {
      let sx = 0;
      let sy = 0;
      let varSum = 0;
      for (const m of members) {
        sx += m.points[step].x;
        sy += m.points[step].y;
      }
      const mx = sx / NUM_MEMBERS;
      const my = sy / NUM_MEMBERS;
      for (const m of members) {
        const dx = m.points[step].x - mx;
        const dy = m.points[step].y - my;
        varSum += dx * dx + dy * dy;
      }
      const spread = Math.sqrt(varSum / NUM_MEMBERS);
      // Blurring effect: peak vortex amplitude decays sharply as bimodal spatial spread grows!
      const sharpness = Math.exp(-spread * 11.5);
      mseMeanPath.push({
        x: mx,
        y: my,
        intensity: Math.max(0.18, sharpness),
      });
    }

    const landfallCount = members.filter((m) => m.branch === 'landfall').length;
    const landfallPct = Math.round((landfallCount / NUM_MEMBERS) * 100);
    const recurvePct = 100 - landfallPct;

    // Noise schedule sigma(k) for k in [0..20]
    const kFrac = denoiseStepK / MAX_DENOISE_K;
    const noiseLevel = Math.pow(kFrac, 1.35);

    // Day 1..15 calibration series (15 daily points)
    const days = Array.from({ length: 15 }, (_, idx) => idx + 1);
    const spreadSeries: number[] = [];
    const rmseSeries: number[] = [];
    const mseCrpsSeries: number[] = [];
    const classicalCrpsSeries: number[] = [];
    const gencastCrpsSeries: number[] = [];

    for (let d = 1; d <= 15; d++) {
      const tNorm = d / 15;
      // Chaotic error growth (Lorenz exponential onset saturating at synoptic scale)
      const chaosGrowth = 1 / (1 + Math.exp(-5.2 * (tNorm - 0.38)));
      const trueSkillErr = (0.14 + 0.72 * chaosGrowth) * (0.55 + 0.55 * uncertaintySigma);

      // GenCast calibrated spread tracks true RMSE closely once denoised (k -> 0);
      // at high k, un-denoised Gaussian noise inflates spread before converging.
      const gencastSpread = trueSkillErr * (0.94 + 0.08 * Math.sin(d * 0.6)) + noiseLevel * 0.42;
      spreadSeries.push(gencastSpread);
      rmseSeries.push(trueSkillErr);

      // CRPS (Continuous Ranked Probability Score - lower is better)
      // Deterministic MSE collapses to a point forecast (zero spread) -> severe CRPS penalty in bimodal regime
      const mseCrps = trueSkillErr * (1.05 + 0.62 * chaosGrowth * (0.5 + uncertaintySigma));
      // Classical physical ensemble (well spread, slightly under-dispersive/coarse at long lead time)
      const classicalCrps = trueSkillErr * (0.64 + 0.14 * tNorm);
      // GenCast conditional diffusion (sharp bimodal density + calibrated spread) when denoised
      const gencastCrps = trueSkillErr * (0.52 + 0.08 * tNorm) + noiseLevel * 0.55;

      mseCrpsSeries.push(mseCrps);
      classicalCrpsSeries.push(classicalCrps);
      gencastCrpsSeries.push(gencastCrps);
    }

    // Peak wind retention metric (at Day 7, step 14)
    const day7MseStrength = mseMeanPath[14].intensity;
    const peakWindRetentionPct =
      mode === 'deterministic_mse'
        ? Math.round(day7MseStrength * 100)
        : mode === 'classical_ensemble'
          ? 86
          : Math.round((1 - noiseLevel * 0.65) * 96);

    const day10Spread = spreadSeries[9];
    const day10Rmse = rmseSeries[9];
    const day10Crps =
      mode === 'deterministic_mse'
        ? mseCrpsSeries[9]
        : mode === 'classical_ensemble'
          ? classicalCrpsSeries[9]
          : gencastCrpsSeries[9];

    return {
      members,
      mseMeanPath,
      landfallCount,
      landfallPct,
      recurvePct,
      noiseLevel,
      days,
      spreadSeries,
      rmseSeries,
      mseCrpsSeries,
      classicalCrpsSeries,
      gencastCrpsSeries,
      peakWindRetentionPct,
      day10Spread,
      day10Rmse,
      day10Crps,
    };
  }, [seed, uncertaintySigma, denoiseStepK, mode]);

  // Draw Panel 1: 2D Bimodal Cyclone Steering & Diffusion Field
  useEffect(() => {
    const canvas = spatialCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h, dpr } = getDprCanvasSize(canvas, 500, 330);
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Deep ocean background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#040914');
    bgGrad.addColorStop(1, '#0b1628');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Subtle icosahedral geodesic mesh overlay (emphasized in diffusion_denoising mode)
    const meshAlpha = mode === 'diffusion_denoising' ? 0.14 : 0.05;
    ctx.strokeStyle = `rgba(56, 189, 248, ${meshAlpha})`;
    ctx.lineWidth = 0.8;
    const hexSize = 36;
    const rowH = hexSize * 0.866;
    for (let row = 0; row * rowH <= h + rowH; row++) {
      const y0 = row * rowH;
      const y1 = (row + 1) * rowH;
      const xOffset = row % 2 === 0 ? 0 : hexSize * 0.5;
      for (let col = -1; col * hexSize <= w + hexSize; col++) {
        const x0 = col * hexSize + xOffset;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + hexSize, y0);
        ctx.lineTo(x0 + hexSize * 0.5, y1);
        ctx.closePath();
        ctx.stroke();
      }
    }

    // 3. Western landmass & coastal shelf (Landfall hazard zone)
    ctx.fillStyle = '#111c2d';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.25, 0);
    ctx.bezierCurveTo(w * 0.28, h * 0.22, w * 0.21, h * 0.36, w * 0.24, h * 0.52);
    ctx.bezierCurveTo(w * 0.26, h * 0.68, w * 0.14, h * 0.84, w * 0.11, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Coastline warning zone highlight
    ctx.fillStyle = 'rgba(244, 63, 94, 0.12)';
    ctx.beginPath();
    ctx.arc(w * 0.23, h * 0.36, Math.min(w, h) * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('陸地與沿海人口區', 10, h * 0.16);
    ctx.fillStyle = '#fda4af';
    ctx.fillText('登陸風險帶', w * 0.06, h * 0.37);

    // 4. Subtropical High Ridge (H) guiding bifurcation saddle
    const ridgeX = w * 0.56;
    const ridgeY = h * 0.22;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.28)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    for (const rScale of [0.55, 1.0]) {
      ctx.beginPath();
      ctx.ellipse(ridgeX, ridgeY, w * 0.15 * rScale, h * 0.09 * rScale, -0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('H 副熱帶高壓脊 (分岔引導區)', ridgeX - 68, ridgeY - h * 0.11);

    // Helper: draw vortex ring
    const drawVortex = (
      cx: number,
      cy: number,
      radius: number,
      color: string,
      alpha: number,
      blurry: boolean
    ) => {
      const grad = ctx.createRadialGradient(cx, cy, blurry ? 0 : radius * 0.15, cx, cy, radius);
      if (blurry) {
        grad.addColorStop(0, color.replace('ALPHA', (alpha * 0.45).toFixed(2)));
        grad.addColorStop(0.55, color.replace('ALPHA', (alpha * 0.22).toFixed(2)));
        grad.addColorStop(1, color.replace('ALPHA', '0'));
      } else {
        grad.addColorStop(0, color.replace('ALPHA', '0.08'));
        grad.addColorStop(0.38, color.replace('ALPHA', alpha.toFixed(2)));
        grad.addColorStop(0.75, color.replace('ALPHA', (alpha * 0.35).toFixed(2)));
        grad.addColorStop(1, color.replace('ALPHA', '0'));
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    // 5. Render selected forecast paradigm
    if (mode === 'deterministic_mse') {
      // Draw faint ghost branches to show what real possibilities MSE is averaging over
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const m = sim.members[i * 3];
        if (!m) continue;
        ctx.beginPath();
        m.points.forEach((pt, idx) => {
          const px = pt.x * w;
          const py = pt.y * h;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw blurred MSE mean field expanding into a weak smear
      for (let s = 4; s <= TOTAL_STEPS; s += 5) {
        const pt = sim.mseMeanPath[s];
        const px = pt.x * w;
        const py = pt.y * h;
        const spreadRadius = 16 + (s / TOTAL_STEPS) * (38 + 26 * uncertaintySigma);
        drawVortex(px, py, spreadRadius, 'rgba(244, 63, 94, ALPHA)', pt.intensity * 0.85, true);
      }

      // Draw MSE mean track
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 3;
      ctx.beginPath();
      sim.mseMeanPath.forEach((pt, idx) => {
        const px = pt.x * w;
        const py = pt.y * h;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      const endMean = sim.mseMeanPath[TOTAL_STEPS];
      ctx.fillStyle = '#fda4af';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('MSE 條件平均 (雙峰相消成模糊微風)', Math.max(w * 0.27, endMean.x * w - 95), endMean.y * h - 18);
    } else if (mode === 'classical_ensemble') {
      // Draw 14 perturbed ensemble trajectories
      for (const m of sim.members) {
        const isLand = m.branch === 'landfall';
        ctx.strokeStyle = isLand ? 'rgba(251, 146, 60, 0.72)' : 'rgba(56, 189, 248, 0.72)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        m.points.forEach((pt, idx) => {
          const px = pt.x * w;
          const py = pt.y * h;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        const endPt = m.points[TOTAL_STEPS];
        drawVortex(
          endPt.x * w,
          endPt.y * h,
          14,
          isLand ? 'rgba(251, 146, 60, ALPHA)' : 'rgba(56, 189, 248, ALPHA)',
          0.65,
          false
        );
      }
    } else {
      // diffusion_denoising mode: noise field at step k -> sharp multi-member eyewalls as k -> 0
      const noiseRng = mulberry32(seed * 3571 + denoiseStepK * 97 + 13);
      const jitterAmp = sim.noiseLevel * 0.18;

      // Render Gaussian noise grains proportional to noiseLevel (k: 20 -> 0)
      if (sim.noiseLevel > 0.02) {
        const numSpecks = Math.round(140 + sim.noiseLevel * 760);
        for (let i = 0; i < numSpecks; i++) {
          const sx = noiseRng() * w;
          const sy = noiseRng() * h;
          const val = noiseRng();
          const rad = 1.2 + sim.noiseLevel * 2.8;
          ctx.fillStyle =
            val > 0.5
              ? `rgba(56, 189, 248, ${(0.08 + sim.noiseLevel * 0.34).toFixed(2)})`
              : `rgba(167, 139, 250, ${(0.06 + sim.noiseLevel * 0.28).toFixed(2)})`;
          ctx.fillRect(sx, sy, rad, rad);
        }
      }

      // Draw denoised ensemble tracks & eyewalls converging from noise
      const trackAlpha = Math.max(0.14, 1 - sim.noiseLevel * 0.85);
      for (const m of sim.members) {
        const isLand = m.branch === 'landfall';
        ctx.strokeStyle = isLand
          ? `rgba(244, 63, 94, ${trackAlpha.toFixed(2)})`
          : `rgba(34, 211, 238, ${trackAlpha.toFixed(2)})`;
        ctx.lineWidth = sim.noiseLevel < 0.35 ? 1.8 : 1.1;
        ctx.beginPath();
        m.points.forEach((pt, idx) => {
          const tau = idx / TOTAL_STEPS;
          // At high k, spatial points are corrupted by Gaussian noise around conditioning origin
          const nx = pt.x + gaussianFromRng(noiseRng) * jitterAmp * (0.35 + 0.65 * tau);
          const ny = pt.y + gaussianFromRng(noiseRng) * jitterAmp * (0.35 + 0.65 * tau);
          const px = Math.max(6, Math.min(w - 6, nx * w));
          const py = Math.max(6, Math.min(h - 6, ny * h));
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Sharp cyclone eyewall rings emerge as k approaches 0
        if (sim.noiseLevel < 0.55) {
          const endPt = m.points[TOTAL_STEPS];
          const midPt = m.points[14];
          const ringAlpha = (1 - sim.noiseLevel / 0.55) * 0.85;
          drawVortex(
            midPt.x * w,
            midPt.y * h,
            10,
            isLand ? 'rgba(244, 63, 94, ALPHA)' : 'rgba(34, 211, 238, ALPHA)',
            ringAlpha * 0.5,
            false
          );
          drawVortex(
            endPt.x * w,
            endPt.y * h,
            13,
            isLand ? 'rgba(244, 63, 94, ALPHA)' : 'rgba(34, 211, 238, ALPHA)',
            ringAlpha,
            false
          );
        }
      }
    }

    // 6. Conditioning origin marker (t, t - 12h)
    const originX = sim.mseMeanPath[0].x * w;
    const originY = sim.mseMeanPath[0].y * h;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(originX, originY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('初始條件 (t, t-12h)', Math.min(w - 110, originX - 42), originY + 18);

    // 7. Mode badge inside canvas top-left
    ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
    ctx.fillRect(8, 8, Math.min(w - 16, 236), 24);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 8, Math.min(w - 16, 236), 24);
    ctx.fillStyle =
      mode === 'deterministic_mse'
        ? '#fda4af'
        : mode === 'classical_ensemble'
          ? '#fde68a'
          : '#67e8f9';
    ctx.font = 'bold 10px sans-serif';
    const badgeLabel =
      mode === 'deterministic_mse'
        ? '決定論 MSE：雙峰模糊平均'
        : mode === 'classical_ensemble'
          ? '傳統物理集合：14 條初值微擾成員'
          : `條件擴散去噪 k=${denoiseStepK}/20 (球面網格)`;
    ctx.fillText(badgeLabel, 14, 24);

    ctx.restore();
  }, [mode, denoiseStepK, uncertaintySigma, seed, sim, resizeTick]);

  // Draw Panel 2: Day 1 - Day 15 CRPS & Spread-Skill Calibration Curves
  useEffect(() => {
    const canvas = metricsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h, dpr } = getDprCanvasSize(canvas, 400, 330);
    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    const padL = 38;
    const padR = 14;
    const padT = 28;
    const padB = 26;
    const plotW = Math.max(120, w - padL - padR);
    const totalH = Math.max(120, h - padT - padB);

    const topH = totalH * 0.44;
    const gapH = 26;
    const botY0 = padT + topH + gapH;
    const botH = totalH - topH - gapH;

    // ─── Top Chart: Spread vs RMSE (Calibration) ───
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('上圖：離散度 (Spread) 與實際誤差 (RMSE) 校準曲線', padL, 16);

    const maxTopVal = 1.45;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (const yTick of [0.4, 0.8, 1.2]) {
      const yy = padT + (1 - yTick / maxTopVal) * topH;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(padL + plotW, yy);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(yTick.toFixed(1), 6, yy + 3);
    }

    const drawSeries = (arr: number[], maxVal: number, y0: number, chartH: number, color: string, dashed = false, width = 2) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dashed) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      arr.forEach((v, i) => {
        const x = padL + (i / (arr.length - 1)) * plotW;
        const clamped = Math.max(0, Math.min(maxVal, v));
        const y = y0 + (1 - clamped / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };

    // True RMSE curve (amber dashed)
    drawSeries(sim.rmseSeries, maxTopVal, padT, topH, '#fbbf24', true, 1.8);

    // Spread curve depends on mode: deterministic MSE has ZERO spread (overconfident!)
    const activeSpread =
      mode === 'deterministic_mse'
        ? sim.days.map(() => 0.02)
        : sim.spreadSeries;
    drawSeries(
      activeSpread,
      maxTopVal,
      padT,
      topH,
      mode === 'deterministic_mse' ? '#fb7185' : '#22d3ee',
      false,
      2.2
    );

    // Top chart inline legend
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('-- 實際誤差 RMSE', padL + 4, padT + 11);
    ctx.fillStyle = mode === 'deterministic_mse' ? '#fb7185' : '#22d3ee';
    ctx.fillText(
      mode === 'deterministic_mse' ? '— MSE 離散度 = 0 (過度自信)' : '— 集合離散度 Spread',
      padL + 96,
      padT + 11
    );

    // ─── Bottom Chart: CRPS (Probabilistic Skill, lower is better) ───
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('下圖：Day 1–15 CRPS 機率誤差（越低代表機率走廊越精準）', padL, botY0 - 8);

    const maxCrps = 1.65;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (const yTick of [0.5, 1.0, 1.5]) {
      const yy = botY0 + (1 - yTick / maxCrps) * botH;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(padL + plotW, yy);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(yTick.toFixed(1), 6, yy + 3);
    }

    drawSeries(sim.mseCrpsSeries, maxCrps, botY0, botH, 'rgba(251, 113, 133, 0.85)', true, 1.7);
    drawSeries(sim.classicalCrpsSeries, maxCrps, botY0, botH, 'rgba(251, 191, 36, 0.85)', false, 1.6);
    drawSeries(sim.gencastCrpsSeries, maxCrps, botY0, botH, '#34d399', false, 2.3);

    // Bottom legend
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#fda4af';
    ctx.fillText('-- MSE 單一決定論', padL + 4, botY0 + 11);
    ctx.fillStyle = '#fde68a';
    ctx.fillText('— 傳統集合', padL + 92, botY0 + 11);
    ctx.fillStyle = '#6ee7b7';
    ctx.fillText('— GenCast 擴散', padL + 150, botY0 + 11);

    // X-axis Day markers
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px ui-monospace, monospace';
    for (const d of [1, 5, 10, 15]) {
      const x = padL + ((d - 1) / 14) * plotW;
      ctx.fillText(`D${d}`, Math.max(padL, x - 8), h - 8);
    }

    ctx.restore();
  }, [sim, mode, resizeTick]);

  const handlePlayDenoising = () => {
    setMode('diffusion_denoising');
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (denoiseStepK <= 0) {
      setDenoiseStepK(MAX_DENOISE_K);
    }
    setIsPlaying(true);
  };

  const handleResample = () => {
    setSeed((s) => (s % 99) + 1);
  };

  return (
    <div className="my-8 w-full max-w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-3.5 sm:p-5 text-slate-100 shadow-2xl">
      {/* Header & Action Buttons */}
      <div className="flex flex-col gap-3 border-b border-slate-700/80 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-bold tracking-wide text-cyan-300">
            GenCast 擴散集合預報與 MSE 模糊化對比模擬器
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            觀察大氣在副熱帶高壓脊遭遇雙分岔時，決定論平均與條件擴散去噪集合採樣（k: 20→0）如何產生截然不同的預報場與 CRPS 表現
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePlayDenoising}
            className="cursor-pointer rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500"
          >
            {isPlaying ? '⏸ 暫停去噪' : '▶ 播放去噪步驟 k: 20→0'}
          </button>
          <button
            type="button"
            onClick={handleResample}
            className="cursor-pointer rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-slate-700"
          >
            ↻ 重抽集合雜訊 (Seed #{seed})
          </button>
        </div>
      </div>

      {/* Paradigm Mode Switcher */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-400">預報範式切換：</span>
        {(
          [
            ['deterministic_mse', '決定論 MSE 平均 (Blurring Mean)'],
            ['classical_ensemble', '傳統集合微擾 (Ensemble Branches)'],
            ['diffusion_denoising', '條件擴散採樣 (Diffusion Denoising)'],
          ] as const
        ).map(([key, label]) => {
          const active = mode === key;
          let activeClass = 'border-cyan-400 bg-cyan-500/20 text-cyan-200';
          if (key === 'deterministic_mse') activeClass = 'border-rose-400 bg-rose-500/20 text-rose-200';
          if (key === 'classical_ensemble') activeClass = 'border-amber-400 bg-amber-500/20 text-amber-200';

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setMode(key);
              }}
              className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? activeClass
                  : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Twin-Panel Canvas Visualization */}
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* Panel 1: Spatial Bifurcation Field */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 lg:col-span-7">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              面板一：氣旋雙路徑分岔空間預測場（西行登陸 vs 北轉遠離）
            </span>
            <span className="font-mono text-[10px] text-cyan-300">
              {NUM_MEMBERS} 成員 · 360h (15 天)
            </span>
          </div>
          <canvas
            ref={spatialCanvasRef}
            width={500}
            height={320}
            className="block w-full rounded-lg"
            style={{ height: '300px' }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
              西行登陸分支 / MSE 模糊區
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
              北轉遠離分支
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-300" />
              條件起點 (t, t-12h)
            </span>
          </div>
        </div>

        {/* Panel 2: CRPS & Spread-Skill Curves */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 lg:col-span-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              面板二：CRPS 機率評分與離散度－誤差演化
            </span>
            <span className="font-mono text-[10px] text-emerald-300">
              k = {denoiseStepK} / 20
            </span>
          </div>
          <canvas
            ref={metricsCanvasRef}
            width={400}
            height={320}
            className="block w-full rounded-lg"
            style={{ height: '300px' }}
          />
          <div className="mt-2 text-[10px] text-slate-400">
            理想集合預報需滿足 <span className="font-mono text-cyan-300">Spread ≈ RMSE</span>（不低估極端尾端風險），且 CRPS 隨去噪收斂而降低。
          </div>
        </div>
      </div>

      {/* Live Metrics Grid */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">去噪步驟 k / 殘餘雜訊 σ</div>
          <div className="mt-1 font-mono text-sm font-bold text-cyan-300 sm:text-base">
            k = {denoiseStepK} · σ = {sim.noiseLevel.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">西行登陸走廊機率</div>
          <div className="mt-1 font-mono text-sm font-bold text-rose-300 sm:text-base">
            {mode === 'deterministic_mse'
              ? '失靈 (均值偏離)'
              : `${sim.landfallPct}% (${sim.landfallCount}/${NUM_MEMBERS})`}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">Day 7 眼牆風速結構保留</div>
          <div className="mt-1 font-mono text-sm font-bold text-amber-300 sm:text-base">
            {sim.peakWindRetentionPct}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">Day 10 CRPS / 離散比</div>
          <div className="mt-1 font-mono text-sm font-bold text-emerald-300 sm:text-base">
            {sim.day10Crps.toFixed(2)} ·{' '}
            {mode === 'deterministic_mse'
              ? '0.00'
              : (sim.day10Spread / sim.day10Rmse).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Interactive Sliders */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">條件擴散去噪步進 k (20 高斯雜訊 → 0 結構收斂)</span>
            <span className="font-mono font-bold text-cyan-300">k = {denoiseStepK}</span>
          </div>
          <input
            type="range"
            min={0}
            max={MAX_DENOISE_K}
            step={1}
            value={denoiseStepK}
            onChange={(e) => {
              setIsPlaying(false);
              setMode('diffusion_denoising');
              setDenoiseStepK(parseInt(e.target.value, 10));
            }}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>k = 0 (去噪完成・清晰氣旋分支)</span>
            <span>k = 20 (純高斯雜訊場)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">初值不確定度 σ₀ (分岔離散強度)</span>
            <span className="font-mono font-bold text-emerald-300">{uncertaintySigma.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1.0}
            step={0.05}
            value={uncertaintySigma}
            onChange={(e) => setUncertaintySigma(parseFloat(e.target.value))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>低不確定度 (0.10)</span>
            <span>強烈渾沌分岔 (1.00)</span>
          </div>
        </div>
      </div>

      {/* Explicit Model Boundary Disclaimer */}
      <div className="mt-3 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <strong className="text-slate-200">模型邊界說明：</strong>
        二維雙分岔流場與簡化迭代去噪教學模型，呈現擴散集合如何克服 MSE 決定論模糊效應，非實際 0.25° 球面圖神經網路大氣物理求解器。切換「決定論 MSE 平均」可見往西登陸與向北轉向兩分支被算術平均成中間的無害低幅度模糊帶；切回「條件擴散採樣」並拖動去噪步進 k，則可觀察模型如何在球面網格上從高斯雜訊雕琢出保有急劇風場梯度的雙分支機率走廊。
      </div>
    </div>
  );
};
