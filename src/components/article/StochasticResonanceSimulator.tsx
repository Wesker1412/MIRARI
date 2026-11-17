import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

type PresetId = 'trapped' | 'optimal' | 'chaos' | 'custom';

interface SimParams {
  noiseD: number;
  amplitudeA: number;
  periodT: number;
}

interface SnrCurvePoint {
  D: number;
  theoryDb: number;
  linearDb: number;
  numericalDb: number | null;
}

const A_COEFF = 1.0;
const B_COEFF = 1.0;
const BARRIER_DU = (A_COEFF * A_COEFF) / (4 * B_COEFF); // 0.25
const CRITICAL_AC = Math.sqrt((4 * Math.pow(A_COEFF, 3)) / (27 * B_COEFF)); // ~0.3849
const DT = 0.05;
const HISTORY_LEN = 320;
const HIST_BINS = 25; // covers tau / T_Omega in [0, 2.5], bin width = 0.1

const PRESETS: Record<Exclude<PresetId, 'custom'>, SimParams> = {
  trapped: {
    noiseD: 0.025,
    amplitudeA: 0.18,
    periodT: 72,
  },
  optimal: {
    noiseD: 0.12,
    amplitudeA: 0.18,
    periodT: 72,
  },
  chaos: {
    noiseD: 0.36,
    amplitudeA: 0.18,
    periodT: 72,
  },
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianFromRng(rng: () => number): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Overdamped Kramers escape rate r_K(D) and mean residence time tau_K(D)
 * for quartic double-well U_0(x) = -(a/2)x^2 + (b/4)x^4.
 * Curvatures: U''(x_±) = 2a, |U''(0)| = a => prefactor sqrt(2) * a / (2*pi).
 */
function computeKramersRate(noiseD: number): number {
  if (noiseD <= 1e-5) return 0;
  const prefactor = (Math.sqrt(2) * A_COEFF) / (2 * Math.PI);
  return prefactor * Math.exp(-BARRIER_DU / noiseD);
}

function computeKramersTau(noiseD: number): number {
  const rK = computeKramersRate(noiseD);
  if (rK <= 1e-12) return Infinity;
  return 1 / rK;
}

/**
 * Time-scale matching noise D_match where tau_K(D) = T_Omega / 2.
 */
function computeMatchedNoiseD(periodT: number): number {
  const halfT = periodT * 0.5;
  const prefactor = (Math.sqrt(2) * A_COEFF) / (2 * Math.PI);
  const arg = halfT * prefactor;
  if (arg <= 1.05) return 0.4;
  return BARRIER_DU / Math.log(arg);
}

/**
 * Two-state adiabatic SNR (McNamara & Wiesenfeld 1989 / Gammaitoni et al. 1998)
 * scaled to finite DFT observation window T_obs = 14 * T_Omega for direct comparison
 * against Euler-Maruyama periodogram SNR.
 */
function computeTheoreticalTwoStateSnrDb(
  noiseD: number,
  amplitudeA: number,
  periodT: number
): number {
  const rK = computeKramersRate(noiseD);
  const xM = Math.sqrt(A_COEFF / B_COEFF);
  const tObs = 14 * periodT;
  // Dimensionless bin SNR ~ (pi / 4) * (A * xM / D)^2 * rK * (tObs / (2*pi))
  const snrLin =
    (Math.PI / 4) *
    Math.pow((amplitudeA * xM) / Math.max(0.008, noiseD), 2) *
    rK *
    (tObs / (4 * Math.PI));
  return 10 * Math.log10(Math.max(0.08, snrLin));
}

/**
 * Reference linear harmonic oscillator / single-well SNR (monotonically decays ~ A^2 / D).
 */
function computeLinearSystemSnrDb(
  noiseD: number,
  amplitudeA: number,
  periodT: number
): number {
  const tObs = 14 * periodT;
  const snrLin =
    0.045 *
    Math.pow(amplitudeA, 2) *
    (tObs / periodT) *
    (1 / Math.max(0.012, noiseD));
  return 10 * Math.log10(Math.max(0.08, snrLin));
}

function evaluateNumericalSnrPoint(
  noiseD: number,
  amplitudeA: number,
  periodT: number
): number {
  const omega = (2 * Math.PI) / periodT;
  const dtSweep = 0.1;
  const stepsPerCycle = Math.round(periodT / dtSweep);
  const numCycles = 14;
  const totalSteps = stepsPerCycle * numCycles;
  const stride = 6;
  const nSamples = Math.floor(totalSteps / stride);
  const trials = 5;

  let sumSig = 0;
  let sumNoise = 0;

  for (let tr = 0; tr < trials; tr++) {
    const rng = mulberry32(4242 + tr * 1013 + Math.round(noiseD * 2000));
    let x = tr % 2 === 0 ? -1.0 : 1.0;
    let t = 0;

    // Warm-up 2 cycles
    for (let i = 0; i < stepsPerCycle * 2; i++) {
      const z = gaussianFromRng(rng);
      const drift = A_COEFF * x - B_COEFF * x * x * x + amplitudeA * Math.cos(omega * t);
      x += drift * dtSweep + Math.sqrt(2 * noiseD * dtSweep) * z;
      if (x > 3.5) x = 3.5;
      if (x < -3.5) x = -3.5;
      t += dtSweep;
    }

    const states = new Float64Array(nSamples);
    let idx = 0;
    for (let i = 0; i < totalSteps; i++) {
      const z = gaussianFromRng(rng);
      const drift = A_COEFF * x - B_COEFF * x * x * x + amplitudeA * Math.cos(omega * t);
      x += drift * dtSweep + Math.sqrt(2 * noiseD * dtSweep) * z;
      if (x > 3.5) x = 3.5;
      if (x < -3.5) x = -3.5;
      t += dtSweep;
      if (i % stride === 0 && idx < nSamples) {
        states[idx++] = x >= 0 ? 1 : -1;
      }
    }

    const binPower = (k: number): number => {
      let re = 0;
      let im = 0;
      const w = (2 * Math.PI * k) / nSamples;
      for (let n = 0; n < nSamples; n++) {
        re += states[n] * Math.cos(w * n);
        im -= states[n] * Math.sin(w * n);
      }
      return (re * re + im * im) / (nSamples * nSamples);
    };

    const pSig = binPower(numCycles);
    let pNoise = 0;
    let cnt = 0;
    for (let dk = 2; dk <= 5; dk++) {
      if (numCycles - dk >= 1) {
        pNoise += binPower(numCycles - dk);
        cnt++;
      }
      pNoise += binPower(numCycles + dk);
      cnt++;
    }
    sumSig += pSig;
    sumNoise += cnt > 0 ? pNoise / cnt : 1e-6;
  }

  const avgSig = sumSig / trials;
  const avgNoise = sumNoise / trials;
  const snrLin = avgNoise > 1e-8 ? Math.max(0, avgSig - avgNoise) / avgNoise : 0;
  return 10 * Math.log10(Math.max(0.08, snrLin));
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

export const StochasticResonanceSimulator: React.FC = () => {
  const [noiseD, setNoiseD] = useState<number>(PRESETS.optimal.noiseD);
  const [amplitudeA, setAmplitudeA] = useState<number>(PRESETS.optimal.amplitudeA);
  const [periodT, setPeriodT] = useState<number>(PRESETS.optimal.periodT);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const [telemetry, setTelemetry] = useState<{
    x: number;
    t: number;
    transitions: number;
    meanResTau: number | null;
    syncRatio: number;
  }>({
    x: -1.0,
    t: 0,
    transitions: 0,
    meanResTau: null,
    syncRatio: 0,
  });

  const potentialCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trajectoryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const snrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const histCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const simRef = useRef<{
    x: number;
    t: number;
    wellSign: -1 | 1;
    lastSwitchTime: number;
    switchCount: number;
    resSum: number;
    resCount: number;
    histBins: Int32Array;
    historyX: number[];
    historySig: number[];
    recentXTrail: number[];
    rng: () => number;
  }>({
    x: -1.0,
    t: 0,
    wellSign: -1,
    lastSwitchTime: 0,
    switchCount: 0,
    resSum: 0,
    resCount: 0,
    histBins: new Int32Array(HIST_BINS),
    historyX: [],
    historySig: [],
    recentXTrail: [],
    rng: mulberry32(20261117),
  });

  const paramsRef = useRef({ noiseD, amplitudeA, periodT, isPaused });
  useEffect(() => {
    paramsRef.current = { noiseD, amplitudeA, periodT, isPaused };
  }, [noiseD, amplitudeA, periodT, isPaused]);

  const activePreset: PresetId = useMemo(() => {
    for (const key of ['trapped', 'optimal', 'chaos'] as const) {
      const p = PRESETS[key];
      if (
        Math.abs(noiseD - p.noiseD) < 0.003 &&
        Math.abs(amplitudeA - p.amplitudeA) < 0.005 &&
        Math.abs(periodT - p.periodT) < 1
      ) {
        return key;
      }
    }
    return 'custom';
  }, [noiseD, amplitudeA, periodT]);

  const kramersTau = useMemo(() => computeKramersTau(noiseD), [noiseD]);
  const halfPeriod = periodT * 0.5;
  const matchedNoiseD = useMemo(() => computeMatchedNoiseD(periodT), [periodT]);
  const isSubthreshold = amplitudeA < CRITICAL_AC;

  // Pre-seed simulation state whenever key parameters change so the residence-time histogram
  // and scrolling trajectory immediately display physically faithful statistics.
  const reseedAndWarmup = useCallback((dVal: number, aVal: number, tVal: number) => {
    const s = simRef.current;
    s.x = -1.0;
    s.t = 0;
    s.wellSign = -1;
    s.lastSwitchTime = 0;
    s.switchCount = 0;
    s.resSum = 0;
    s.resCount = 0;
    s.histBins.fill(0);
    s.historyX = [];
    s.historySig = [];
    s.recentXTrail = [];
    s.rng = mulberry32(20261117 + Math.round(dVal * 1000) + Math.round(aVal * 500));

    const omega = (2 * Math.PI) / tVal;
    // Run 28 driving cycles of Euler-Maruyama in ~1 ms for rich histogram + history
    const warmupSteps = Math.round((28 * tVal) / DT);
    const sampleInterval = Math.max(1, Math.floor((2.5 * tVal) / (DT * HISTORY_LEN)));

    for (let i = 0; i < warmupSteps; i++) {
      const z = gaussianFromRng(s.rng);
      const sig = aVal * Math.cos(omega * s.t);
      const drift = A_COEFF * s.x - B_COEFF * s.x * s.x * s.x + sig;
      s.x += drift * DT + Math.sqrt(2 * dVal * DT) * z;
      if (s.x > 2.4) s.x = 2.4;
      if (s.x < -2.4) s.x = -2.4;
      s.t += DT;

      // Schmitt-trigger well transition detection at x = ±0.55 to exclude barrier-recrossing chatter
      if (s.wellSign === -1 && s.x > 0.55) {
        if (s.switchCount > 0) {
          const tau = s.t - s.lastSwitchTime;
          const ratio = tau / tVal;
          const bin = Math.floor(ratio / 0.1);
          if (bin >= 0 && bin < HIST_BINS) s.histBins[bin]++;
          s.resSum += tau;
          s.resCount++;
        }
        s.wellSign = 1;
        s.lastSwitchTime = s.t;
        s.switchCount++;
      } else if (s.wellSign === 1 && s.x < -0.55) {
        if (s.switchCount > 0) {
          const tau = s.t - s.lastSwitchTime;
          const ratio = tau / tVal;
          const bin = Math.floor(ratio / 0.1);
          if (bin >= 0 && bin < HIST_BINS) s.histBins[bin]++;
          s.resSum += tau;
          s.resCount++;
        }
        s.wellSign = -1;
        s.lastSwitchTime = s.t;
        s.switchCount++;
      }

      if (i >= warmupSteps - HISTORY_LEN * sampleInterval && i % sampleInterval === 0) {
        s.historyX.push(s.x);
        s.historySig.push(Math.cos(omega * s.t));
      }
    }

    s.recentXTrail = s.historyX.slice(-16);

    setTelemetry({
      x: s.x,
      t: s.t,
      transitions: s.switchCount,
      meanResTau: s.resCount > 0 ? s.resSum / s.resCount : null,
      syncRatio: computeSyncScore(s.histBins),
    });
  }, []);

  useEffect(() => {
    reseedAndWarmup(noiseD, amplitudeA, periodT);
  }, [noiseD, amplitudeA, periodT, reseedAndWarmup]);

  // Compute bell-shaped theoretical curve & numerical Monte Carlo sweep when A or T_Omega changes
  const snrCurveData = useMemo(() => {
    const theoryPoints: SnrCurvePoint[] = [];
    const numSweepD = [0.025, 0.05, 0.08, 0.11, 0.125, 0.16, 0.22, 0.30, 0.38];
    const numMap = new Map<number, number>();
    for (const d of numSweepD) {
      numMap.set(d, evaluateNumericalSnrPoint(d, amplitudeA, periodT));
    }

    for (let d = 0.015; d <= 0.425; d += 0.01) {
      const roundedD = Math.round(d * 1000) / 1000;
      theoryPoints.push({
        D: roundedD,
        theoryDb: computeTheoreticalTwoStateSnrDb(roundedD, amplitudeA, periodT),
        linearDb: computeLinearSystemSnrDb(roundedD, amplitudeA, periodT),
        numericalDb: null,
      });
    }

    const numericalPoints: SnrCurvePoint[] = numSweepD.map((d) => ({
      D: d,
      theoryDb: computeTheoreticalTwoStateSnrDb(d, amplitudeA, periodT),
      linearDb: computeLinearSystemSnrDb(d, amplitudeA, periodT),
      numericalDb: numMap.get(d) ?? null,
    }));

    return { theoryPoints, numericalPoints };
  }, [amplitudeA, periodT]);

  const currentTheorySnrDb = useMemo(
    () => computeTheoreticalTwoStateSnrDb(noiseD, amplitudeA, periodT),
    [noiseD, amplitudeA, periodT]
  );

  // Main real-time animation loop (Euler-Maruyama integration + 4 Canvas renders)
  useEffect(() => {
    let rafId = 0;
    let frameCounter = 0;

    const stepAndDraw = () => {
      const { noiseD: dVal, amplitudeA: aVal, periodT: tVal, isPaused: paused } = paramsRef.current;
      const omega = (2 * Math.PI) / tVal;
      const s = simRef.current;

      if (!paused) {
        // Advance 4 Euler-Maruyama substeps per animation frame for smooth evolution
        const subSteps = 4;
        for (let k = 0; k < subSteps; k++) {
          const z = gaussianFromRng(s.rng);
          const sig = aVal * Math.cos(omega * s.t);
          const drift = A_COEFF * s.x - B_COEFF * s.x * s.x * s.x + sig;
          s.x += drift * DT + Math.sqrt(2 * dVal * DT) * z;
          if (s.x > 2.4) s.x = 2.4;
          if (s.x < -2.4) s.x = -2.4;
          s.t += DT;

          if (s.wellSign === -1 && s.x > 0.55) {
            if (s.switchCount > 0) {
              const tau = s.t - s.lastSwitchTime;
              const ratio = tau / tVal;
              const bin = Math.floor(ratio / 0.1);
              if (bin >= 0 && bin < HIST_BINS) s.histBins[bin]++;
              s.resSum += tau;
              s.resCount++;
            }
            s.wellSign = 1;
            s.lastSwitchTime = s.t;
            s.switchCount++;
          } else if (s.wellSign === 1 && s.x < -0.55) {
            if (s.switchCount > 0) {
              const tau = s.t - s.lastSwitchTime;
              const ratio = tau / tVal;
              const bin = Math.floor(ratio / 0.1);
              if (bin >= 0 && bin < HIST_BINS) s.histBins[bin]++;
              s.resSum += tau;
              s.resCount++;
            }
            s.wellSign = -1;
            s.lastSwitchTime = s.t;
            s.switchCount++;
          }
        }

        s.historyX.push(s.x);
        s.historySig.push(Math.cos(omega * s.t));
        if (s.historyX.length > HISTORY_LEN) {
          s.historyX.shift();
          s.historySig.shift();
        }
        s.recentXTrail.push(s.x);
        if (s.recentXTrail.length > 16) s.recentXTrail.shift();
      }

      drawPotentialCanvas(potentialCanvasRef.current, s.x, s.t, aVal, omega, s.recentXTrail);
      drawTrajectoryCanvas(trajectoryCanvasRef.current, s.historyX, s.historySig, aVal);
      drawSnrCanvas(snrCanvasRef.current, snrCurveData, dVal, matchedNoiseD);
      drawHistogramCanvas(histCanvasRef.current, s.histBins);

      frameCounter++;
      if (!paused && frameCounter % 12 === 0) {
        setTelemetry({
          x: s.x,
          t: s.t,
          transitions: s.switchCount,
          meanResTau: s.resCount > 0 ? s.resSum / s.resCount : null,
          syncRatio: computeSyncScore(s.histBins),
        });
      }

      rafId = requestAnimationFrame(stepAndDraw);
    };

    rafId = requestAnimationFrame(stepAndDraw);
    return () => cancelAnimationFrame(rafId);
  }, [snrCurveData, matchedNoiseD]);

  const applyPreset = (id: Exclude<PresetId, 'custom'>) => {
    const p = PRESETS[id];
    setNoiseD(p.noiseD);
    setAmplitudeA(p.amplitudeA);
    setPeriodT(p.periodT);
    setIsPaused(false);
  };

  const regimeStatus = useMemo(() => {
    if (noiseD < matchedNoiseD * 0.45) {
      return {
        label: '低雜訊困鎖 (τ_K ≫ T_Ω/2)',
        tone: 'text-amber-400',
        badgeBg: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      };
    }
    if (noiseD <= matchedNoiseD * 1.75) {
      return {
        label: '最佳隨機共振區 (τ_K ≈ T_Ω/2)',
        tone: 'text-emerald-400',
        badgeBg: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
      };
    }
    return {
      label: '強雜訊淹沒失序 (τ_K ≪ T_Ω/2)',
      tone: 'text-rose-400',
      badgeBg: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    };
  }, [noiseD, matchedNoiseD]);

  const formattedTauK =
    !Number.isFinite(kramersTau) || kramersTau > 99999
      ? '> 10⁵'
      : kramersTau >= 1000
      ? kramersTau.toExponential(1)
      : kramersTau.toFixed(1);

  return (
    <div className="my-8 rounded-2xl border border-slate-800 bg-slate-900/95 p-4 text-slate-100 shadow-xl sm:p-6">
      {/* Header & Presets */}
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-cyan-300">
              雙穩態隨機共振實驗室
            </span>
            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${regimeStatus.badgeBg}`}>
              {regimeStatus.label}
            </span>
          </div>
          <h3 className="mt-1.5 text-base font-bold text-slate-100 sm:text-lg">
            過阻尼雙穩態朗之萬勢阱：時間尺度匹配與非單調共振峰
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            當週期驅動振幅 A 低於靜態翻轉門檻 A<sub>c</sub> ≈ {CRITICAL_AC.toFixed(3)} 時，粒子無法獨力跨過勢壘；適度白雜訊 D 將克拉默斯停留時間 τ<sub>K</sub>(D) 調諧至與半週期 T<sub>Ω</sub>/2 同步，反而在輸出端放大訊號。
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPaused((v) => !v)}
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            {isPaused ? '繼續積分' : '暫停積分'}
          </button>
          <button
            type="button"
            onClick={() => reseedAndWarmup(noiseD, amplitudeA, periodT)}
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            重置統計
          </button>
        </div>
      </div>

      {/* Preset Scenario Selector */}
      <div className="mt-3.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyPreset('trapped')}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            activePreset === 'trapped'
              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
              : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
          }`}
        >
          低雜訊困鎖 (Subthreshold Trapped)
        </button>
        <button
          type="button"
          onClick={() => applyPreset('optimal')}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            activePreset === 'optimal'
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
              : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
          }`}
        >
          最佳隨機共振 (Optimal Resonance, τ<sub>K</sub> ≈ T/2)
        </button>
        <button
          type="button"
          onClick={() => applyPreset('chaos')}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            activePreset === 'chaos'
              ? 'border-rose-400 bg-rose-500/20 text-rose-200'
              : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
          }`}
        >
          強雜訊淹沒 (Over-damped Chaos)
        </button>
      </div>

      {/* Visual Zone 1 & 2: Dynamic Potential Well + Real-time Trajectory */}
      <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 lg:col-span-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              1. 動態傾斜雙穩態勢阱 U(x, t)
            </span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                isSubthreshold
                  ? 'bg-cyan-500/15 text-cyan-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {isSubthreshold ? `A < Ac (${CRITICAL_AC.toFixed(2)}) 亞閾值` : 'A ≥ Ac 超閾值'}
            </span>
          </div>
          <canvas
            ref={potentialCanvasRef}
            className="block w-full rounded-lg"
            style={{ height: '220px' }}
          />
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 lg:col-span-7">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              2. 即時粒子軌跡 x(t) 與微弱週期訊號對照
            </span>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
                輸出位置 x(t)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                微弱驅動 A cos(Ωt)
              </span>
            </div>
          </div>
          <canvas
            ref={trajectoryCanvasRef}
            className="block w-full rounded-lg"
            style={{ height: '220px' }}
          />
        </div>
      </div>

      {/* Visual Zone 3: Non-monotonic Bell-shaped SNR Curve + Residence-Time Histogram */}
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 lg:col-span-7">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              3A. 非單調鐘形訊雜比曲線 (SNR vs 雜訊強度 D)
            </span>
            <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-emerald-400" />
                雙穩態理論 SNR
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-cyan-300" />
                EM 數值實測
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 border-b border-dashed border-slate-400" />
                線性系統 (單調下降)
              </span>
            </div>
          </div>
          <canvas
            ref={snrCanvasRef}
            className="block w-full rounded-lg"
            style={{ height: '210px' }}
          />
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 lg:col-span-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              3B. 停留時間直方圖 (τ / T<sub>Ω</sub>)
            </span>
            <span className="font-mono text-[10px] text-emerald-300">
              奇半週期共振峰: 0.5, 1.5 T<sub>Ω</sub>
            </span>
          </div>
          <canvas
            ref={histCanvasRef}
            className="block w-full rounded-lg"
            style={{ height: '210px' }}
          />
        </div>
      </div>

      {/* Live Telemetry Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">雜訊／勢壘比 D / ΔU</div>
          <div className="mt-1 font-mono text-sm font-bold text-cyan-300 sm:text-base">
            {(noiseD / BARRIER_DU).toFixed(2)} <span className="text-xs font-normal text-slate-400">(D={noiseD.toFixed(3)})</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">克拉默斯停留時間 τ<sub>K</sub> vs T<sub>Ω</sub>/2</div>
          <div className={`mt-1 font-mono text-sm font-bold sm:text-base ${regimeStatus.tone}`}>
            {formattedTauK} <span className="text-xs font-normal text-slate-400">/ {halfPeriod.toFixed(0)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">雙穩態輸出訊雜比 SNR</div>
          <div className="mt-1 font-mono text-sm font-bold text-emerald-300 sm:text-base">
            {currentTheorySnrDb.toFixed(1)} dB
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">累計跨阱跳躍／半週期同步率</div>
          <div className="mt-1 font-mono text-sm font-bold text-slate-100 sm:text-base">
            {telemetry.transitions} 次{' '}
            <span className="text-xs font-normal text-amber-300">
              ({(telemetry.syncRatio * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Slider 1: Noise Intensity D */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">白雜訊強度 D</span>
            <span className="font-mono font-bold text-cyan-300">{noiseD.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min={0.015}
            max={0.42}
            step={0.005}
            value={noiseD}
            onChange={(e) => setNoiseD(parseFloat(e.target.value))}
            className="mt-2 w-full cursor-pointer accent-cyan-500"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>0.015 困鎖</span>
            <button
              type="button"
              onClick={() => setNoiseD(Math.round(matchedNoiseD * 200) / 200)}
              className="cursor-pointer rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300 hover:bg-emerald-500/20"
            >
              匹配點 D≈{matchedNoiseD.toFixed(3)}
            </button>
            <span>0.42 混沌</span>
          </div>
        </div>

        {/* Slider 2: Driving Amplitude A */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">週期訊號振幅 A</span>
            <span className="font-mono font-bold text-amber-300">
              {amplitudeA.toFixed(2)} {isSubthreshold ? '(< Ac)' : '(≥ Ac)'}
            </span>
          </div>
          <input
            type="range"
            min={0.05}
            max={0.45}
            step={0.01}
            value={amplitudeA}
            onChange={(e) => setAmplitudeA(parseFloat(e.target.value))}
            className="mt-2 w-full cursor-pointer accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0.05 極弱</span>
            <span>A<sub>c</sub> = {CRITICAL_AC.toFixed(2)}</span>
            <span>0.45 超閾值</span>
          </div>
        </div>

        {/* Slider 3: Driving Period T_Omega */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">驅動週期 T<sub>Ω</sub></span>
            <span className="font-mono font-bold text-emerald-300">
              {periodT} (半週期 {halfPeriod.toFixed(0)})
            </span>
          </div>
          <input
            type="range"
            min={40}
            max={120}
            step={4}
            value={periodT}
            onChange={(e) => setPeriodT(parseInt(e.target.value, 10))}
            className="mt-2 w-full cursor-pointer accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>40 (快振盪)</span>
            <span>72 (基準)</span>
            <span>120 (慢振盪)</span>
          </div>
        </div>
      </div>

      {/* Explicit Model Boundary Note */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">模型說明與數值邊界：</span>
        過阻尼一維雙穩態朗之萬方程（Euler–Maruyama）示範模型，展示時間尺度匹配與非單調共振峰機制（無因次參數 a = 1, b = 1, ΔU = 0.25, Δt = 0.05）。SNR 曲線比較 McNamara–Wiesenfeld / Gammaitoni 兩態絕熱理論、Euler–Maruyama 門檻輸出頻譜功率比與線性系統單調衰減基準，非完整三維大氣環流或生物離子通道電導網路求解器。
      </div>
    </div>
  );
};

function computeSyncScore(histBins: Int32Array): number {
  let total = 0;
  let peakWindow = 0;
  for (let i = 0; i < histBins.length; i++) {
    total += histBins[i];
    // bins 3..6 correspond to tau / T_Omega in [0.3, 0.7), centered around 0.5
    if (i >= 3 && i <= 6) {
      peakWindow += histBins[i];
    }
  }
  if (total === 0) return 0;
  return peakWindow / total;
}

function drawPotentialCanvas(
  canvas: HTMLCanvasElement | null,
  particleX: number,
  time: number,
  amplitudeA: number,
  omega: number,
  trail: number[]
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { w, h, dpr } = getDprCanvasSize(canvas, 340, 220);
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);

  const padL = 28;
  const padR = 16;
  const padT = 22;
  const padB = 26;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xMin = -1.75;
  const xMax = 1.75;
  const uMin = -0.95;
  const uMax = 1.15;

  const mapX = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
  const mapY = (u: number) => padT + ((uMax - u) / (uMax - uMin)) * plotH;

  // Grid & center barrier axis
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mapX(0), padT);
  ctx.lineTo(mapX(0), padT + plotH);
  ctx.moveTo(padL, mapY(0));
  ctx.lineTo(padL + plotW, mapY(0));
  ctx.stroke();

  const tilt = amplitudeA * Math.cos(omega * time);

  // Unperturbed symmetric reference U0(x)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const xv = xMin + (i / 120) * (xMax - xMin);
    const u0 = -0.5 * A_COEFF * xv * xv + 0.25 * B_COEFF * Math.pow(xv, 4);
    const px = mapX(xv);
    const py = mapY(u0);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Instantaneous tilted potential U(x, t)
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i <= 140; i++) {
    const xv = xMin + (i / 140) * (xMax - xMin);
    const u = -0.5 * A_COEFF * xv * xv + 0.25 * B_COEFF * Math.pow(xv, 4) - tilt * xv;
    const px = mapX(xv);
    const py = mapY(u);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Barrier height annotation
  const uZero = 0;
  const uWellLeft = -0.5 * A_COEFF + 0.25 * B_COEFF + tilt;
  const uWellRight = -0.5 * A_COEFF + 0.25 * B_COEFF - tilt;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.78)';
  ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('左勢阱 (-1)', mapX(-1.35), h - 8);
  ctx.fillText('右勢阱 (+1)', mapX(0.65), h - 8);

  // Subtle ΔU marker at x = 0
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mapX(0) - 4, mapY(uZero));
  ctx.lineTo(mapX(0) + 4, mapY(uZero));
  ctx.moveTo(mapX(0) - 4, mapY(-BARRIER_DU));
  ctx.lineTo(mapX(0) + 4, mapY(-BARRIER_DU));
  ctx.moveTo(mapX(0), mapY(uZero));
  ctx.lineTo(mapX(0), mapY(-BARRIER_DU));
  ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('ΔU', mapX(0) + 6, mapY(-BARRIER_DU * 0.5) + 3);

  // Recent trail points riding along potential
  for (let i = 0; i < trail.length; i++) {
    const tx = Math.max(-1.65, Math.min(1.65, trail[i]));
    const tu = -0.5 * A_COEFF * tx * tx + 0.25 * B_COEFF * Math.pow(tx, 4) - tilt * tx;
    const alpha = ((i + 1) / trail.length) * 0.45;
    ctx.fillStyle = `rgba(34, 211, 238, ${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(mapX(tx), mapY(tu) - 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Active particle
  const clampedX = Math.max(-1.65, Math.min(1.65, particleX));
  const particleU =
    -0.5 * A_COEFF * clampedX * clampedX +
    0.25 * B_COEFF * Math.pow(clampedX, 4) -
    tilt * clampedX;
  const ballPx = mapX(clampedX);
  const ballPy = mapY(particleU) - 6;

  ctx.fillStyle = 'rgba(34, 211, 238, 0.25)';
  ctx.beginPath();
  ctx.arc(ballPx, ballPy, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#22d3ee';
  ctx.strokeStyle = '#ecfeff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ballPx, ballPy, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tilt status label
  const tiltDir = tilt > 0.02 ? '右側較深 →' : tilt < -0.02 ? '← 左側較深' : '雙阱對稱';
  ctx.fillStyle = Math.abs(uWellRight - uWellLeft) > 0.04 ? '#fcd34d' : '#94a3b8';
  ctx.font = '10px sans-serif';
  ctx.fillText(`瞬時傾斜: ${tiltDir}`, padL, 14);

  ctx.restore();
}

function drawTrajectoryCanvas(
  canvas: HTMLCanvasElement | null,
  historyX: number[],
  historySig: number[],
  amplitudeA: number
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { w, h, dpr } = getDprCanvasSize(canvas, 480, 220);
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);

  const padL = 34;
  const padR = 14;
  const padT = 16;
  const padB = 24;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const yMin = -1.75;
  const yMax = 1.75;
  const mapY = (val: number) => padT + ((yMax - val) / (yMax - yMin)) * plotH;

  // Stable wells & barrier guidelines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  for (const level of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(padL, mapY(level));
    ctx.lineTo(padL + plotW, mapY(level));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = '#64748b';
  ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('+1', 10, mapY(1) + 3);
  ctx.fillText(' 0', 10, mapY(0) + 3);
  ctx.fillText('-1', 10, mapY(-1) + 3);

  const n = historyX.length;
  if (n > 1) {
    // Weak input signal overlay (scaled proportionally to A/Ac so user feels how weak it is)
    const visualScale = Math.min(0.85, Math.max(0.22, amplitudeA / CRITICAL_AC * 0.55));
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const px = padL + (i / (HISTORY_LEN - 1)) * plotW;
      const py = mapY(historySig[i] * visualScale);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Output trajectory x(t)
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const px = padL + (i / (HISTORY_LEN - 1)) * plotW;
      const py = mapY(Math.max(yMin, Math.min(yMax, historyX[i])));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px sans-serif';
  ctx.fillText('時間推進 →', padL + plotW - 60, h - 7);
  ctx.fillText('勢阱切換門檻 x = 0', padL + 4, mapY(0) - 5);

  ctx.restore();
}

function drawSnrCanvas(
  canvas: HTMLCanvasElement | null,
  curveData: { theoryPoints: SnrCurvePoint[]; numericalPoints: SnrCurvePoint[] },
  currentD: number,
  matchedD: number
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { w, h, dpr } = getDprCanvasSize(canvas, 420, 210);
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);

  const padL = 40;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const dMin = 0.015;
  const dMax = 0.42;
  const dbMin = -12;
  const dbMax = 18;

  const mapX = (d: number) => padL + ((d - dMin) / (dMax - dMin)) * plotW;
  const mapY = (db: number) =>
    padT + ((dbMax - Math.max(dbMin, Math.min(dbMax, db))) / (dbMax - dbMin)) * plotH;

  // Grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  for (const dbTick of [-10, 0, 10]) {
    ctx.beginPath();
    ctx.moveTo(padL, mapY(dbTick));
    ctx.lineTo(padL + plotW, mapY(dbTick));
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(`${dbTick}`, 8, mapY(dbTick) + 3);
  }
  ctx.fillStyle = '#64748b';
  ctx.fillText('dB', 8, padT + 6);

  // Linear system reference (monotonic decay)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  curveData.theoryPoints.forEach((pt, idx) => {
    const px = mapX(pt.D);
    const py = mapY(pt.linearDb);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // Theoretical bistable SNR bell curve
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  curveData.theoryPoints.forEach((pt, idx) => {
    const px = mapX(pt.D);
    const py = mapY(pt.theoryDb);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Numerical Euler-Maruyama Monte Carlo dots
  for (const pt of curveData.numericalPoints) {
    if (pt.numericalDb === null) continue;
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(mapX(pt.D), mapY(pt.numericalDb), 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Kramers time-scale matching line D_match
  if (matchedD >= dMin && matchedD <= dMax) {
    const mx = mapX(matchedD);
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(mx, padT);
    ctx.lineTo(mx, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#6ee7b7';
    ctx.font = '10px sans-serif';
    ctx.fillText('τK=T/2', Math.min(padL + plotW - 38, mx + 4), padT + 11);
  }

  // Current D cursor
  const cx = mapX(currentD);
  let nearestPt = curveData.theoryPoints[0];
  for (const pt of curveData.theoryPoints) {
    if (Math.abs(pt.D - currentD) < Math.abs(nearestPt.D - currentD)) {
      nearestPt = pt;
    }
  }
  const cy = mapY(nearestPt.theoryDb);

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(cx, padT);
  ctx.lineTo(cx, padT + plotH);
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // X axis labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
  for (const dTick of [0.05, 0.125, 0.25, 0.38]) {
    ctx.fillText(dTick.toFixed(2), mapX(dTick) - 10, h - 8);
  }
  ctx.fillText('D', padL + plotW - 10, h - 8);

  ctx.restore();
}

function drawHistogramCanvas(
  canvas: HTMLCanvasElement | null,
  histBins: Int32Array
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { w, h, dpr } = getDprCanvasSize(canvas, 320, 210);
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);

  const padL = 24;
  const padR = 14;
  const padT = 20;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  let maxCount = 1;
  let totalCount = 0;
  for (let i = 0; i < histBins.length; i++) {
    if (histBins[i] > maxCount) maxCount = histBins[i];
    totalCount += histBins[i];
  }

  // Odd half-period vertical markers: 0.5, 1.5, 2.5
  for (const marker of [0.5, 1.5]) {
    const mx = padL + (marker / 2.5) * plotW;
    ctx.strokeStyle = marker === 0.5 ? 'rgba(52, 211, 153, 0.55)' : 'rgba(52, 211, 153, 0.28)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mx, padT);
    ctx.lineTo(mx, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const barW = plotW / HIST_BINS;
  for (let i = 0; i < HIST_BINS; i++) {
    const val = histBins[i];
    const barH = totalCount > 0 ? (val / maxCount) * (plotH - 6) : 0;
    const bx = padL + i * barW + 1;
    const by = padT + plotH - barH;
    const isNearHalf = i >= 3 && i <= 6;
    ctx.fillStyle = isNearHalf ? '#34d399' : '#38bdf8';
    ctx.fillRect(bx, by, Math.max(2, barW - 2), barH);
  }

  // Axis baseline
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  if (totalCount === 0) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = '11px sans-serif';
    ctx.fillText('雜訊過弱，粒子困鎖於單側勢阱（0 次跳躍）', padL + 8, padT + plotH * 0.48);
  }

  ctx.fillStyle = '#6ee7b7';
  ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('0.5', padL + (0.5 / 2.5) * plotW - 9, padT - 5);
  ctx.fillText('1.5', padL + (1.5 / 2.5) * plotW - 9, padT - 5);

  ctx.fillStyle = '#94a3b8';
  for (const tTick of [0, 0.5, 1.0, 1.5, 2.0, 2.5]) {
    const tx = padL + (tTick / 2.5) * plotW;
    ctx.fillText(tTick.toFixed(1), tx - 8, h - 8);
  }

  ctx.restore();
}
