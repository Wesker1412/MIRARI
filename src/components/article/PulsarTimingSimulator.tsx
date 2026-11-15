import React, { useState, useEffect, useRef, useMemo } from 'react';

interface SimulatedSkyPulsar {
  id: number;
  dir: [number, number, number]; // Unit vector on celestial sphere
  earthModesRe: Float64Array; // Precomputed Earth-term mode coefficients (K frequencies)
  earthModesIm: Float64Array;
  pulsarModesRe: Float64Array; // Independent pulsar-term mode coefficients (K frequencies)
  pulsarModesIm: Float64Array;
  noiseRe: Float64Array; // Unit-variance intrinsic red+white noise Fourier modes
  noiseIm: Float64Array;
}

interface PairScatterPoint {
  angleDeg: number;
  corr: number;
}

interface BinnedCorrelation {
  binCenterDeg: number;
  mean: number;
  stderr: number;
  count: number;
}

const NUM_FREQS = 10;
const NUM_SKY_MODES = 28;
const TIME_SAMPLES = 120;
const OBS_YEARS = 15;

/**
 * Exact Hellings & Downs (1983) overlap reduction function for an isotropic,
 * unpolarized quadrupolar gravitational-wave background.
 * For distinct pulsars (theta -> 0+), Gamma(0+) = 0.5; for autocorrelation (a = b), Gamma(0) = 1.
 */
function hellingsDowns(thetaRad: number, isSamePulsar = false): number {
  if (isSamePulsar) return 1.0;
  const x = (1 - Math.cos(thetaRad)) / 2;
  if (x <= 1e-10) return 0.5;
  return 0.5 - 0.25 * x + 1.5 * x * Math.log(x);
}

/**
 * Deterministic PRNG (Mulberry32) so sky realizations remain smooth during slider interaction.
 */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleStandardNormal(rng: () => number): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Compute transverse-traceless antenna response F^+, F^x for GW propagation direction omegaHat
 * and pulsar line-of-sight unit vector pHat.
 * Satisfies <F^+_i F^+_j + F^x_i F^x_j>_omega = (2/3) * Gamma_HD(theta_ij).
 */
function computeAntennaResponse(
  omegaHat: [number, number, number],
  uVec: [number, number, number],
  vVec: [number, number, number],
  pHat: [number, number, number]
): [number, number] {
  const denom = 2 * (1 + omegaHat[0] * pHat[0] + omegaHat[1] * pHat[1] + omegaHat[2] * pHat[2]);
  if (Math.abs(denom) < 1e-5) return [0, 0];
  const pDotU = pHat[0] * uVec[0] + pHat[1] * uVec[1] + pHat[2] * uVec[2];
  const pDotV = pHat[0] * vVec[0] + pHat[1] * vVec[1] + pHat[2] * vVec[2];
  const fPlus = (pDotU * pDotU - pDotV * pDotV) / denom;
  const fCross = (2 * pDotU * pDotV) / denom;
  return [fPlus, fCross];
}

function buildSkyBasis(rng: () => number): Array<{
  omegaHat: [number, number, number];
  uVec: [number, number, number];
  vVec: [number, number, number];
}> {
  const modes: Array<{
    omegaHat: [number, number, number];
    uVec: [number, number, number];
    vVec: [number, number, number];
  }> = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let m = 0; m < NUM_SKY_MODES; m++) {
    const z = 1 - (2 * (m + 0.5)) / NUM_SKY_MODES;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const phi = goldenAngle * m + rng() * 0.15;
    const ox = r * Math.cos(phi);
    const oy = r * Math.sin(phi);
    const oz = z;

    // Orthonormal polarization basis (u, v) perpendicular to omegaHat
    const ref: [number, number, number] = Math.abs(oz) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let ux = ref[1] * oz - ref[2] * oy;
    let uy = ref[2] * ox - ref[0] * oz;
    let uz = ref[0] * oy - ref[1] * ox;
    const uNorm = Math.hypot(ux, uy, uz) || 1;
    ux /= uNorm;
    uy /= uNorm;
    uz /= uNorm;

    const vx = oy * uz - oz * uy;
    const vy = oz * ux - ox * uz;
    const vz = ox * uy - oy * ux;

    modes.push({
      omegaHat: [ox, oy, oz],
      uVec: [ux, uy, uz],
      vVec: [vx, vy, vz],
    });
  }
  return modes;
}

export const PulsarTimingSimulator: React.FC = () => {
  const [separationDeg, setSeparationDeg] = useState<number>(85);
  const [pulsarCount, setPulsarCount] = useState<number>(67);
  const [gwbAmplitudeScale, setGwbAmplitudeScale] = useState<number>(1.0); // 1.0 => A_GWB = 2.4e-15
  const [noiseRatio, setNoiseRatio] = useState<number>(0.45);
  const [showSystematics, setShowSystematics] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [seed, setSeed] = useState<number>(20230629);
  const [wavePhase, setWavePhase] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Subtle animation loop for passing quadrupolar GW ripple in the geometry view
  useEffect(() => {
    if (!isPlaying) return;
    let animId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      setWavePhase((prev) => (prev + dt * 1.45) % (Math.PI * 2));
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  // Synthesize an isotropic unpolarized TT gravitational-wave sky and PTA pulsar ensemble
  const skyEnsemble = useMemo(() => {
    const rng = createRng(seed);
    const skyModes = buildSkyBasis(rng);

    // Complex Gaussian GW amplitudes per sky mode & frequency bin (f_k = k / T_obs)
    // Scale so each pulsar's Earth-term variance per bin matches pulsar-term variance (= 0.5)
    const modeScale = Math.sqrt(3 / (4 * NUM_SKY_MODES));
    const hPlusRe = new Float64Array(NUM_SKY_MODES * NUM_FREQS);
    const hPlusIm = new Float64Array(NUM_SKY_MODES * NUM_FREQS);
    const hCrossRe = new Float64Array(NUM_SKY_MODES * NUM_FREQS);
    const hCrossIm = new Float64Array(NUM_SKY_MODES * NUM_FREQS);

    for (let k = 0; k < NUM_FREQS; k++) {
      for (let m = 0; m < NUM_SKY_MODES; m++) {
        const idx = m * NUM_FREQS + k;
        hPlusRe[idx] = sampleStandardNormal(rng) * modeScale;
        hPlusIm[idx] = sampleStandardNormal(rng) * modeScale;
        hCrossRe[idx] = sampleStandardNormal(rng) * modeScale;
        hCrossIm[idx] = sampleStandardNormal(rng) * modeScale;
      }
    }

    const projectEarthModes = (dir: [number, number, number]) => {
      const eRe = new Float64Array(NUM_FREQS);
      const eIm = new Float64Array(NUM_FREQS);
      for (let m = 0; m < NUM_SKY_MODES; m++) {
        const { omegaHat, uVec, vVec } = skyModes[m];
        const [fPlus, fCross] = computeAntennaResponse(omegaHat, uVec, vVec, dir);
        for (let k = 0; k < NUM_FREQS; k++) {
          const idx = m * NUM_FREQS + k;
          eRe[k] += fPlus * hPlusRe[idx] + fCross * hCrossRe[idx];
          eIm[k] += fPlus * hPlusIm[idx] + fCross * hCrossIm[idx];
        }
      }
      return { eRe, eIm };
    };

    // Generate max 67 pulsars distributed quasi-isotropically over the celestial sphere
    const maxPulsars = 67;
    const pulsars: SimulatedSkyPulsar[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < maxPulsars; i++) {
      const z = 1 - (2 * (i + 0.5)) / maxPulsars;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      const phi = goldenAngle * i + 0.37 * (rng() - 0.5);
      const dir: [number, number, number] = [r * Math.cos(phi), r * Math.sin(phi), z];
      const { eRe, eIm } = projectEarthModes(dir);

      const pRe = new Float64Array(NUM_FREQS);
      const pIm = new Float64Array(NUM_FREQS);
      const nRe = new Float64Array(NUM_FREQS);
      const nIm = new Float64Array(NUM_FREQS);
      const pScale = 1 / Math.sqrt(2);

      for (let k = 0; k < NUM_FREQS; k++) {
        pRe[k] = sampleStandardNormal(rng) * pScale;
        pIm[k] = sampleStandardNormal(rng) * pScale;
        nRe[k] = sampleStandardNormal(rng) * pScale;
        nIm[k] = sampleStandardNormal(rng) * pScale;
      }

      pulsars.push({
        id: i,
        dir,
        earthModesRe: eRe,
        earthModesIm: eIm,
        pulsarModesRe: pRe,
        pulsarModesIm: pIm,
        noiseRe: nRe,
        noiseIm: nIm,
      });
    }

    // Independent fixed-seed realization for interactive pair (Pulsar A & Pulsar B)
    const pairPulsarReA = new Float64Array(NUM_FREQS);
    const pairPulsarImA = new Float64Array(NUM_FREQS);
    const pairPulsarReB = new Float64Array(NUM_FREQS);
    const pairPulsarImB = new Float64Array(NUM_FREQS);
    const pairNoiseReA = new Float64Array(NUM_FREQS);
    const pairNoiseImA = new Float64Array(NUM_FREQS);
    const pairNoiseReB = new Float64Array(NUM_FREQS);
    const pairNoiseImB = new Float64Array(NUM_FREQS);
    const pScale = 1 / Math.sqrt(2);
    for (let k = 0; k < NUM_FREQS; k++) {
      pairPulsarReA[k] = sampleStandardNormal(rng) * pScale;
      pairPulsarImA[k] = sampleStandardNormal(rng) * pScale;
      pairPulsarReB[k] = sampleStandardNormal(rng) * pScale;
      pairPulsarImB[k] = sampleStandardNormal(rng) * pScale;
      pairNoiseReA[k] = sampleStandardNormal(rng) * pScale;
      pairNoiseImA[k] = sampleStandardNormal(rng) * pScale;
      pairNoiseReB[k] = sampleStandardNormal(rng) * pScale;
      pairNoiseImB[k] = sampleStandardNormal(rng) * pScale;
    }

    return {
      pulsars,
      projectEarthModes,
      pairPulsarReA,
      pairPulsarImA,
      pairPulsarReB,
      pairPulsarImB,
      pairNoiseReA,
      pairNoiseImA,
      pairNoiseReB,
      pairNoiseImB,
    };
  }, [seed]);

  // Compute simulated pair time series R_A(t), R_B(t) and Monte-Carlo pairwise HD scatter
  const simulationResults = useMemo(() => {
    const thetaRad = (separationDeg * Math.PI) / 180;
    const isNearZero = separationDeg === 0;
    const gammaTheoretical = hellingsDowns(thetaRad, false);

    // Direction A fixed at (1, 0, 0) in equatorial projection; Direction B at (cos theta, sin theta, 0)
    const dirA: [number, number, number] = [1, 0, 0];
    const dirB: [number, number, number] = [Math.cos(thetaRad), Math.sin(thetaRad), 0];
    const earthA = skyEnsemble.projectEarthModes(dirA);
    const earthB = skyEnsemble.projectEarthModes(dirB);

    // Spectral weights: S(f_k) propto k^(-13/3) => amplitude propto k^(-13/6)
    // Scale overall TOA residual to microsecond-scale (~0.2 - 1.2 us for A_GWB ~ 2.4e-15 over 15 yr)
    const ampFactor = gwbAmplitudeScale * 0.42;
    const noiseFactor = noiseRatio * 0.42;

    const earthWaveA = new Float64Array(TIME_SAMPLES);
    const earthWaveB = new Float64Array(TIME_SAMPLES);
    const totalWaveA = new Float64Array(TIME_SAMPLES);
    const totalWaveB = new Float64Array(TIME_SAMPLES);

    for (let tIdx = 0; tIdx < TIME_SAMPLES; tIdx++) {
      const tNorm = tIdx / (TIME_SAMPLES - 1); // 0 to 1 across 15 years
      let eA = 0;
      let eB = 0;
      let totA = 0;
      let totB = 0;

      for (let k = 0; k < NUM_FREQS; k++) {
        const freqIndex = k + 1;
        const specAmp = ampFactor * Math.pow(freqIndex, -13 / 6);
        const nAmp = noiseFactor * Math.pow(freqIndex, -1.2);
        const phase = 2 * Math.PI * freqIndex * tNorm;
        const c = Math.cos(phase);
        const s = Math.sin(phase);

        const eValA = specAmp * (earthA.eRe[k] * c - earthA.eIm[k] * s);
        const eValB = specAmp * (earthB.eRe[k] * c - earthB.eIm[k] * s);
        const pValA = specAmp * (skyEnsemble.pairPulsarReA[k] * c - skyEnsemble.pairPulsarImA[k] * s);
        const pValB = specAmp * (skyEnsemble.pairPulsarReB[k] * c - skyEnsemble.pairPulsarImB[k] * s);
        const nValA = nAmp * (skyEnsemble.pairNoiseReA[k] * c - skyEnsemble.pairNoiseImA[k] * s);
        const nValB = nAmp * (skyEnsemble.pairNoiseReB[k] * c - skyEnsemble.pairNoiseImB[k] * s);

        eA += eValA;
        eB += eValB;
        totA += eValA + pValA + nValA;
        totB += eValB + pValB + nValB;
      }

      earthWaveA[tIdx] = eA;
      earthWaveB[tIdx] = eB;
      totalWaveA[tIdx] = totA;
      totalWaveB[tIdx] = totB;
    }

    // Empirical Pearson correlation of totalWaveA and totalWaveB (scaled by 1 + noiseRatio^2?
    // Wait: standard Pearson r compares R_A and R_B normalized by their own stddevs)
    let meanA = 0;
    let meanB = 0;
    for (let i = 0; i < TIME_SAMPLES; i++) {
      meanA += totalWaveA[i];
      meanB += totalWaveB[i];
    }
    meanA /= TIME_SAMPLES;
    meanB /= TIME_SAMPLES;

    let covAB = 0;
    let varA = 0;
    let varB = 0;
    for (let i = 0; i < TIME_SAMPLES; i++) {
      const da = totalWaveA[i] - meanA;
      const db = totalWaveB[i] - meanB;
      covAB += da * db;
      varA += da * da;
      varB += db * db;
    }
    const empiricalPairCorr = varA > 1e-12 && varB > 1e-12 ? covAB / Math.sqrt(varA * varB) : 0;

    // Ensemble pairwise cross-correlations across active N_psr pulsars
    const activePulsars = skyEnsemble.pulsars.slice(0, pulsarCount);
    const pairPoints: PairScatterPoint[] = [];

    // Optimal frequency weighting across k = 0..NUM_FREQS-1 where signal dominates low k
    const weights = new Float64Array(NUM_FREQS);
    let weightSum = 0;
    for (let k = 0; k < NUM_FREQS; k++) {
      const sigPower = gwbAmplitudeScale * gwbAmplitudeScale * Math.pow(k + 1, -13 / 3);
      const nPower = noiseRatio * noiseRatio * Math.pow(k + 1, -2.4);
      const snrBin = sigPower / (sigPower + nPower + 1e-6);
      weights[k] = snrBin * snrBin;
      weightSum += weights[k];
    }
    if (weightSum < 1e-9) weightSum = 1;

    for (let i = 0; i < activePulsars.length; i++) {
      const pi = activePulsars[i];
      for (let j = i + 1; j < activePulsars.length; j++) {
        const pj = activePulsars[j];
        const dot = Math.max(-1, Math.min(1, pi.dir[0] * pj.dir[0] + pi.dir[1] * pj.dir[1] + pi.dir[2] * pj.dir[2]));
        const angleDeg = (Math.acos(dot) * 180) / Math.PI;

        let crossSum = 0;
        for (let k = 0; k < NUM_FREQS; k++) {
          const sigAmp = gwbAmplitudeScale * Math.pow(k + 1, -13 / 6);
          const nAmp = noiseRatio * Math.pow(k + 1, -1.2);

          const reI = sigAmp * (pi.earthModesRe[k] + pi.pulsarModesRe[k]) + nAmp * pi.noiseRe[k];
          const imI = sigAmp * (pi.earthModesIm[k] + pi.pulsarModesIm[k]) + nAmp * pi.noiseIm[k];
          const reJ = sigAmp * (pj.earthModesRe[k] + pj.pulsarModesRe[k]) + nAmp * pj.noiseRe[k];
          const imJ = sigAmp * (pj.earthModesIm[k] + pj.pulsarModesIm[k]) + nAmp * pj.noiseIm[k];

          // Normalize by expected GWB per-frequency power (sigAmp^2) so E[rho_ij] = Gamma_HD(theta_ij)
          const pairProduct = (reI * reJ + imI * imJ) / (sigAmp * sigAmp + 1e-9);
          crossSum += weights[k] * pairProduct;
        }
        const corr = crossSum / weightSum;
        pairPoints.push({ angleDeg, corr });
      }
    }

    // Bin pair correlations into 12 angular bins (15 deg each)
    const numBins = 12;
    const binWidth = 180 / numBins;
    const binned: BinnedCorrelation[] = [];
    let chiSqHd = 0;
    let chiSqNull = 0;

    for (let b = 0; b < numBins; b++) {
      const lo = b * binWidth;
      const hi = (b + 1) * binWidth;
      const inBin = pairPoints.filter((p) => p.angleDeg >= lo && (b === numBins - 1 ? p.angleDeg <= hi : p.angleDeg < hi));
      if (inBin.length === 0) continue;

      let sum = 0;
      for (const p of inBin) sum += p.corr;
      const mean = sum / inBin.length;

      let sq = 0;
      for (const p of inBin) {
        const d = p.corr - mean;
        sq += d * d;
      }
      const variance = inBin.length > 1 ? sq / (inBin.length - 1) : 0.25;
      const stderr = Math.sqrt(variance / inBin.length);
      const binCenterDeg = (lo + hi) / 2;
      const expectedHd = hellingsDowns((binCenterDeg * Math.PI) / 180, false);

      const errVar = Math.max(stderr * stderr, 0.0025);
      chiSqHd += ((mean - expectedHd) * (mean - expectedHd)) / errVar;
      chiSqNull += (mean * mean) / errVar;

      binned.push({
        binCenterDeg,
        mean,
        stderr,
        count: inBin.length,
      });
    }

    // Approximate optimal-statistic SNR from binned delta-chi-squared vs uncorrelated CURN (Gamma=0)
    const approxSnr = Math.sqrt(Math.max(0, chiSqNull - chiSqHd));
    const strainValue = (2.4 * gwbAmplitudeScale).toFixed(1);

    return {
      isNearZero,
      gammaTheoretical,
      earthWaveA,
      earthWaveB,
      totalWaveA,
      totalWaveB,
      empiricalPairCorr,
      pairPoints,
      binned,
      approxSnr,
      strainValue,
      totalPairs: pairPoints.length,
    };
  }, [separationDeg, pulsarCount, gwbAmplitudeScale, noiseRatio, skyEnsemble]);

  // Draw entire 3-panel high-craft Canvas dashboard
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Deep space background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#040814');
    bgGrad.addColorStop(1, '#091124');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Panel geometry
    const skyCx = 165;
    const skyCy = 126;
    const skyRadius = 86;

    // ─── PANEL 1 (Top-Left): Galactic PTA Sky & Quadrupolar Geometry ───────
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 10, 306, 226);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11.5px sans-serif';
    ctx.fillText('銀河脈衝星陣列投影與四極應變幾何', 22, 28);

    // Background PTA pulsar sky stars
    const activePulsars = skyEnsemble.pulsars.slice(0, pulsarCount);
    for (let i = 0; i < activePulsars.length; i++) {
      const p = activePulsars[i];
      const px = skyCx + p.dir[0] * (skyRadius * 0.86);
      const py = skyCy - p.dir[1] * (skyRadius * 0.86);
      const depthAlpha = 0.25 + 0.45 * ((p.dir[2] + 1) / 2);
      ctx.fillStyle = `rgba(148, 163, 184, ${depthAlpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer celestial reference circle
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(skyCx, skyCy, skyRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Quadrupolar (+ mode) oscillating spacetime tidal ring around Earth
    const strainAmp = 0.14 * Math.min(1.6, 0.5 + gwbAmplitudeScale * 0.5) * Math.sin(wavePhase);
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let a = 0; a <= 72; a++) {
      const phi = (a / 72) * Math.PI * 2;
      const rTidal = (skyRadius * 0.56) * (1 + strainAmp * Math.cos(2 * phi));
      const tx = skyCx + rTidal * Math.cos(phi);
      const ty = skyCy - rTidal * Math.sin(phi);
      if (a === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.closePath();
    ctx.stroke();

    // Orthogonal (+ / -) stretch/compress axis ticks
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(skyCx - skyRadius * 0.72, skyCy);
    ctx.lineTo(skyCx + skyRadius * 0.72, skyCy);
    ctx.moveTo(skyCx, skyCy - skyRadius * 0.72);
    ctx.lineTo(skyCx, skyCy + skyRadius * 0.72);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pulsar A (fixed at 0 deg, right) and Pulsar B (at separationDeg)
    const thetaRad = (separationDeg * Math.PI) / 180;
    const pAx = skyCx + skyRadius;
    const pAy = skyCy;
    const pBx = skyCx + skyRadius * Math.cos(thetaRad);
    const pBy = skyCy - skyRadius * Math.sin(thetaRad);

    // Draw angular separation arc
    if (separationDeg > 2) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(skyCx, skyCy, 28, 0, -thetaRad, true);
      ctx.stroke();

      const midAngle = -thetaRad / 2;
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 10.5px monospace';
      ctx.fillText(
        `θ=${separationDeg}°`,
        skyCx + 36 * Math.cos(midAngle) - 10,
        skyCy + 36 * Math.sin(midAngle) + 4
      );
    }

    // Line-of-sight rays with traveling metric ripple
    const drawRay = (tx: number, ty: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const steps = 28;
      const dx = tx - skyCx;
      const dy = ty - skyCy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const env = Math.sin(Math.PI * u);
        const ripple = 3.0 * env * Math.sin(u * 4 * Math.PI - wavePhase * 2);
        const x = skyCx + dx * u + nx * ripple;
        const y = skyCy + dy * u + ny * ripple;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    drawRay(pAx, pAy, 'rgba(34, 211, 238, 0.85)');
    drawRay(pBx, pBy, 'rgba(251, 191, 36, 0.85)');

    // Earth marker at center
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(skyCx, skyCy, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#bae6fd';
    ctx.font = '10px sans-serif';
    ctx.fillText('地球', skyCx - 11, skyCy + 17);

    // Pulsar A marker
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(pAx, pAy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 10.5px monospace';
    ctx.fillText('PSR A', pAx - 20, pAy + 16);

    // Pulsar B marker (draggable handle)
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(pBx, pBy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    const labelOffX = pBx >= skyCx ? 8 : -44;
    const labelOffY = pBy <= skyCy ? -10 : 16;
    ctx.fillText('PSR B', pBx + labelOffX, pBy + labelOffY);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9.5px sans-serif';
    ctx.fillText('可拖曳黃色 PSR B 改變夾角 θ_ab（紫環：+ 偏振潮汐應變）', 20, 227);
    ctx.restore();

    // ─── PANEL 2 (Top-Right): Simulated 15-Year TOA Timing Residuals ──────
    const toaL = 334;
    const toaT = 10;
    const toaW = w - toaL - 12;
    const toaH = 226;

    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(toaL, toaT, toaW, toaH);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11.5px sans-serif';
    ctx.fillText('15 年脈衝到達時間殘差 R(t) 模擬（μs）', toaL + 12, toaT + 18);

    const plotX0 = toaL + 44;
    const plotX1 = toaL + toaW - 14;
    const plotY0 = toaT + 38;
    const plotY1 = toaT + toaH - 30;
    const plotMidY = (plotY0 + plotY1) / 2;
    const halfSpanY = (plotY1 - plotY0) / 2;

    // Auto-scale cleanly around signal+noise amplitude
    const maxAbsRes = Math.max(
      0.8,
      ...Array.from(simulationResults.totalWaveA, Math.abs),
      ...Array.from(simulationResults.totalWaveB, Math.abs)
    );
    const yScaleMax = Math.ceil(maxAbsRes * 1.15 * 10) / 10;

    // Gridlines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    [-1, -0.5, 0, 0.5, 1].forEach((frac) => {
      const gy = plotMidY - frac * halfSpanY;
      ctx.beginPath();
      ctx.moveTo(plotX0, gy);
      ctx.lineTo(plotX1, gy);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9.5px monospace';
      ctx.textAlign = 'right';
      ctx.fillText((frac * yScaleMax).toFixed(1), plotX0 - 5, gy + 3);
    });
    ctx.textAlign = 'left';

    // X-axis year ticks
    [0, 5, 10, 15].forEach((yr) => {
      const gx = plotX0 + (yr / OBS_YEARS) * (plotX1 - plotX0);
      ctx.fillStyle = '#64748b';
      ctx.font = '9.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${yr} yr`, gx, plotY1 + 14);
    });
    ctx.textAlign = 'left';

    const drawCurve = (
      arr: Float64Array,
      strokeStyle: string,
      lineWidth: number,
      dashed = false
    ) => {
      ctx.save();
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      if (dashed) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const px = plotX0 + (i / (arr.length - 1)) * (plotX1 - plotX0);
        const py = plotMidY - (arr[i] / yScaleMax) * halfSpanY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    };

    // Faint dashed Earth-term correlated signals + solid total residuals (with pulsar term & noise)
    drawCurve(simulationResults.earthWaveA, 'rgba(34, 211, 238, 0.35)', 1.2, true);
    drawCurve(simulationResults.earthWaveB, 'rgba(251, 191, 36, 0.35)', 1.2, true);
    drawCurve(simulationResults.totalWaveA, '#22d3ee', 2.0, false);
    drawCurve(simulationResults.totalWaveB, '#fbbf24', 2.0, false);

    // Legend inside TOA plot
    ctx.fillStyle = '#22d3ee';
    ctx.font = '10px sans-serif';
    ctx.fillText('━ PSR A 總殘差', toaL + 252, toaT + 18);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('━ PSR B 總殘差', toaL + 338, toaT + 18);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9.5px sans-serif';
    ctx.fillText('⋯ 虛線：僅含同調「地球項」(Earth term)　|　實線：地球項 + 非關聯脈衝星項 + 單星噪訊', plotX0, toaT + toaH - 6);
    ctx.restore();

    // ─── PANEL 3 (Bottom): Hellings-Downs Correlation Curve & MC Scatter ──
    const hdL = 12;
    const hdT = 248;
    const hdW = w - 24;
    const hdH = h - hdT - 10;

    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hdL, hdT, hdW, hdH);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11.5px sans-serif';
    ctx.fillText(
      `Hellings–Downs 空間角關聯曲線 Γ(θ_ab)（模擬 ${pulsarCount} 顆脈衝星 · ${simulationResults.totalPairs} 組配對）`,
      hdL + 12,
      hdT + 18
    );

    const gx0 = hdL + 50;
    const gx1 = hdL + hdW - 22;
    const gy0 = hdT + 32;
    const gy1 = hdT + hdH - 26;

    const yMin = -0.35;
    const yMax = 1.05;
    const mapX = (deg: number) => gx0 + (deg / 180) * (gx1 - gx0);
    const mapY = (val: number) => gy1 - ((val - yMin) / (yMax - yMin)) * (gy1 - gy0);

    // Horizontal gridlines
    [-0.25, 0, 0.25, 0.5, 0.75, 1.0].forEach((val) => {
      const py = mapY(val);
      ctx.strokeStyle = val === 0 ? 'rgba(244, 63, 94, 0.38)' : 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = val === 0 ? 1.2 : 1;
      if (val === 0) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(gx0, py);
      ctx.lineTo(gx1, py);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = val === 0 ? '#fda4af' : '#64748b';
      ctx.font = '9.5px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(2), gx0 - 6, py + 3);
    });
    ctx.textAlign = 'left';

    // Vertical angle gridlines
    [0, 30, 60, 90, 120, 150, 180].forEach((deg) => {
      const px = mapX(deg);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.10)';
      ctx.beginPath();
      ctx.moveTo(px, gy0);
      ctx.lineTo(px, gy1);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${deg}°`, px, gy1 + 14);
    });
    ctx.textAlign = 'left';

    // Optional reference systematics curves: Monopole (clock error, Gamma=1.0) & Dipole (ephemeris, 0.5 cos theta)
    if (showSystematics) {
      // Monopole reference (Gamma = +1.0 for pure shared clock error)
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(mapX(0), mapY(1.0));
      ctx.lineTo(mapX(180), mapY(1.0));
      ctx.stroke();

      // Dipole reference (0.5 cos theta, Earth-term scaled)
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.5)';
      ctx.beginPath();
      for (let deg = 0; deg <= 180; deg += 3) {
        const px = mapX(deg);
        const py = mapY(0.5 * Math.cos((deg * Math.PI) / 180));
        if (deg === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Monte-Carlo pairwise correlation scatter points (clipped to plot bounds)
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    ctx.clip();

    ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
    for (const pt of simulationResults.pairPoints) {
      const px = mapX(pt.angleDeg);
      const py = mapY(pt.corr);
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }

    // Binned averages with 1-sigma error bars
    for (const bin of simulationResults.binned) {
      const px = mapX(bin.binCenterDeg);
      const py = mapY(bin.mean);
      const pyTop = mapY(bin.mean + bin.stderr);
      const pyBot = mapY(bin.mean - bin.stderr);

      ctx.strokeStyle = 'rgba(52, 211, 153, 0.78)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px, pyTop);
      ctx.lineTo(px, pyBot);
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Theoretical Hellings-Downs curve (theta in (0, 180])
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let deg = 0; deg <= 180; deg += 1) {
      const px = mapX(deg);
      const py = mapY(hellingsDowns((deg * Math.PI) / 180, false));
      if (deg === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Self-correlation discontinuity at theta = 0 (Gamma = 1.0) vs theta -> 0+ (Gamma = 0.5)
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(mapX(0), mapY(1.0), 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#091124';
    ctx.beginPath();
    ctx.arc(mapX(0), mapY(0.5), 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = '#bae6fd';
    ctx.font = '9.5px sans-serif';
    ctx.fillText('自關聯 Γ(0)=1', mapX(0) + 8, mapY(1.0) + 3);
    ctx.fillText('雙星共線 Γ(0⁺)=0.5', mapX(0) + 8, mapY(0.5) - 6);

    // Live crosshair at selected (separationDeg, gammaTheoretical)
    const selX = mapX(separationDeg);
    const selY = mapY(simulationResults.gammaTheoretical);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(selX, gy0);
    ctx.lineTo(selX, gy1);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(selX, selY, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Bottom legend
    ctx.font = '9.5px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('━ Hellings–Downs 理論曲線', gx0 + 170, hdT + 18);
    ctx.fillStyle = '#34d399';
    ctx.fillText('● 分箱平均 ±1σ', gx0 + 322, hdT + 18);
    ctx.fillStyle = '#fda4af';
    ctx.fillText('-- CURN 無空間關聯 (Γ=0)', gx0 + 422, hdT + 18);
    if (showSystematics) {
      ctx.fillStyle = '#c084fc';
      ctx.fillText('⋯ 單極時鐘 (1.0) / 偶極星曆 (0.5cosθ)', gx0 + 566, hdT + 18);
    }

    ctx.restore();
  }, [
    separationDeg,
    pulsarCount,
    gwbAmplitudeScale,
    noiseRatio,
    showSystematics,
    wavePhase,
    skyEnsemble,
    simulationResults,
  ]);

  const updateAngleFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top) * scaleY;

    // Sky panel hit region
    const skyCx = 165;
    const skyCy = 126;
    if (cx <= 325 && cy <= 240) {
      const dx = cx - skyCx;
      const dy = skyCy - cy;
      if (Math.hypot(dx, dy) > 12) {
        let deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
        if (deg < 0) deg = Math.abs(deg);
        deg = Math.max(0, Math.min(180, deg));
        setSeparationDeg(deg);
      }
      return;
    }

    // Hellings-Downs plot click region
    if (cy >= 248) {
      const gx0 = 62;
      const gx1 = canvas.width - 34;
      if (cx >= gx0 && cx <= gx1) {
        const deg = Math.round(((cx - gx0) / (gx1 - gx0)) * 180);
        setSeparationDeg(Math.max(0, Math.min(180, deg)));
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateAngleFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    updateAngleFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const corrPhaseLabel =
    simulationResults.gammaTheoretical > 0.18
      ? '強烈同向正關聯（地球項共震）'
      : simulationResults.gammaTheoretical < -0.05
      ? '四極拉伸－壓縮反相關聯'
      : '過零點附近（弱線性關聯）';

  return (
    <div className="my-8 w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90 p-3 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-100">
              脈衝星計時陣列（PTA）與 Hellings–Downs 四極關聯模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            拖曳左上天球上的 PSR B 或點擊下方曲線，觀察雙星夾角 θ<sub>ab</sub> 如何決定 15 年到達時間殘差與四極空間關聯
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSeparationDeg(5)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              separationDeg <= 10
                ? 'bg-cyan-600 text-white'
                : 'border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            θ → 0⁺ 同向
          </button>
          <button
            onClick={() => setSeparationDeg(85)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              separationDeg >= 75 && separationDeg <= 95
                ? 'bg-cyan-600 text-white'
                : 'border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            ~85° 反相低谷
          </button>
          <button
            onClick={() => setSeparationDeg(180)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              separationDeg >= 170
                ? 'bg-cyan-600 text-white'
                : 'border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            180° 對蹠
          </button>
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            {isPlaying ? '⏸ 暫停波紋' : '▶ 播放波紋'}
          </button>
          <button
            onClick={() => setSeed((s) => (s + 7919) >>> 0)}
            className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500 active:scale-95"
          >
            ↺ 重新取樣宇宙實現
          </button>
        </div>
      </div>

      {/* Canvas View */}
      <div className="mt-4 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <canvas
          ref={canvasRef}
          width={840}
          height={460}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-auto block cursor-crosshair touch-none rounded-lg"
        />
      </div>

      {/* KPI Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">理論 Hellings–Downs 關聯 Γ(θ<sub>ab</sub>)</div>
          <div
            className={`mt-1 font-mono text-base sm:text-lg font-bold ${
              simulationResults.gammaTheoretical >= 0 ? 'text-cyan-400' : 'text-amber-400'
            }`}
          >
            {simulationResults.gammaTheoretical >= 0 ? '+' : ''}
            {simulationResults.gammaTheoretical.toFixed(3)}
          </div>
          <div className="text-[10px] text-slate-500">{corrPhaseLabel}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">單對模擬殘差相關係數 r<sub>ab</sub></div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-emerald-400">
            {simulationResults.empiricalPairCorr >= 0 ? '+' : ''}
            {simulationResults.empiricalPairCorr.toFixed(3)}
          </div>
          <div className="text-[10px] text-slate-500">
            {simulationResults.isNearZero
              ? '雙星共線（含獨立脈衝星項，自關聯 Γ(0)=1）'
              : `夾角 θ = ${separationDeg}° 單次 15 年時間序列`}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">四極關聯 vs 無關聯模型信噪比</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-purple-300">
            ~{simulationResults.approxSnr.toFixed(1)} σ
          </div>
          <div className="text-[10px] text-slate-500">
            {pulsarCount} 顆星共 {simulationResults.totalPairs} 組配對分箱檢定
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">模擬特徵應變振幅 A<sub>GWB</sub></div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-sky-300">
            {simulationResults.strainValue} × 10<sup>-15</sup>
          </div>
          <div className="text-[10px] text-slate-500">
            參考頻率 1 yr⁻¹（NANOGrav 實測 2.4 × 10⁻¹⁵）
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">雙脈衝星天球夾角 θ<sub>ab</sub></span>
            <span className="font-mono font-bold text-amber-400">{separationDeg}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={180}
            step={1}
            value={separationDeg}
            onChange={(e) => setSeparationDeg(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0° (共線 Γ=0.5)</span>
            <span>82.5° (負向極小值 -0.152)</span>
            <span>180° (對蹠 +0.25)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">陣列脈衝星數量 N<sub>psr</sub></span>
            <span className="font-mono font-bold text-emerald-400">
              {pulsarCount} 顆 ({simulationResults.totalPairs} 對)
            </span>
          </div>
          <input
            type="range"
            min={15}
            max={67}
            step={1}
            value={pulsarCount}
            onChange={(e) => setPulsarCount(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>15 顆 (105 對，散佈較大)</span>
            <span>67 顆 (2,211 對，NANOGrav 15yr)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">重力波背景訊號振幅 (A<sub>GWB</sub> 倍率)</span>
            <span className="font-mono font-bold text-cyan-400">{gwbAmplitudeScale.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={2.5}
            step={0.05}
            value={gwbAmplitudeScale}
            onChange={(e) => setGwbAmplitudeScale(parseFloat(e.target.value))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.2× (微弱背景)</span>
            <span>1.0× (2.4 × 10⁻¹⁵)</span>
            <span>2.5× (強背景)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">單星自轉紅噪訊與量測雜訊比</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSystematics((v) => !v)}
                className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                  showSystematics
                    ? 'bg-purple-600/80 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                {showSystematics ? '隱藏單極/偶極對照' : '顯示單極/偶極對照'}
              </button>
              <span className="font-mono font-bold text-rose-300">{noiseRatio.toFixed(2)}</span>
            </div>
          </div>
          <input
            type="range"
            min={0.1}
            max={2.0}
            step={0.05}
            value={noiseRatio}
            onChange={(e) => setNoiseRatio(parseFloat(e.target.value))}
            className="mt-2 w-full accent-rose-400"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.10 (極低單星雜訊)</span>
            <span>0.45 (典型配置)</span>
            <span>2.00 (強雜訊掩蓋四極曲線)</span>
          </div>
        </div>
      </div>

      {/* Explicit Model Boundary Note */}
      <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">模擬器邊界與簡化說明：</span>
        本模擬採用理想化的各向同性、非偏振廣義相對論四極張量重力波背景模型（<span className="font-mono text-cyan-300">S(f) ∝ f⁻¹³/³</span>）與平穩高斯噪訊假設；真實脈衝星計時陣列分析還須同時擬合單一亮源連續波雙星造成的各向異性、太陽系質心星曆表不確定性、星際介質色散量（DM）隨時間變化與脈衝星自轉突變等系統效應。
      </div>
    </div>
  );
};
