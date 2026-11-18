import React, { useState, useEffect, useRef, useMemo } from 'react';

type GasPresetId = 'argon_air' | 'helium' | 'nitrogen';
type ScenarioPresetId = 'subthreshold' | 'stable_sbsl' | 'unstable_tear' | 'custom';
type RegimeKind = 'subthreshold' | 'stable_sbsl' | 'shape_unstable';

interface GasConfig {
  id: GasPresetId;
  label: string;
  shortLabel: string;
  gamma: number;
  gammaThermal: number;
  hardCoreRatio: number; // R0 / h
  soundSpeedGas: number; // m/s at ambient
  chemLossNote: string;
  emissionEfficiency: number; // relative optical efficiency factor
}

interface TrajectorySample {
  phase: number; // normalized t / T_ac in [0, 1]
  tUs: number; // microseconds within cycle
  rUm: number;
  rNorm: number; // R / R0
  vMs: number; // dR/dt in m/s
  tempK: number;
  pgAtm: number;
  pDriveAtm: number; // P_a * sin(omega * t) in atm (signed acoustic drive)
}

interface SimulationResult {
  samples: TrajectorySample[];
  rMaxUm: number;
  rMinUm: number;
  rMaxRatio: number;
  minCollapseVelMs: number;
  tMaxK: number;
  pMaxAtm: number;
  collapsePhase: number;
  hardCoreUm: number;
  regime: RegimeKind;
  flashStrength: number; // 0..1 normalized visual flash intensity
  estimatedPulsePs: number | null;
  stepsUsed: number;
}

// Water & acoustic chamber constants (26.5 kHz, 20 °C degassed water)
const P0_PA = 101325;
const RHO_WATER = 998;
const SIGMA_WATER = 0.0725;
const MU_WATER = 0.001;
const C_LIQUID = 1481;
const FREQ_HZ = 26500;
const OMEGA = 2 * Math.PI * FREQ_HZ;
const T_AC = 1 / FREQ_HZ; // ~37.736 us
const T0_K = 293.15;

const GAS_CONFIGS: Record<GasPresetId, GasConfig> = {
  argon_air: {
    id: 'argon_air',
    label: '標準空氣 / 1% 氬氣精餾核心',
    shortLabel: '空氣 / 1% Ar 精餾核',
    gamma: 5 / 3,
    gammaThermal: 5 / 3,
    hardCoreRatio: 8.86,
    soundSpeedGas: 319,
    chemLossNote: 'N₂/O₂ 解離溶出，惰性 1% 氬氣透過整流擴散主導核心',
    emissionEfficiency: 1.0,
  },
  helium: {
    id: 'helium',
    label: '純氦氣 (高絕熱指數低加熱/高導熱)',
    shortLabel: '純氦氣 (高導熱降溫)',
    gamma: 5 / 3,
    gammaThermal: 1.45,
    hardCoreRatio: 9.95,
    soundSpeedGas: 1007,
    chemLossNote: '單原子 γ=5/3 但熱導率極高（約氬氣 8.5 倍），塌縮熱量迅速漏失至水中',
    emissionEfficiency: 0.25,
  },
  nitrogen: {
    id: 'nitrogen',
    label: '純氮氣 (高電離/化學耗散低光強)',
    shortLabel: '純氮氣 (解離耗散)',
    gamma: 1.4,
    gammaThermal: 1.32,
    hardCoreRatio: 8.54,
    soundSpeedGas: 349,
    chemLossNote: '雙原子振動與吸熱解離壓低峰值溫度，且反應生成可溶 NOₓ 持續流失氣體',
    emissionEfficiency: 0.18,
  },
};

const SCENARIO_PRESETS: Record<
  Exclude<ScenarioPresetId, 'custom'>,
  { paAtm: number; r0Um: number; gasId: GasPresetId }
> = {
  subthreshold: { paAtm: 1.05, r0Um: 4.5, gasId: 'argon_air' },
  stable_sbsl: { paAtm: 1.35, r0Um: 4.5, gasId: 'argon_air' },
  unstable_tear: { paAtm: 1.5, r0Um: 5.8, gasId: 'argon_air' },
};

/**
 * Evaluate stability regime in (Pa, R0) phase space following Brenner, Hilgenfeldt & Lohse (2002):
 * - Below cavitation / rectified-diffusion threshold: insufficient inertial collapse
 * - Upper Rayleigh-Taylor / parametric shape-instability boundary: bubble tears apart
 * - Narrow stable SBSL island between the two bounds
 */
function classifyRegime(paAtm: number, r0Um: number, rMaxRatio: number): RegimeKind {
  // Upper shape-instability boundary (Rayleigh-Taylor + parametric afterbounce instability)
  const upperPaLimit = 1.445 - 0.038 * (r0Um - 4.0);
  if (paAtm > upperPaLimit || (r0Um > 6.1 && paAtm >= 1.26) || rMaxRatio > 11.4) {
    return 'shape_unstable';
  }
  // Lower cavitation & rectified-diffusion threshold
  const lowerPaLimit = 1.18 + Math.max(0, 3.3 - r0Um) * 0.06;
  if (paAtm < lowerPaLimit || rMaxRatio < 4.5) {
    return 'subthreshold';
  }
  return 'stable_sbsl';
}

/**
 * Adaptive step-doubling 4th-order Runge-Kutta (RK4) solver for the spherical modified
 * Rayleigh-Plesset ODE with van der Waals hard core h and acoustic radiation damping:
 *   R d²R/dt² + (3/2)(dR/dt)² = [Pg(R) - 2σ/R - 4μ(dR/dt)/R - P0 - Pa sin(ωt)] / ρ
 *                               + (R / (ρ c_l)) * dPg/dt
 */
function solveRayleighPlesset(
  paAtm: number,
  r0Um: number,
  gas: GasConfig
): SimulationResult {
  const r0 = r0Um * 1e-6;
  const h = r0 / gas.hardCoreRatio;
  const h3 = h * h * h;
  const r0MinusH3 = r0 * r0 * r0 - h3;
  const pEq = P0_PA + (2 * SIGMA_WATER) / r0;
  const pa = paAtm * P0_PA;

  const evalDerivs = (t: number, R: number, V: number): [number, number] => {
    const rSafe = Math.max(R, h * 1.002);
    const r3 = rSafe * rSafe * rSafe;
    const denom = Math.max(h3 * 1e-4, r3 - h3);
    const pg = pEq * Math.pow(r0MinusH3 / denom, gas.gamma);
    const dPgDt = -(3 * gas.gamma * rSafe * rSafe * V * pg) / denom;
    const pressureDrive = P0_PA + pa * Math.sin(OMEGA * t);
    const rhs =
      (pg - (2 * SIGMA_WATER) / rSafe - (4 * MU_WATER * V) / rSafe - pressureDrive) / RHO_WATER +
      (rSafe / (RHO_WATER * C_LIQUID)) * dPgDt;
    const acc = (rhs - 1.5 * V * V) / rSafe;
    return [V, acc];
  };

  const rk4Step = (t: number, R: number, V: number, dt: number): [number, number] => {
    const [k1r, k1v] = evalDerivs(t, R, V);
    const [k2r, k2v] = evalDerivs(t + 0.5 * dt, R + 0.5 * dt * k1r, V + 0.5 * dt * k1v);
    const [k3r, k3v] = evalDerivs(t + 0.5 * dt, R + 0.5 * dt * k2r, V + 0.5 * dt * k2v);
    const [k4r, k4v] = evalDerivs(t + dt, R + dt * k3r, V + dt * k3v);
    return [
      R + (dt / 6) * (k1r + 2 * k2r + 2 * k3r + k4r),
      V + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v),
    ];
  };

  let t = 0;
  let R = r0;
  let V = 0;
  let dt = T_AC / 400;

  // Integrate 2.5 acoustic cycles; sample the steady periodic window [1.5 T_ac, 2.5 T_ac]
  // so rarefaction -> expansion -> violent collapse -> picosecond flash -> afterbounces sit inside [0, 1].
  const tStartPlot = 1.5 * T_AC;
  const tEnd = 2.5 * T_AC;
  let steps = 0;

  const rawPoints: TrajectorySample[] = [];
  let rMax = r0;
  let rMin = r0;
  let minCollapseVel = 0;
  let tMaxK = T0_K;
  let pMaxAtm = pEq / P0_PA;
  let collapsePhase = 0.62;

  const recordPoint = (currT: number, currR: number, currV: number) => {
    const phase = Math.max(0, Math.min(1, (currT - tStartPlot) / T_AC));
    const r3 = currR * currR * currR;
    const denom = Math.max(h3 * 1e-4, r3 - h3);
    const comp = r0MinusH3 / denom;
    const pg = pEq * Math.pow(comp, gas.gamma);
    // Isothermal during slow expansion (R > R0), adiabatic heating during rapid collapse (R <= R0)
    const tempK =
      currR <= r0 ? T0_K * Math.pow(comp, gas.gammaThermal - 1) : T0_K;
    const pgAtm = pg / P0_PA;
    const pDriveAtm = (pa * Math.sin(OMEGA * currT)) / P0_PA;

    if (currR > rMax) rMax = currR;
    if (currR < rMin) {
      rMin = currR;
      collapsePhase = phase;
    }
    if (currV < minCollapseVel) minCollapseVel = currV;
    if (tempK > tMaxK) tMaxK = tempK;
    if (pgAtm > pMaxAtm) pMaxAtm = pgAtm;

    rawPoints.push({
      phase,
      tUs: phase * T_AC * 1e6,
      rUm: currR * 1e6,
      rNorm: currR / r0,
      vMs: currV,
      tempK,
      pgAtm,
      pDriveAtm,
    });
  };

  while (t < tEnd && steps < 24000) {
    if (t + dt > tEnd) dt = tEnd - t;

    const [r1, v1] = rk4Step(t, R, V, dt);
    const [rh, vh] = rk4Step(t, R, V, 0.5 * dt);
    const [r2, v2] = rk4Step(t + 0.5 * dt, rh, vh, 0.5 * dt);

    const invalid =
      !Number.isFinite(r2) ||
      !Number.isFinite(v2) ||
      r2 <= h * 1.003 ||
      r1 <= h * 1.003;
    const errR = Math.abs(r2 - r1) / Math.max(r0 * 0.05, r2 - h);
    const errV = Math.abs(v2 - v1) / Math.max(20, Math.abs(v2));
    const err = Math.max(errR, errV);

    if ((invalid || err > 1e-3) && dt > 1e-13) {
      dt *= 0.4;
      continue;
    }

    R = Math.max(h * 1.003, r2);
    V = v2;
    t += dt;
    steps++;

    if (t >= tStartPlot) {
      recordPoint(t, R, V);
    }

    if (err < 5e-5) {
      dt = Math.min(T_AC / 300, dt * 1.6);
    } else if (err < 3e-4) {
      dt = Math.min(T_AC / 300, dt * 1.15);
    }
  }

  // Downsample gently to ~360 points while guaranteeing exact preservation of collapse peak & afterbounce extrema
  const samples = decimatePreservingPeaks(rawPoints, 360);
  const rMaxRatio = rMax / r0;
  const regime = classifyRegime(paAtm, r0Um, rMaxRatio);

  // Optical flash brightness indicator (thermal bremsstrahlung / recombination scaling above ~6500 K)
  const thermalFactor =
    tMaxK > 6000 ? Math.min(1, (tMaxK - 6000) / 11000) : 0;
  const flashStrength = Math.min(
    1,
    thermalFactor * gas.emissionEfficiency * (regime === 'subthreshold' ? 0.15 : 1.0)
  );
  const estimatedPulsePs =
    flashStrength > 0.12
      ? Math.round(Math.max(45, Math.min(340, 260 - (tMaxK - 7000) * 0.011)))
      : null;

  return {
    samples,
    rMaxUm: rMax * 1e6,
    rMinUm: rMin * 1e6,
    rMaxRatio,
    minCollapseVelMs: minCollapseVel,
    tMaxK,
    pMaxAtm,
    collapsePhase,
    hardCoreUm: h * 1e6,
    regime,
    flashStrength,
    estimatedPulsePs,
    stepsUsed: steps,
  };
}

function decimatePreservingPeaks(
  points: TrajectorySample[],
  targetCount: number
): TrajectorySample[] {
  if (points.length <= targetCount) return points;

  // Find index of minimum radius / maximum temperature
  let peakIdx = 0;
  let bestT = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i].tempK > bestT) {
      bestT = points[i].tempK;
      peakIdx = i;
    }
  }

  const out: TrajectorySample[] = [];
  const step = (points.length - 1) / (targetCount - 1);
  let insertedPeak = false;

  for (let k = 0; k < targetCount; k++) {
    const idx = Math.round(k * step);
    if (!insertedPeak && idx >= peakIdx) {
      if (idx > peakIdx) out.push(points[peakIdx]);
      insertedPeak = true;
    }
    out.push(points[idx]);
  }
  return out;
}

function interpolateSampleAtPhase(
  samples: TrajectorySample[],
  phase: number
): TrajectorySample {
  if (samples.length === 0) {
    return {
      phase: 0,
      tUs: 0,
      rUm: 4.5,
      rNorm: 1,
      vMs: 0,
      tempK: T0_K,
      pgAtm: 1,
      pDriveAtm: 0,
    };
  }
  const p = ((phase % 1) + 1) % 1;
  // Binary search by phase
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].phase <= p) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const span = b.phase - a.phase;
  if (span <= 1e-9) return a;
  const w = Math.max(0, Math.min(1, (p - a.phase) / span));
  return {
    phase: p,
    tUs: a.tUs + (b.tUs - a.tUs) * w,
    rUm: a.rUm + (b.rUm - a.rUm) * w,
    rNorm: a.rNorm + (b.rNorm - a.rNorm) * w,
    vMs: a.vMs + (b.vMs - a.vMs) * w,
    tempK: a.tempK + (b.tempK - a.tempK) * w,
    pgAtm: a.pgAtm + (b.pgAtm - a.pgAtm) * w,
    pDriveAtm: a.pDriveAtm + (b.pDriveAtm - a.pDriveAtm) * w,
  };
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

export const SonoluminescenceBubbleSimulator: React.FC = () => {
  const [paAtm, setPaAtm] = useState<number>(SCENARIO_PRESETS.stable_sbsl.paAtm);
  const [r0Um, setR0Um] = useState<number>(SCENARIO_PRESETS.stable_sbsl.r0Um);
  const [gasId, setGasId] = useState<GasPresetId>(SCENARIO_PRESETS.stable_sbsl.gasId);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [slowMotionCollapse, setSlowMotionCollapse] = useState<boolean>(true);
  const [liveReadout, setLiveReadout] = useState<{
    phase: number;
    rUm: number;
    tempK: number;
  }>({
    phase: 0,
    rUm: SCENARIO_PRESETS.stable_sbsl.r0Um,
    tempK: T0_K,
  });

  const chamberCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const curvesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(isPaused);
  const slowMoRef = useRef<boolean>(slowMotionCollapse);

  const gasConfig = GAS_CONFIGS[gasId];

  const simResult = useMemo(
    () => solveRayleighPlesset(paAtm, r0Um, gasConfig),
    [paAtm, r0Um, gasConfig]
  );

  const simResultRef = useRef<SimulationResult>(simResult);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    slowMoRef.current = slowMotionCollapse;
  }, [slowMotionCollapse]);

  useEffect(() => {
    simResultRef.current = simResult;
  }, [simResult]);

  const activeScenario: ScenarioPresetId = useMemo(() => {
    for (const key of ['subthreshold', 'stable_sbsl', 'unstable_tear'] as const) {
      const p = SCENARIO_PRESETS[key];
      if (
        Math.abs(paAtm - p.paAtm) < 0.005 &&
        Math.abs(r0Um - p.r0Um) < 0.05 &&
        gasId === p.gasId
      ) {
        return key;
      }
    }
    return 'custom';
  }, [paAtm, r0Um, gasId]);

  const applyScenario = (id: Exclude<ScenarioPresetId, 'custom'>) => {
    const p = SCENARIO_PRESETS[id];
    setPaAtm(p.paAtm);
    setR0Um(p.r0Um);
    setGasId(p.gasId);
    setIsPaused(false);
  };

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let uiCounter = 0;

    const renderFrame = (now: number) => {
      const dtSec = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const res = simResultRef.current;

      if (!isPausedRef.current) {
        // Base cycle takes ~4.2 s so humans can observe expansion, collapse, and afterbounces.
        // In slow-motion collapse mode, slow down near the violent collapse window so the picosecond flash is clearly visible.
        const distToCollapse = Math.abs(phaseRef.current - res.collapsePhase);
        const nearCollapse = slowMoRef.current && distToCollapse < 0.085;
        const speed = nearCollapse ? 0.095 : 0.24;
        phaseRef.current = (phaseRef.current + dtSec * speed) % 1;
      }

      const sample = interpolateSampleAtPhase(res.samples, phaseRef.current);

      drawChamberCanvas(
        chamberCanvasRef.current,
        sample,
        res,
        r0Um,
        paAtm,
        gasConfig
      );
      drawCurvesCanvas(
        curvesCanvasRef.current,
        res,
        phaseRef.current,
        paAtm
      );

      uiCounter++;
      if (uiCounter % 6 === 0) {
        setLiveReadout({
          phase: phaseRef.current,
          rUm: sample.rUm,
          tempK: sample.tempK,
        });
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    // Draw initial frame synchronously so canvas is immediately populated
    const initSample = interpolateSampleAtPhase(simResult.samples, phaseRef.current);
    drawChamberCanvas(chamberCanvasRef.current, initSample, simResult, r0Um, paAtm, gasConfig);
    drawCurvesCanvas(curvesCanvasRef.current, simResult, phaseRef.current, paAtm);

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [simResult, r0Um, paAtm, gasConfig]);

  const regimeMeta = useMemo(() => {
    if (simResult.regime === 'subthreshold') {
      return {
        label: '未達空化閾值 (震盪／溶解區)',
        badgeClass: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
        toneClass: 'text-amber-300',
        summary: '膨脹比 R_max/R_0 < 4.5，無法誘發超音速慣性塌縮與電漿發光。',
      };
    }
    if (simResult.regime === 'shape_unstable') {
      return {
        label: '形狀不穩定撕裂風險區 (RT／參數失穩)',
        badgeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
        toneClass: 'text-rose-300',
        summary: '劇烈減速反彈誘發瑞利－泰勒非球形變形，真實氣泡容易破裂解體。',
      };
    }
    return {
      label: '穩定聲致發光島 (Stable SBSL Island)',
      badgeClass: 'border-cyan-400/45 bg-cyan-500/15 text-cyan-200',
      toneClass: 'text-cyan-300',
      summary: '處於擴散平衡與形狀穩定窄島內，可於每個聲學週期穩定重複空化閃光。',
    };
  }, [simResult.regime]);

  const machNumber = Math.abs(simResult.minCollapseVelMs) / gasConfig.soundSpeedGas;

  return (
    <div className="my-8 rounded-2xl border border-slate-800 bg-slate-900/95 p-4 text-slate-100 shadow-xl sm:p-6">
      {/* Header & Play Controls */}
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-cyan-300">
              空化動力學與聲致發光求解器 (26.5 kHz)
            </span>
            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${regimeMeta.badgeClass}`}>
              {regimeMeta.label}
            </span>
          </div>
          <h3 className="mt-1.5 text-base font-bold text-slate-100 sm:text-lg">
            單氣泡聲致發光模擬器：修正瑞利－普萊塞特方程與絕熱極端加熱
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            透過自適應步長四階龍格－庫塔（RK4）求解包含凡得瓦硬核排除體積 h 與聲輻射阻尼的球對稱空化動力學，觀察微米氣泡如何隨駐波聲壓膨脹、撞擊硬核並釋放藍白皮秒閃光。
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPaused((v) => !v)}
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            {isPaused ? '繼續播放' : '暫停'}
          </button>
          <button
            type="button"
            onClick={() => {
              phaseRef.current = 0;
              setIsPaused(false);
            }}
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            重置週期
          </button>
          <button
            type="button"
            onClick={() => setSlowMotionCollapse((v) => !v)}
            className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              slowMotionCollapse
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {slowMotionCollapse ? '塌縮慢動作：開' : '等速播放'}
          </button>
        </div>
      </div>

      {/* Scenario Presets */}
      <div className="mt-3.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyScenario('subthreshold')}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            activeScenario === 'subthreshold'
              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
              : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
          }`}
        >
          未達空化閾值 (1.05 atm)
        </button>
        <button
          type="button"
          onClick={() => applyScenario('stable_sbsl')}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            activeScenario === 'stable_sbsl'
              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
              : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
          }`}
        >
          穩定聲致發光島 (1.35 atm, 4.5 μm)
        </button>
        <button
          type="button"
          onClick={() => applyScenario('unstable_tear')}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            activeScenario === 'unstable_tear'
              ? 'border-rose-400 bg-rose-500/20 text-rose-200'
              : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
          }`}
        >
          形狀不穩定撕裂區 (1.50 atm, 5.8 μm)
        </button>
      </div>

      {/* Dual Visual Panels */}
      <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* Panel 1: Acoustic Chamber Cross-Section & (Pa, R0) Phase Space */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 lg:col-span-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              面板一：共振腔氣泡幾何剖面與 (P<sub>a</sub>, R<sub>0</sub>) 穩定島
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              R(t) = {liveReadout.rUm.toFixed(2)} μm
            </span>
          </div>
          <canvas
            ref={chamberCanvasRef}
            className="block w-full rounded-lg"
            style={{ height: '275px' }}
          />
          <p className="mt-2 text-[11px] leading-snug text-slate-400">
            {regimeMeta.summary}
          </p>
        </div>

        {/* Panel 2: Synchronized Single-Cycle Curves */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 lg:col-span-7">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              面板二：單一聲學週期演化 (R/R<sub>0</sub>、對數溫度 T 與驅動聲壓)
            </span>
            <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-cyan-400" />
                半徑 R(t)/R<sub>0</sub>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-amber-300" />
                核心溫度 log<sub>10</sub>T
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 border-b border-dashed border-violet-400" />
                駐波聲壓 P<sub>a</sub>sin(ωt)
              </span>
            </div>
          </div>
          <canvas
            ref={curvesCanvasRef}
            className="block w-full rounded-lg"
            style={{ height: '275px' }}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>
              相位 φ = {liveReadout.phase.toFixed(2)} · 瞬時核心溫度{' '}
              <span className="font-mono text-amber-300">
                {Math.round(liveReadout.tempK).toLocaleString()} K
              </span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              RK4 自適應步數: {simResult.stepsUsed}
            </span>
          </div>
        </div>
      </div>

      {/* Live Telemetry Cards */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">最大膨脹半徑 R<sub>max</sub></div>
          <div className="mt-1 font-mono text-sm font-bold text-cyan-300 sm:text-base">
            {simResult.rMaxUm.toFixed(1)} μm{' '}
            <span className="text-xs font-normal text-slate-400">
              ({simResult.rMaxRatio.toFixed(1)}× R<sub>0</sub>)
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">最小塌縮半徑 R<sub>min</sub> / h</div>
          <div className="mt-1 font-mono text-sm font-bold text-slate-100 sm:text-base">
            {simResult.rMinUm.toFixed(3)} μm{' '}
            <span className="text-xs font-normal text-slate-400">
              ({(simResult.rMinUm / simResult.hardCoreUm).toFixed(2)}× h)
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">峰值溫度 T<sub>max</sub> / 馬赫數</div>
          <div className={`mt-1 font-mono text-sm font-bold sm:text-base ${simResult.tMaxK >= 9000 ? 'text-amber-300' : 'text-slate-300'}`}>
            {Math.round(simResult.tMaxK).toLocaleString()} K{' '}
            <span className="text-xs font-normal text-slate-400">
              ({machNumber.toFixed(1)} M)
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">皮秒光脈衝狀態</div>
          <div className={`mt-1 font-mono text-sm font-bold sm:text-base ${regimeMeta.toneClass}`}>
            {simResult.estimatedPulsePs !== null
              ? `~${simResult.estimatedPulsePs} ps 閃光`
              : simResult.tMaxK > 3500
              ? '極微弱餘輝'
              : '無電漿發光'}
          </div>
        </div>
      </div>

      {/* Controls: Pa, R0, and Gas Composition */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Slider 1: Acoustic Pressure Pa */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 lg:col-span-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">聲壓振幅 P<sub>a</sub></span>
            <span className="font-mono font-bold text-cyan-300">{paAtm.toFixed(2)} atm</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.55}
            step={0.01}
            value={paAtm}
            onChange={(e) => setPaAtm(parseFloat(e.target.value))}
            aria-label="聲壓振幅 Pa"
            className="mt-2 w-full cursor-pointer accent-cyan-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0.80 溫和震盪</span>
            <span>1.25–1.42 發光島</span>
            <span>1.55 撕裂</span>
          </div>
        </div>

        {/* Slider 2: Equilibrium Radius R0 */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 lg:col-span-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">平衡半徑 R<sub>0</sub></span>
            <span className="font-mono font-bold text-amber-300">
              {r0Um.toFixed(1)} μm (h ≈ {simResult.hardCoreUm.toFixed(2)})
            </span>
          </div>
          <input
            type="range"
            min={2.5}
            max={7.5}
            step={0.1}
            value={r0Um}
            onChange={(e) => setR0Um(parseFloat(e.target.value))}
            aria-label="平衡半徑 R0"
            className="mt-2 w-full cursor-pointer accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>2.5 μm 易溶</span>
            <span>4.5 μm 典型</span>
            <span>7.5 μm 易失穩</span>
          </div>
        </div>

        {/* Gas Composition Selector */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 lg:col-span-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">核心氣體組成切換</span>
            <span className="font-mono text-[11px] text-slate-400">
              γ = {gasConfig.gamma.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1.5">
            {(['argon_air', 'helium', 'nitrogen'] as const).map((id) => {
              const cfg = GAS_CONFIGS[id];
              const active = gasId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setGasId(id)}
                  className={`cursor-pointer rounded-md border px-2.5 py-1 text-left text-[11px] font-medium transition ${
                    active
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gas Physics Note + Explicit Model Boundary Disclaimer */}
      <div className="mt-3.5 space-y-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-400">
        <div>
          <span className="font-semibold text-cyan-300">當前氣體物理特性（{gasConfig.shortLabel}）：</span>
          {gasConfig.chemLossNote}（峰值氣體壓力約 {Math.round(simResult.pMaxAtm).toLocaleString()} atm）。
        </div>
        <div>
          <span className="font-semibold text-slate-300">模型邊界說明：</span>
          基於球對稱修正瑞利－普萊塞特方程式與多方絕熱近似之教學數值求解器，未包含非球形瑞利－泰勒變形與完整多組分電漿輻射傳輸求解。
        </div>
      </div>
    </div>
  );
};

/**
 * Panel 1: Acoustic cavity cross-section + (Pa, R0) stable island inset
 */
function drawChamberCanvas(
  canvas: HTMLCanvasElement | null,
  sample: TrajectorySample,
  res: SimulationResult,
  r0Um: number,
  paAtm: number,
  gas: GasConfig
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { w, h, dpr } = getDprCanvasSize(canvas, 360, 275);
  ctx.save();
  ctx.scale(dpr, dpr);

  // Resonant water flask background tinted subtly by instantaneous acoustic pressure
  const driveNorm = Math.max(-1, Math.min(1, sample.pDriveAtm / Math.max(0.5, paAtm)));
  const bgBlue = Math.round(28 + driveNorm * 12);
  ctx.fillStyle = `rgb(4, 10, ${bgBlue})`;
  ctx.fillRect(0, 0, w, h);

  // Subtle standing-wave vertical pressure nodes/antinode bands
  const centerX = w * 0.48;
  const centerY = h * 0.54;

  const radialEnv = ctx.createRadialGradient(centerX, centerY, 8, centerX, centerY, w * 0.65);
  const antinodeAlpha = 0.08 + 0.07 * Math.abs(driveNorm);
  radialEnv.addColorStop(
    0,
    driveNorm >= 0
      ? `rgba(56, 189, 248, ${antinodeAlpha.toFixed(3)})`
      : `rgba(139, 92, 246, ${antinodeAlpha.toFixed(3)})`
  );
  radialEnv.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = radialEnv;
  ctx.fillRect(0, 0, w, h);

  // Scale radius visually so Rmax (~50-65 um) fits cleanly inside the chamber view
  const maxVisualR = Math.min(w * 0.36, h * 0.37);
  const scaleUm = maxVisualR / Math.max(42, res.rMaxUm * 1.08);
  const visualR = Math.max(4.2, sample.rUm * scaleUm);
  const visualR0 = Math.max(3.5, r0Um * scaleUm);
  const visualRmax = Math.max(5, res.rMaxUm * scaleUm);
  const visualCoreH = Math.max(2.0, res.hardCoreUm * scaleUm);

  // Outgoing spherical acoustic / shock wave ring right after collapse
  const postCollapse = sample.phase - res.collapsePhase;
  const wrappedPost = postCollapse >= 0 ? postCollapse : postCollapse + 1;
  if (res.rMaxRatio > 4.0 && wrappedPost < 0.28) {
    const shockProgress = wrappedPost / 0.28;
    const shockR = visualCoreH + shockProgress * (maxVisualR * 1.45);
    const shockAlpha = (1 - shockProgress) * (res.regime === 'subthreshold' ? 0.25 : 0.72);
    ctx.strokeStyle = `rgba(125, 211, 252, ${shockAlpha.toFixed(3)})`;
    ctx.lineWidth = 2.2 - shockProgress * 1.4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, shockR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Ghost outline of maximum expanded radius Rmax
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, visualRmax, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Equilibrium radius R0 reference circle
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, visualR0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Dynamic bubble shape (spherical unless in Rayleigh-Taylor shape-unstable regime near collapse/rebound)
  const rtWobble =
    res.regime === 'shape_unstable' && sample.rUm < res.rMaxUm * 0.45
      ? 0.14 * Math.sin(sample.phase * 140)
      : 0;

  // Bubble interior gradient (turns hot blue-white / amber when T rises)
  const tempNorm = Math.max(0, Math.min(1, (sample.tempK - 1200) / 14000));
  const bubbleGrad = ctx.createRadialGradient(
    centerX - visualR * 0.22,
    centerY - visualR * 0.22,
    Math.max(1, visualR * 0.08),
    centerX,
    centerY,
    visualR
  );

  if (tempNorm > 0.25) {
    bubbleGrad.addColorStop(0, '#ffffff');
    bubbleGrad.addColorStop(0.45, gas.id === 'nitrogen' ? '#fde68a' : '#bae6fd');
    bubbleGrad.addColorStop(1, gas.id === 'nitrogen' ? 'rgba(245, 158, 11, 0.45)' : 'rgba(56, 189, 248, 0.45)');
  } else {
    bubbleGrad.addColorStop(0, 'rgba(224, 242, 254, 0.45)');
    bubbleGrad.addColorStop(0.65, 'rgba(56, 189, 248, 0.22)');
    bubbleGrad.addColorStop(1, 'rgba(14, 116, 144, 0.35)');
  }

  ctx.fillStyle = bubbleGrad;
  ctx.strokeStyle =
    res.regime === 'shape_unstable' ? '#fb7185' : tempNorm > 0.25 ? '#e0f2fe' : '#38bdf8';
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  const lobes = 7;
  const pts = 72;
  for (let i = 0; i <= pts; i++) {
    const theta = (i / pts) * Math.PI * 2;
    const rMod = visualR * (1 + rtWobble * Math.cos(lobes * theta));
    const px = centerX + rMod * Math.cos(theta);
    const py = centerY + rMod * Math.sin(theta);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Van der Waals hard-core limit circle h
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.72)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, visualCoreH, 0, Math.PI * 2);
  ctx.stroke();

  // Picosecond blue-white bremsstrahlung / recombination flash glow right at collapse
  const collapseWindow = Math.min(
    Math.abs(sample.phase - res.collapsePhase),
    1 - Math.abs(sample.phase - res.collapsePhase)
  );
  if (res.flashStrength > 0.08 && collapseWindow < 0.045) {
    const pulse = (1 - collapseWindow / 0.045) * res.flashStrength;
    const flashRadius = 18 + pulse * 58;
    const flashGrad = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, flashRadius);
    const coreColor = gas.id === 'nitrogen' ? '254, 240, 138' : '224, 242, 254';
    const haloColor = gas.id === 'nitrogen' ? '245, 158, 11' : '56, 189, 248';
    flashGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.98, pulse * 1.1).toFixed(3)})`);
    flashGrad.addColorStop(0.28, `rgba(${coreColor}, ${(pulse * 0.8).toFixed(3)})`);
    flashGrad.addColorStop(0.65, `rgba(${haloColor}, ${(pulse * 0.35).toFixed(3)})`);
    flashGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = flashGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, flashRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Labels for Rmax, R0, and hard core h
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText(`R_max ${res.rMaxUm.toFixed(1)} μm`, 10, 18);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`R₀ ${r0Um.toFixed(1)} μm`, 10, 32);
  ctx.fillStyle = '#fca5a5';
  ctx.fillText(`硬核 h=${res.hardCoreUm.toFixed(2)} μm`, 10, 46);

  // Acoustic pressure indicator at bottom-left
  ctx.fillStyle = driveNorm < 0 ? '#c4b5fd' : '#7dd3fc';
  ctx.font = '10px sans-serif';
  ctx.fillText(
    driveNorm < -0.05 ? '聲場負壓膨脹期' : driveNorm > 0.05 ? '聲場正壓壓縮期' : '零壓過渡',
    10,
    h - 10
  );

  // Compact (Pa, R0) Stability Island Mini-Map in top-right corner
  drawPhaseIslandInset(ctx, w - 108, 10, 98, 76, paAtm, r0Um);

  ctx.restore();
}

function drawPhaseIslandInset(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  boxW: number,
  boxH: number,
  paAtm: number,
  r0Um: number
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.9)';
  ctx.lineWidth = 1;
  ctx.fillRect(x0, y0, boxW, boxH);
  ctx.strokeRect(x0, y0, boxW, boxH);

  const padL = 14;
  const padR = 6;
  const padT = 14;
  const padB = 12;
  const pw = boxW - padL - padR;
  const ph = boxH - padT - padB;

  const mapR0 = (r: number) => x0 + padL + ((r - 2.5) / 5.0) * pw;
  const mapPa = (p: number) => y0 + padT + ((1.55 - p) / 0.75) * ph;

  // Draw stable SBSL island polygon in (R0, Pa)
  ctx.fillStyle = 'rgba(34, 211, 238, 0.24)';
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const poly: [number, number][] = [
    [2.9, 1.24],
    [3.5, 1.20],
    [5.8, 1.19],
    [6.1, 1.26],
    [5.9, 1.37],
    [4.0, 1.445],
    [2.9, 1.46],
  ];
  poly.forEach(([r, p], idx) => {
    const px = mapR0(r);
    const py = mapPa(p);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Current operating point
  const curX = mapR0(r0Um);
  const curY = mapPa(paAtm);
  ctx.fillStyle = '#fbbf24';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(curX, curY, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '8.5px sans-serif';
  ctx.fillText('(R₀, Pₐ) 穩定島', x0 + 6, y0 + 10);
  ctx.fillStyle = '#64748b';
  ctx.font = '8px ui-monospace, monospace';
  ctx.fillText('R₀', x0 + boxW - 14, y0 + boxH - 3);
  ctx.fillText('Pₐ', x0 + 2, y0 + 24);

  ctx.restore();
}

/**
 * Panel 2: Synchronized single-cycle time-series curves: R(t)/R0, log10(T), and Pa sin(omega t)
 */
function drawCurvesCanvas(
  canvas: HTMLCanvasElement | null,
  res: SimulationResult,
  currentPhase: number,
  paAtm: number
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { w, h, dpr } = getDprCanvasSize(canvas, 500, 275);
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);

  const padL = 36;
  const padR = 38;
  const padT = 18;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const rPlotTop = padT;
  const rPlotH = plotH * 0.72;
  const driveTop = padT + rPlotH + 10;
  const driveH = plotH - rPlotH - 10;

  const rMaxScale = Math.max(10, Math.ceil(res.rMaxRatio * 1.1));
  const mapX = (phase: number) => padL + phase * plotW;
  const mapR = (rNorm: number) =>
    rPlotTop + (1 - Math.min(rMaxScale, Math.max(0, rNorm)) / rMaxScale) * rPlotH;

  // Log10(T) axis: [log10(250), log10(35000)]
  const logTMin = Math.log10(250);
  const logTMax = Math.log10(35000);
  const mapLogT = (tempK: number) => {
    const lt = Math.log10(Math.max(250, Math.min(35000, tempK)));
    return rPlotTop + (1 - (lt - logTMin) / (logTMax - logTMin)) * rPlotH;
  };

  // Grid lines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
    const y = rPlotTop + frac * rPlotH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
  }

  // Left axis labels (R / R0)
  ctx.fillStyle = '#67e8f9';
  ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText(`${rMaxScale}×`, 4, rPlotTop + 8);
  ctx.fillText(`${Math.round(rMaxScale * 0.5)}×`, 4, rPlotTop + rPlotH * 0.5 + 3);
  ctx.fillText('1×', 10, mapR(1) + 3);

  // Right axis labels (T in K, log scale)
  ctx.fillStyle = '#fcd34d';
  ctx.fillText('30kK', padL + plotW + 4, mapLogT(30000) + 3);
  ctx.fillText('10kK', padL + plotW + 4, mapLogT(10000) + 3);
  ctx.fillText('1kK', padL + plotW + 4, mapLogT(1000) + 3);

  const samples = res.samples;
  if (samples.length > 1) {
    // 1. Core temperature log10(T) curve
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.88)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const px = mapX(samples[i].phase);
      const py = mapLogT(samples[i].tempK);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 2. Normalized bubble radius R(t)/R0 curve (with afterbounces!)
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const px = mapX(samples[i].phase);
      const py = mapR(samples[i].rNorm);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 3. Acoustic driving pressure wave Pa sin(omega t) in bottom band
    const driveMidY = driveTop + driveH * 0.5;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, driveMidY);
    ctx.lineTo(padL + plotW, driveMidY);
    ctx.stroke();

    const pScale = Math.max(1.6, paAtm);
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.85)';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const px = mapX(samples[i].phase);
      const py = driveMidY - (samples[i].pDriveAtm / pScale) * (driveH * 0.45);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Highlight collapse peak marker
  const peakX = mapX(res.collapsePhase);
  if (res.tMaxK > 4500) {
    ctx.fillStyle = 'rgba(254, 240, 138, 0.9)';
    ctx.beginPath();
    ctx.arc(peakX, mapLogT(res.tMaxK), 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Synchronized playhead line
  const curX = mapX(currentPhase);
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(curX, rPlotTop);
  ctx.lineTo(curX, driveTop + driveH);
  ctx.stroke();

  // X-axis time ticks (in microseconds over one 26.5 kHz acoustic period)
  const tacUs = T_AC * 1e6;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
  for (const frac of [0, 0.25, 0.5, 0.75, 1.0]) {
    const tx = mapX(frac);
    const label = `${(frac * tacUs).toFixed(1)} μs`;
    ctx.fillText(label, Math.min(padL + plotW - 32, Math.max(padL, tx - 14)), h - 7);
  }
  ctx.fillStyle = '#a78bfa';
  ctx.font = '9.5px sans-serif';
  ctx.fillText('P_ac', 6, driveTop + driveH * 0.5 + 3);

  ctx.restore();
}
