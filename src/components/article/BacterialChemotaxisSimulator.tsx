import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

type StrategyMode = 'chemotaxis' | 'unbiased' | 'no_adaptation';
type FieldTopology = 'single' | 'multi' | 'moving';
type PresetKey = 'standard' | 'high_bg' | 'high_dr' | 'custom';

interface AttractantSource {
  x: number;
  y: number;
  amp: number;
  sigma: number;
}

interface TrailPoint {
  x: number;
  y: number;
  isTumble: boolean;
}

interface BacteriumState {
  id: number;
  mode: StrategyMode;
  x: number;
  y: number;
  theta: number;
  isTumbling: boolean;
  tumbleRemaining: number;
  runDuration: number;
  methylation: number;
  activity: number;
  lastConc: number;
  lastLogConc: number;
  lastConv: number;
  lastTumbleRate: number;
  concHistory: Float64Array;
  histHead: number;
  trail: TrailPoint[];
}

interface SimTelemetry {
  simTime: number;
  focalConc: number;
  focalConv: number;
  focalTumbleRate: number;
  focalActivity: number;
  focalMethylation: number;
  focalRunDuration: number;
  meanDistChemo: number;
  meanDistUnbiased: number;
  meanDistNoAdapt: number;
}

const ARENA_W = 400; // um
const ARENA_H = 290; // um
const SWIM_SPEED = 24.0; // um/s (typical E. coli ~20-30 um/s)
const DT = 0.05; // s per simulation step
const BASELINE_TUMBLE_RATE = 1.0; // 1/s (~1 s mean run)
const TUMBLE_DURATION = 0.12; // s (~0.1 s mean tumble)
const CELLS_PER_GROUP = 6; // 3 groups * 6 = 18 bacteria total
const MAX_HISTORY_STEPS = 240; // covers up to 12 s at DT=0.05
const SERIES_LEN = 180; // points for Panel 2 traces

// Receptor MWC / Barkai-Leibler effective dissociation constants (dimensionless C units)
const K_OFF = 0.25;
const K_ON = 25000.0;
const TARGET_ACTIVITY = 0.35; // steady-state kinase activity A* = k_R[R] / (k_B[B_p])
const NO_ADAPT_KD = 1.4;

const MODE_META: Record<
  StrategyMode,
  {
    label: string;
    shortLabel: string;
    color: string;
    trailColor: string;
    badgeClass: string;
  }
> = {
  chemotaxis: {
    label: 'Chemotaxis Biased Walk',
    shortLabel: '時間記憶＋精確適應',
    color: '#22d3ee',
    trailColor: 'rgba(34, 211, 238, 0.78)',
    badgeClass: 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200',
  },
  unbiased: {
    label: 'Unbiased Walk',
    shortLabel: '無記憶純隨機擴散',
    color: '#fbbf24',
    trailColor: 'rgba(251, 191, 36, 0.72)',
    badgeClass: 'border-amber-400/70 bg-amber-500/20 text-amber-200',
  },
  no_adaptation: {
    label: 'No Adaptation — Saturated!',
    shortLabel: '關閉適應（高濃度飽和）',
    color: '#fb7185',
    trailColor: 'rgba(251, 113, 133, 0.75)',
    badgeClass: 'border-rose-400/70 bg-rose-500/20 text-rose-200',
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

function gaussianRng(rng: () => number): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Segall-Block-Berg (1986) zero-integral biphasic impulse response kernel:
 * K(tau) ~ (u - 0.5*u^2) * exp(-u), u = tau / tau_0.
 * Positive fast lobe (0 < u < 2), negative slow lobe (u > 2), integral = 0.
 */
function buildBiphasicKernel(memoryScale: number): Float64Array {
  const tau0 = 0.55 * memoryScale;
  const windowSec = Math.min(11.5, Math.max(1.8, 5.2 * memoryScale));
  const len = Math.max(16, Math.min(MAX_HISTORY_STEPS, Math.round(windowSec / DT)));
  const kernel = new Float64Array(len);

  let sum = 0;
  for (let i = 0; i < len; i++) {
    const tau = (i + 0.5) * DT;
    const u = tau / tau0;
    const val = (u - 0.5 * u * u) * Math.exp(-u);
    kernel[i] = val;
    sum += val;
  }

  // Remove discrete truncation residual so integral K(tau) dtau == 0 exactly
  const meanOffset = sum / len;
  let absArea = 0;
  for (let i = 0; i < len; i++) {
    kernel[i] -= meanOffset;
    absArea += Math.abs(kernel[i]) * DT;
  }

  // Normalize amplitude by L1 norm scaled with 1/tau0 so slope sensitivity stays physically consistent
  const norm = absArea > 1e-8 ? 1.0 / (absArea * 0.55) : 1.0;
  for (let i = 0; i < len; i++) {
    kernel[i] *= norm;
  }

  return kernel;
}

function getSourcesAtTime(
  topology: FieldTopology,
  simTime: number,
  customPrimary: { x: number; y: number }
): AttractantSource[] {
  if (topology === 'single') {
    return [{ x: customPrimary.x, y: customPrimary.y, amp: 5.2, sigma: 66 }];
  }
  if (topology === 'multi') {
    return [
      { x: customPrimary.x, y: customPrimary.y, amp: 5.2, sigma: 56 },
      { x: 112, y: 196, amp: 3.1, sigma: 48 },
    ];
  }
  // Moving source smoothly orbits the right-center region
  const cx = ARENA_W * 0.54 + Math.cos(simTime * 0.28) * 98;
  const cy = ARENA_H * 0.5 + Math.sin(simTime * 0.42) * 72;
  return [{ x: cx, y: cy, amp: 5.2, sigma: 62 }];
}

function evaluateConcentration(
  x: number,
  y: number,
  sources: AttractantSource[],
  bgMultiplier: number
): number {
  let profile = 1.0;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const dx = x - s.x;
    const dy = y - s.y;
    profile += s.amp * Math.exp(-(dx * dx + dy * dy) / (2 * s.sigma * s.sigma));
  }
  return bgMultiplier * profile;
}

function nearestSourceDistance(x: number, y: number, sources: AttractantSource[]): number {
  let minD = Infinity;
  for (let i = 0; i < sources.length; i++) {
    const dx = x - sources[i].x;
    const dy = y - sources[i].y;
    const d = Math.hypot(dx, dy);
    if (d < minD) minD = d;
  }
  return minD;
}

function computeReceptorLogSignal(conc: number): number {
  return Math.log((1 + conc / K_OFF) / (1 + conc / K_ON));
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

function createInitialCells(
  bgMultiplier: number,
  sources: AttractantSource[],
  rng: () => number
): BacteriumState[] {
  const modes: StrategyMode[] = ['chemotaxis', 'unbiased', 'no_adaptation'];
  const cells: BacteriumState[] = [];
  let idCounter = 0;

  for (const mode of modes) {
    for (let j = 0; j < CELLS_PER_GROUP; j++) {
      // Spawn all groups evenly on the left side away from initial food peak
      const x = 32 + ((j % 3) * 26) + (rng() - 0.5) * 14;
      const y = 38 + ((j / 6) * (ARENA_H - 76)) + (rng() - 0.5) * 18;
      const theta = (rng() - 0.5) * Math.PI * 2;
      const conc = evaluateConcentration(x, y, sources, bgMultiplier);
      const logSig = computeReceptorLogSignal(conc);
      const adaptedOffset = Math.log((1 - TARGET_ACTIVITY) / TARGET_ACTIVITY);
      const initMeth =
        mode === 'no_adaptation'
          ? computeReceptorLogSignal(1.2) - adaptedOffset
          : logSig - adaptedOffset;

      const concHistory = new Float64Array(MAX_HISTORY_STEPS);
      const initStored =
        mode === 'no_adaptation' ? conc / (conc + NO_ADAPT_KD) : logSig;
      concHistory.fill(initStored);

      cells.push({
        id: idCounter++,
        mode,
        x,
        y,
        theta,
        isTumbling: false,
        tumbleRemaining: 0,
        runDuration: 0,
        methylation: initMeth,
        activity:
          mode === 'no_adaptation'
            ? 1 / (1 + conc / NO_ADAPT_KD)
            : TARGET_ACTIVITY,
        lastConc: conc,
        lastLogConc: logSig,
        lastConv: 0,
        lastTumbleRate: BASELINE_TUMBLE_RATE,
        concHistory,
        histHead: 0,
        trail: [{ x, y, isTumble: false }],
      });
    }
  }
  return cells;
}

export const BacterialChemotaxisSimulator: React.FC = () => {
  const [rotationalDr, setRotationalDr] = useState<number>(0.15);
  const [bgExponent, setBgExponent] = useState<number>(0); // 10^0 = 1x .. 10^3 = 1000x
  const [memoryScale, setMemoryScale] = useState<number>(1.0);
  const [topology, setTopology] = useState<FieldTopology>('single');
  const [focalMode, setFocalMode] = useState<StrategyMode>('chemotaxis');
  const [showAllTrails, setShowAllTrails] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const bgMultiplier = useMemo(() => Math.round(Math.pow(10, bgExponent)), [bgExponent]);

  const activePreset: PresetKey = useMemo(() => {
    if (
      Math.abs(rotationalDr - 0.15) < 0.02 &&
      bgExponent < 0.1 &&
      Math.abs(memoryScale - 1.0) < 0.05
    ) {
      return 'standard';
    }
    if (
      Math.abs(rotationalDr - 0.15) < 0.02 &&
      bgExponent > 2.8 &&
      Math.abs(memoryScale - 1.0) < 0.05
    ) {
      return 'high_bg';
    }
    if (
      Math.abs(rotationalDr - 0.65) < 0.03 &&
      bgExponent < 0.1 &&
      Math.abs(memoryScale - 1.0) < 0.05
    ) {
      return 'high_dr';
    }
    return 'custom';
  }, [rotationalDr, bgExponent, memoryScale]);

  const [telemetry, setTelemetry] = useState<SimTelemetry>({
    simTime: 0,
    focalConc: 1.0,
    focalConv: 0,
    focalTumbleRate: 1.0,
    focalActivity: TARGET_ACTIVITY,
    focalMethylation: 0.9,
    focalRunDuration: 0,
    meanDistChemo: 230,
    meanDistUnbiased: 230,
    meanDistNoAdapt: 230,
  });

  const arenaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const distCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const simRef = useRef<{
    simTime: number;
    cells: BacteriumState[];
    customPrimary: { x: number; y: number };
    rng: () => number;
    focalConcTrace: number[];
    focalConvTrace: number[];
    focalRateTrace: number[];
    distChemoTrace: number[];
    distUnbiasedTrace: number[];
    distNoAdaptTrace: number[];
    traceTime: number[];
  }>({
    simTime: 0,
    cells: [],
    customPrimary: { x: 295, y: 145 },
    rng: mulberry32(20261118),
    focalConcTrace: [],
    focalConvTrace: [],
    focalRateTrace: [],
    distChemoTrace: [],
    distUnbiasedTrace: [],
    distNoAdaptTrace: [],
    traceTime: [],
  });

  const paramsRef = useRef({
    rotationalDr,
    bgMultiplier,
    memoryScale,
    topology,
    focalMode,
    showAllTrails,
    isPaused,
  });

  useEffect(() => {
    paramsRef.current = {
      rotationalDr,
      bgMultiplier,
      memoryScale,
      topology,
      focalMode,
      showAllTrails,
      isPaused,
    };
  }, [rotationalDr, bgMultiplier, memoryScale, topology, focalMode, showAllTrails, isPaused]);

  const resetSimulation = useCallback(
    (newTopology?: FieldTopology, newBgMult?: number) => {
      const s = simRef.current;
      const topo = newTopology ?? paramsRef.current.topology;
      const bg = newBgMult ?? paramsRef.current.bgMultiplier;
      s.simTime = 0;
      s.rng = mulberry32(20261118 + bg + (topo === 'multi' ? 37 : topo === 'moving' ? 91 : 0));
      const sources = getSourcesAtTime(topo, 0, s.customPrimary);
      s.cells = createInitialCells(bg, sources, s.rng);
      s.focalConcTrace = [];
      s.focalConvTrace = [];
      s.focalRateTrace = [];
      s.distChemoTrace = [];
      s.distUnbiasedTrace = [];
      s.distNoAdaptTrace = [];
      s.traceTime = [];

      const focal =
        s.cells.find((c) => c.mode === paramsRef.current.focalMode) ?? s.cells[0];
      const d0 = nearestSourceDistance(focal.x, focal.y, sources);
      setTelemetry({
        simTime: 0,
        focalConc: focal.lastConc,
        focalConv: 0,
        focalTumbleRate: focal.lastTumbleRate,
        focalActivity: focal.activity,
        focalMethylation: focal.methylation,
        focalRunDuration: 0,
        meanDistChemo: d0,
        meanDistUnbiased: d0,
        meanDistNoAdapt: d0,
      });
    },
    []
  );

  // Initialize once on mount
  useEffect(() => {
    if (simRef.current.cells.length === 0) {
      resetSimulation('single', 1);
    }
  }, [resetSimulation]);

  // Main animation & stochastic integration loop
  useEffect(() => {
    let rafId = 0;
    let frameCount = 0;
    let cachedMemScale = -1;
    let cachedKernel = buildBiphasicKernel(paramsRef.current.memoryScale);

    const stepSimulation = () => {
      const p = paramsRef.current;
      const s = simRef.current;
      if (s.cells.length === 0) return;

      if (Math.abs(p.memoryScale - cachedMemScale) > 1e-4) {
        cachedMemScale = p.memoryScale;
        cachedKernel = buildBiphasicKernel(p.memoryScale);
      }
      const kernel = cachedKernel;
      const kLen = kernel.length;

      s.simTime += DT;
      const sources = getSourcesAtTime(p.topology, s.simTime, s.customPrimary);

      let sumChemo = 0;
      let sumUnbiased = 0;
      let sumNoAdapt = 0;
      let cntChemo = 0;
      let cntUnbiased = 0;
      let cntNoAdapt = 0;

      for (let idx = 0; idx < s.cells.length; idx++) {
        const cell = s.cells[idx];
        const trueConc = evaluateConcentration(cell.x, cell.y, sources, p.bgMultiplier);

        // Berg-Purcell (1977) Poisson counting fluctuation: delta_c / c ~ (D*a*c*T)^(-1/2)
        // More prominent when concentration is low (1x) and averaging window is ultra-short
        const bpNoiseSigma =
          0.032 / Math.sqrt(Math.max(0.25, trueConc) * Math.max(0.3, p.memoryScale));
        const noisyConc = Math.max(
          0.05,
          trueConc * (1 + bpNoiseSigma * gaussianRng(s.rng))
        );

        const logSig = computeReceptorLogSignal(noisyConc);
        cell.lastConc = trueConc;
        cell.lastLogConc = logSig;

        // Record signal into circular history buffer
        cell.histHead = (cell.histHead + 1) % MAX_HISTORY_STEPS;
        if (cell.mode === 'no_adaptation') {
          // Non-adapting static receptor occupancy saturates as C >> NO_ADAPT_KD
          cell.concHistory[cell.histHead] = noisyConc / (noisyConc + NO_ADAPT_KD);
        } else {
          cell.concHistory[cell.histHead] = logSig;
        }

        // Compute Segall-Block-Berg biphasic kernel convolution y(t) = int K(tau) * s(t-tau) dtau
        let conv = 0;
        for (let k = 0; k < kLen; k++) {
          const histIdx =
            (cell.histHead - k + MAX_HISTORY_STEPS) % MAX_HISTORY_STEPS;
          conv += kernel[k] * cell.concHistory[histIdx] * DT;
        }
        cell.lastConv = conv;

        // Update Barkai-Leibler (1997) Integral Feedback Methylation & Activity
        if (cell.mode === 'chemotaxis') {
          // Instantaneous receptor activity driven by log ligand vs methylation state + fast response
          const freeEnergy = logSig - cell.methylation - 3.6 * conv;
          const act = 1 / (1 + Math.exp(Math.max(-18, Math.min(18, freeEnergy))));
          cell.activity = act;
          // Integral feedback: dm/dt = (A* - A) / tau_adapt
          const tauAdapt = 2.6 * p.memoryScale;
          cell.methylation += ((TARGET_ACTIVITY - act) / tauAdapt) * DT;
          cell.methylation = Math.max(-2, Math.min(14, cell.methylation));

          // Berg & Brown (1972) asymmetric tumble modulation:
          // Ascending gradient (conv > 0) strongly suppresses tumbling; descending stays near baseline
          if (conv > 0) {
            cell.lastTumbleRate = Math.max(
              0.06,
              BASELINE_TUMBLE_RATE * Math.exp(-9.5 * conv)
            );
          } else {
            cell.lastTumbleRate =
              BASELINE_TUMBLE_RATE * (1.0 + 0.35 * Math.tanh(-6.5 * conv));
          }
        } else if (cell.mode === 'unbiased') {
          cell.activity = TARGET_ACTIVITY;
          cell.lastConv = 0;
          cell.lastTumbleRate = BASELINE_TUMBLE_RATE;
        } else {
          // No Adaptation (CheB/CheR disabled): kinase activity drops and saturates near 0 at high C
          const staticAct = 1 / (1 + noisyConc / NO_ADAPT_KD);
          cell.activity = staticAct;
          // Without adaptation, receptor saturates -> gradient response collapses and smooth-swimming locks up
          cell.lastTumbleRate = Math.max(0.08, BASELINE_TUMBLE_RATE * 1.9 * staticAct);
        }

        // Run-and-Tumble Poisson state transition + Rotational Brownian Diffusion
        let tumbledThisStep = false;
        if (cell.isTumbling) {
          cell.tumbleRemaining -= DT;
          cell.theta += (s.rng() - 0.5) * 1.4;
          if (cell.tumbleRemaining <= 0) {
            cell.isTumbling = false;
            cell.runDuration = 0;
            // Random reorientation with slight forward persistence (~68 deg mean turn in E. coli, approximated broadly)
            cell.theta += (s.rng() - 0.5) * Math.PI * 1.75;
          }
        } else {
          // Rotational Brownian diffusion: dtheta = sqrt(2 * Dr * dt) * N(0, 1)
          cell.theta += Math.sqrt(2 * p.rotationalDr * DT) * gaussianRng(s.rng);
          cell.x += SWIM_SPEED * Math.cos(cell.theta) * DT;
          cell.y += SWIM_SPEED * Math.sin(cell.theta) * DT;
          cell.runDuration += DT;

          // Reflective boundaries with slight wall deflection
          const margin = 8;
          if (cell.x < margin) {
            cell.x = margin;
            cell.theta = Math.atan2(Math.sin(cell.theta), Math.abs(Math.cos(cell.theta)));
          } else if (cell.x > ARENA_W - margin) {
            cell.x = ARENA_W - margin;
            cell.theta = Math.atan2(Math.sin(cell.theta), -Math.abs(Math.cos(cell.theta)));
          }
          if (cell.y < margin) {
            cell.y = margin;
            cell.theta = Math.atan2(Math.abs(Math.sin(cell.theta)), Math.cos(cell.theta));
          } else if (cell.y > ARENA_H - margin) {
            cell.y = ARENA_H - margin;
            cell.theta = Math.atan2(-Math.abs(Math.sin(cell.theta)), Math.cos(cell.theta));
          }

          // Poisson tumble trigger
          const pTumble = 1 - Math.exp(-cell.lastTumbleRate * DT);
          if (s.rng() < pTumble) {
            cell.isTumbling = true;
            cell.tumbleRemaining = TUMBLE_DURATION;
            tumbledThisStep = true;
          }
        }

        cell.trail.push({ x: cell.x, y: cell.y, isTumble: tumbledThisStep });
        if (cell.trail.length > 260) {
          cell.trail.shift();
        }

        const d = nearestSourceDistance(cell.x, cell.y, sources);
        if (cell.mode === 'chemotaxis') {
          sumChemo += d;
          cntChemo++;
        } else if (cell.mode === 'unbiased') {
          sumUnbiased += d;
          cntUnbiased++;
        } else {
          sumNoAdapt += d;
          cntNoAdapt++;
        }
      }

      const meanChemo = cntChemo > 0 ? sumChemo / cntChemo : 0;
      const meanUnbiased = cntUnbiased > 0 ? sumUnbiased / cntUnbiased : 0;
      const meanNoAdapt = cntNoAdapt > 0 ? sumNoAdapt / cntNoAdapt : 0;

      const focalCell = s.cells.find((c) => c.mode === p.focalMode) ?? s.cells[0];

      // Sample traces every 2 steps (0.1 s) for crisp temporal display
      if (Math.round(s.simTime / DT) % 2 === 0) {
        s.focalConcTrace.push(focalCell.lastLogConc);
        s.focalConvTrace.push(focalCell.lastConv);
        s.focalRateTrace.push(focalCell.lastTumbleRate);
        s.distChemoTrace.push(meanChemo);
        s.distUnbiasedTrace.push(meanUnbiased);
        s.distNoAdaptTrace.push(meanNoAdapt);
        s.traceTime.push(s.simTime);

        if (s.traceTime.length > SERIES_LEN) {
          s.focalConcTrace.shift();
          s.focalConvTrace.shift();
          s.focalRateTrace.shift();
          s.distChemoTrace.shift();
          s.distUnbiasedTrace.shift();
          s.distNoAdaptTrace.shift();
          s.traceTime.shift();
        }
      }

      return {
        focalCell,
        meanChemo,
        meanUnbiased,
        meanNoAdapt,
        sources,
        kernel,
      };
    };

    const tick = () => {
      const p = paramsRef.current;
      const s = simRef.current;
      let latestStats: ReturnType<typeof stepSimulation> = undefined;

      if (!p.isPaused) {
        // Advance 1 step per frame (~3x/2x comfortable viewing speed)
        latestStats = stepSimulation();
      }

      const sources =
        latestStats?.sources ??
        getSourcesAtTime(p.topology, s.simTime, s.customPrimary);
      const kernel = latestStats?.kernel ?? cachedKernel;
      const focalCell =
        latestStats?.focalCell ??
        s.cells.find((c) => c.mode === p.focalMode) ??
        s.cells[0];

      drawArenaCanvas(
        arenaCanvasRef.current,
        s.cells,
        sources,
        focalCell,
        p.bgMultiplier,
        p.showAllTrails
      );
      drawSignalCanvas(
        signalCanvasRef.current,
        s.focalConcTrace,
        s.focalConvTrace,
        s.focalRateTrace,
        kernel,
        p.focalMode
      );
      drawDistanceCanvas(
        distCanvasRef.current,
        s.distChemoTrace,
        s.distUnbiasedTrace,
        s.distNoAdaptTrace,
        s.traceTime
      );

      frameCount++;
      if (!p.isPaused && frameCount % 8 === 0 && focalCell && latestStats) {
        setTelemetry({
          simTime: s.simTime,
          focalConc: focalCell.lastConc,
          focalConv: focalCell.lastConv,
          focalTumbleRate: focalCell.lastTumbleRate,
          focalActivity: focalCell.activity,
          focalMethylation: focalCell.methylation,
          focalRunDuration: focalCell.runDuration,
          meanDistChemo: latestStats.meanChemo,
          meanDistUnbiased: latestStats.meanUnbiased,
          meanDistNoAdapt: latestStats.meanNoAdapt,
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleArenaClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = arenaCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * ARENA_W;
    const ny = ((e.clientY - rect.top) / rect.height) * ARENA_H;
    simRef.current.customPrimary = {
      x: Math.max(40, Math.min(ARENA_W - 40, nx)),
      y: Math.max(40, Math.min(ARENA_H - 40, ny)),
    };
    if (topology === 'moving') {
      setTopology('single');
    }
  };

  const applyPreset = (key: Exclude<PresetKey, 'custom'>) => {
    if (key === 'standard') {
      setRotationalDr(0.15);
      setBgExponent(0);
      setMemoryScale(1.0);
      setIsPaused(false);
      resetSimulation(topology, 1);
    } else if (key === 'high_bg') {
      setRotationalDr(0.15);
      setBgExponent(3);
      setMemoryScale(1.0);
      setIsPaused(false);
      resetSimulation(topology, 1000);
    } else {
      setRotationalDr(0.65);
      setBgExponent(0);
      setMemoryScale(1.0);
      setIsPaused(false);
      resetSimulation(topology, 1);
    }
  };

  const focalMeta = MODE_META[focalMode];
  const approxMemorySec = (3.6 * memoryScale).toFixed(1);
  const rotationalTimeSec = (1 / (2 * Math.max(0.01, rotationalDr))).toFixed(1);

  return (
    <div className="my-8 rounded-2xl border border-slate-800 bg-slate-900/95 p-4 text-slate-100 shadow-xl sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-cyan-300">
              大腸桿菌趨化性演算法實驗室
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${focalMeta.badgeClass}`}
            >
              焦點追蹤：{focalMeta.shortLabel}
            </span>
          </div>
          <h3 className="mt-1.5 text-base font-bold text-slate-100 sm:text-lg">
            Run-and-Tumble 偏置隨機漫步、雙葉時間微分與積分回饋適應
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            同場追蹤 18 隻細菌（3 種策略各 6 隻）。點擊右側切換焦點細胞，或點擊左側梯度場任意位置重新放置主要引誘劑高峰。
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPaused((v) => !v)}
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            {isPaused ? '▶ 繼續游動' : '⏸ 暫停追蹤'}
          </button>
          <button
            type="button"
            onClick={() => resetSimulation()}
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            ↺ 重置 18 隻起點
          </button>
        </div>
      </div>

      {/* Presets & Field Topology */}
      <div className="mt-3.5 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset('standard')}
            className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              activePreset === 'standard'
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
            }`}
          >
            標準生理條件 (1×, D<sub>r</sub>=0.15)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('high_bg')}
            className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              activePreset === 'high_bg'
                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
            }`}
          >
            1000× 高背景精確適應測試
          </button>
          <button
            type="button"
            onClick={() => applyPreset('high_dr')}
            className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              activePreset === 'high_dr'
                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
            }`}
          >
            強轉動布朗撞偏 (D<sub>r</sub>=0.65)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400">食物場：</span>
          {(
            [
              ['single', '單一高峰'],
              ['multi', '雙源點場'],
              ['moving', '移動食物源'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTopology(key)}
              className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                topology === key
                  ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                  : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Focal Strategy Switcher */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/90 bg-slate-950/60 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">焦點追蹤細胞策略：</span>
          {(['chemotaxis', 'unbiased', 'no_adaptation'] as const).map((modeKey) => {
            const meta = MODE_META[modeKey];
            const isSelected = focalMode === modeKey;
            return (
              <button
                key={modeKey}
                type="button"
                onClick={() => setFocalMode(modeKey)}
                className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                  isSelected
                    ? meta.badgeClass
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                {meta.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowAllTrails((v) => !v)}
          className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium transition ${
            showAllTrails
              ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          {showAllTrails ? '顯示全部 18 條軌跡' : '僅顯示焦點軌跡與翻滾點'}
        </button>
      </div>

      {/* Main Twin-Panel Visualization */}
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* Panel 1: 2D Attractant Gradient Field & 18 Bacteria */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 lg:col-span-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              面板一：2D 引誘劑梯度場與 18 隻同場追蹤大腸桿菌
            </span>
            <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
                Tumble 翻滾點
              </span>
              <span className="font-mono text-cyan-300">t = {telemetry.simTime.toFixed(1)} s</span>
            </div>
          </div>

          <canvas
            ref={arenaCanvasRef}
            onClick={handleArenaClick}
            className="block w-full cursor-crosshair rounded-lg"
            style={{ height: '320px' }}
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
                時間記憶＋適應 (6 隻)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                無記憶隨機擴散 (6 隻)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
                關閉適應飽和 (6 隻)
              </span>
            </div>
            <span>點擊場內可移動高峰</span>
          </div>
        </div>

        {/* Panel 2: Temporal Convolution & Ensemble Distance Curves */}
        <div className="min-w-0 flex flex-col gap-3 lg:col-span-6">
          {/* Panel 2A */}
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">
                面板二 (上)：焦點細胞對數感知 c(t)、雙葉卷積記憶與 Tumble 率
              </span>
              <span className="font-mono text-[10px] text-emerald-300">
                ∫K(τ)dτ = 0 (帶通微分)
              </span>
            </div>
            <canvas
              ref={signalCanvasRef}
              className="block w-full rounded-lg"
              style={{ height: '185px' }}
            />
          </div>

          {/* Panel 2B */}
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">
                面板二 (下)：三組群體「與食物高峰平均距離 ⟨d(t)⟩」統計漂移比較
              </span>
              <span className="font-mono text-[10px] text-slate-400">單位：μm</span>
            </div>
            <canvas
              ref={distCanvasRef}
              className="block w-full rounded-lg"
              style={{ height: '150px' }}
            />
          </div>
        </div>
      </div>

      {/* Live Telemetry Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">轉動布朗失向時間 τ<sub>rot</sub></div>
          <div className="mt-1 font-mono text-sm font-bold text-cyan-300 sm:text-base">
            {rotationalTimeSec} s{' '}
            <span className="text-xs font-normal text-slate-400">
              (D<sub>r</sub>={rotationalDr.toFixed(2)})
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">焦點即時 Tumble 機率率 λ(t)</div>
          <div className="mt-1 font-mono text-sm font-bold text-amber-300 sm:text-base">
            {telemetry.focalTumbleRate.toFixed(2)} s<sup>-1</sup>{' '}
            <span className="text-xs font-normal text-slate-400">
              (記憶窗 {approxMemorySec}s)
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">焦點受體活性 A / 甲基化 m</div>
          <div className="mt-1 font-mono text-sm font-bold text-emerald-300 sm:text-base">
            A={telemetry.focalActivity.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">
              (m={telemetry.focalMethylation.toFixed(1)}, {bgMultiplier}×)
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">趨化組 vs 無適應組距峰平均</div>
          <div className="mt-1 font-mono text-sm font-bold text-slate-100 sm:text-base">
            <span className="text-cyan-300">{telemetry.meanDistChemo.toFixed(0)}</span>
            <span className="mx-1 text-xs text-slate-500">vs</span>
            <span className="text-rose-300">{telemetry.meanDistNoAdapt.toFixed(0)} μm</span>
          </div>
        </div>
      </div>

      {/* Control Sliders */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Slider 1: Rotational Diffusion D_r */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">
              轉動擴散強度 D<sub>r</sub> (熱撞偏)
            </span>
            <span className="font-mono font-bold text-cyan-300">
              {rotationalDr.toFixed(2)} rad²/s
            </span>
          </div>
          <input
            type="range"
            min={0.02}
            max={0.8}
            step={0.02}
            value={rotationalDr}
            onChange={(e) => setRotationalDr(parseFloat(e.target.value))}
            className="mt-2 w-full cursor-pointer accent-cyan-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0.02 (長直線)</span>
            <span>0.15 (大腸桿菌實測區)</span>
            <span>0.80 (劇烈偏轉)</span>
          </div>
        </div>

        {/* Slider 2: Background Concentration Multiplier 1x to 1000x */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">背景基礎濃度倍率</span>
            <span className="font-mono font-bold text-emerald-300">{bgMultiplier}×</span>
          </div>
          <input
            type="range"
            min={0}
            max={3}
            step={0.25}
            value={bgExponent}
            onChange={(e) => setBgExponent(parseFloat(e.target.value))}
            className="mt-2 w-full cursor-pointer accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>1× (低背景)</span>
            <span>30×</span>
            <span>1000× (考驗精確適應)</span>
          </div>
        </div>

        {/* Slider 3: Memory Window Scale */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">雙葉記憶窗口尺度</span>
            <span className="font-mono font-bold text-amber-300">
              {memoryScale.toFixed(2)}× (~{approxMemorySec} s)
            </span>
          </div>
          <input
            type="range"
            min={0.35}
            max={2.4}
            step={0.05}
            value={memoryScale}
            onChange={(e) => setMemoryScale(parseFloat(e.target.value))}
            className="mt-2 w-full cursor-pointer accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0.35× (計數雜訊大)</span>
            <span>1.0× (3–4s 最佳)</span>
            <span>2.4× (被熱撞過時)</span>
          </div>
        </div>
      </div>

      {/* Explicit Model Boundary Note */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">模型簡化與邊界聲明：</span>
        二維簡化 Run-and-Tumble 泊松切換與雙葉記憶卷積積分模型，展現時間微分與積分回饋適應的物理原理，非三維鞭毛流體力學全尺度模擬。
      </div>
    </div>
  );
};

function drawArenaCanvas(
  canvas: HTMLCanvasElement | null,
  cells: BacteriumState[],
  sources: AttractantSource[],
  focalCell: BacteriumState | undefined,
  bgMultiplier: number,
  showAllTrails: boolean
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { w, h, dpr } = getDprCanvasSize(canvas, 400, 320);
  ctx.save();
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);

  const sx = w / ARENA_W;
  const sy = h / ARENA_H;

  // Draw attractant gradient field using soft radial glows + contour rings
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const px = src.x * sx;
    const py = src.y * sy;
    const rad = src.sigma * 2.5 * Math.min(sx, sy);
    const grad = ctx.createRadialGradient(px, py, 4, px, py, rad);
    const intensityScale = 0.25 + 0.08 * Math.log10(Math.max(1, bgMultiplier));
    grad.addColorStop(0, `rgba(16, 185, 129, ${Math.min(0.48, intensityScale + 0.16)})`);
    grad.addColorStop(0.45, 'rgba(6, 182, 212, 0.14)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();

    // Iso-concentration contour rings
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.22)';
    ctx.lineWidth = 1;
    for (const mult of [0.6, 1.2, 1.9]) {
      ctx.beginPath();
      ctx.ellipse(
        px,
        py,
        src.sigma * mult * sx,
        src.sigma * mult * sy,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    // Source peak crosshair
    ctx.strokeStyle = 'rgba(110, 231, 183, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px - 7, py);
    ctx.lineTo(px + 7, py);
    ctx.moveTo(px, py - 7);
    ctx.lineTo(px, py + 7);
    ctx.stroke();
  }

  // Draw subtle scale grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 1;
  for (let gx = 100; gx < ARENA_W; gx += 100) {
    ctx.beginPath();
    ctx.moveTo(gx * sx, 0);
    ctx.lineTo(gx * sx, h);
    ctx.stroke();
  }
  for (let gy = 100; gy < ARENA_H; gy += 100) {
    ctx.beginPath();
    ctx.moveTo(0, gy * sy);
    ctx.lineTo(w, gy * sy);
    ctx.stroke();
  }

  // Draw cell trails (either all or focal cell only)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const isFocal = focalCell && cell.id === focalCell.id;
    if (!showAllTrails && !isFocal) continue;
    if (cell.trail.length < 2) continue;

    const meta = MODE_META[cell.mode];
    ctx.strokeStyle = isFocal ? meta.trailColor : `${meta.color}44`;
    ctx.lineWidth = isFocal ? 2.1 : 1.0;
    ctx.beginPath();
    for (let k = 0; k < cell.trail.length; k++) {
      const pt = cell.trail[k];
      const tx = pt.x * sx;
      const ty = pt.y * sy;
      if (k === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.stroke();

    // Mark tumble events on focal cell's trajectory
    if (isFocal) {
      for (let k = 0; k < cell.trail.length; k++) {
        const pt = cell.trail[k];
        if (!pt.isTumble) continue;
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(pt.x * sx, pt.y * sy, 3.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Draw all 18 bacteria bodies
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const isFocal = focalCell && cell.id === focalCell.id;
    const cx = cell.x * sx;
    const cy = cell.y * sy;
    const meta = MODE_META[cell.mode];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(cell.theta);

    // Capsule body
    ctx.fillStyle = meta.color;
    ctx.strokeStyle = isFocal ? '#ffffff' : '#020617';
    ctx.lineWidth = isFocal ? 1.5 : 0.8;
    const len = isFocal ? 10 : 7.5;
    const rad = isFocal ? 3.2 : 2.3;
    ctx.beginPath();
    ctx.roundRect(-len * 0.5, -rad, len, rad * 2, rad);
    ctx.fill();
    ctx.stroke();

    // Flagella tail wiggle (bundled during Run, splayed during Tumble)
    ctx.strokeStyle = cell.isTumbling ? '#fb923c' : `${meta.color}bb`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (cell.isTumbling) {
      ctx.moveTo(-len * 0.5, 0);
      ctx.lineTo(-len * 0.5 - 5, -4);
      ctx.moveTo(-len * 0.5, 0);
      ctx.lineTo(-len * 0.5 - 5, 4);
    } else {
      ctx.moveTo(-len * 0.5, 0);
      ctx.quadraticCurveTo(-len * 0.5 - 4, -2.5, -len * 0.5 - 8, 0);
    }
    ctx.stroke();
    ctx.restore();

    if (isFocal) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Scale bar & background indicator
  ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
  ctx.fillRect(8, 8, 128, 20);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText(`背景倍率: ${bgMultiplier}×`, 14, 21);

  const barPx = 50 * sx;
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w - 14 - barPx, h - 14);
  ctx.lineTo(w - 14, h - 14);
  ctx.stroke();
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('50 μm', w - 14 - barPx, h - 18);

  ctx.restore();
}

function drawSignalCanvas(
  canvas: HTMLCanvasElement | null,
  concTrace: number[],
  convTrace: number[],
  rateTrace: number[],
  kernel: Float64Array,
  focalMode: StrategyMode
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { w, h, dpr } = getDprCanvasSize(canvas, 400, 185);
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);

  const padL = 34;
  const padR = w < 360 ? 96 : 114; // reserve right side for Biphasic Kernel K(tau) inset!
  const padT = 22;
  const padB = 22;
  const plotW = Math.max(110, w - padL - padR);
  const plotH = h - padT - padB;

  const halfH = plotH * 0.46;
  const topY0 = padT;
  const botY0 = padT + halfH + 14;
  const botH = plotH - halfH - 14;

  // Top subplot: Perceived log concentration s(t) & Biphasic memory derivative y(t)
  const midY = topY0 + halfH * 0.5;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, midY);
  ctx.lineTo(padL + plotW, midY);
  ctx.stroke();

  if (concTrace.length > 1) {
    let minC = Infinity;
    let maxC = -Infinity;
    for (let i = 0; i < concTrace.length; i++) {
      if (concTrace[i] < minC) minC = concTrace[i];
      if (concTrace[i] > maxC) maxC = concTrace[i];
    }
    const spanC = Math.max(0.25, maxC - minC);

    // Draw log concentration trace
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < concTrace.length; i++) {
      const x = padL + (i / (SERIES_LEN - 1)) * plotW;
      const y = topY0 + halfH - ((concTrace[i] - minC) / spanC) * (halfH - 6) - 3;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw biphasic convolution output y(t)
    ctx.strokeStyle = MODE_META[focalMode].color;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    for (let i = 0; i < convTrace.length; i++) {
      const x = padL + (i / (SERIES_LEN - 1)) * plotW;
      const normConv = Math.max(-1, Math.min(1, convTrace[i] * 3.2));
      const y = midY - normConv * (halfH * 0.44);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Bottom subplot: Instantaneous Tumble Rate lambda(t)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.setLineDash([3, 3]);
  const baseLineY = botY0 + botH * (1 - BASELINE_TUMBLE_RATE / 2.2);
  ctx.beginPath();
  ctx.moveTo(padL, baseLineY);
  ctx.lineTo(padL + plotW, baseLineY);
  ctx.stroke();
  ctx.setLineDash([]);

  if (rateTrace.length > 1) {
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < rateTrace.length; i++) {
      const x = padL + (i / (SERIES_LEN - 1)) * plotW;
      const normR = Math.max(0, Math.min(1, rateTrace[i] / 2.2));
      const y = botY0 + botH - normR * botH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Labels on left
  ctx.fillStyle = '#6ee7b7';
  ctx.font = '10px sans-serif';
  ctx.fillText('ln c(t) & y(t)', padL, topY0 - 6);
  ctx.fillStyle = '#fdba74';
  ctx.fillText('翻滾率 λ(t)', padL, botY0 - 4);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('λ₀', 10, baseLineY + 3);

  // Right Inset: Segall-Block-Berg Biphasic Kernel K(tau)
  const inX = padL + plotW + 12;
  const inW = w - inX - 8;
  const inY = padT + 4;
  const inH = plotH - 8;
  const inZeroY = inY + inH * 0.45;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
  ctx.lineWidth = 1;
  ctx.fillRect(inX, inY, inW, inH);
  ctx.strokeRect(inX, inY, inW, inH);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.beginPath();
  ctx.moveTo(inX + 6, inZeroY);
  ctx.lineTo(inX + inW - 6, inZeroY);
  ctx.stroke();

  let maxAbsK = 1e-4;
  for (let i = 0; i < kernel.length; i++) {
    if (Math.abs(kernel[i]) > maxAbsK) maxAbsK = Math.abs(kernel[i]);
  }

  // Positive & negative filled lobes
  ctx.beginPath();
  ctx.moveTo(inX + 6, inZeroY);
  for (let i = 0; i < kernel.length; i++) {
    const x = inX + 6 + (i / (kernel.length - 1)) * (inW - 12);
    const y = inZeroY - (kernel[i] / maxAbsK) * (inH * 0.34);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(inX + inW - 6, inZeroY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(34, 211, 238, 0.22)';
  ctx.fill();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < kernel.length; i++) {
    const x = inX + 6 + (i / (kernel.length - 1)) * (inW - 12);
    const y = inZeroY - (kernel[i] / maxAbsK) * (inH * 0.34);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '10px sans-serif';
  ctx.fillText('雙葉記憶核 K(τ)', inX + 6, inY + 12);
  ctx.fillStyle = '#34d399';
  ctx.font = '9px sans-serif';
  ctx.fillText('+ 快抑制', inX + 12, inY + 26);
  ctx.fillStyle = '#fb7185';
  ctx.fillText('- 過去基線', inX + 26, inY + inH - 8);

  ctx.restore();
}

function drawDistanceCanvas(
  canvas: HTMLCanvasElement | null,
  chemoTrace: number[],
  unbiasedTrace: number[],
  noAdaptTrace: number[],
  traceTime: number[]
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { w, h, dpr } = getDprCanvasSize(canvas, 400, 150);
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);

  const padL = 36;
  const padR = 14;
  const padT = 16;
  const padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const maxDist = 280;

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  for (const dVal of [50, 150, 250]) {
    const y = padT + (1 - dVal / maxDist) * plotH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(`${dVal}`, 6, y + 3);
  }

  const drawCurve = (arr: number[], color: string) => {
    if (arr.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const x = padL + (i / (SERIES_LEN - 1)) * plotW;
      const clamped = Math.max(0, Math.min(maxDist, arr[i]));
      const y = padT + (1 - clamped / maxDist) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  drawCurve(unbiasedTrace, MODE_META.unbiased.color);
  drawCurve(noAdaptTrace, MODE_META.no_adaptation.color);
  drawCurve(chemoTrace, MODE_META.chemotaxis.color);

  // Legend & time axis
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
  if (traceTime.length > 0) {
    const tEnd = traceTime[traceTime.length - 1];
    const tStart = traceTime[0];
    ctx.fillText(`${tStart.toFixed(0)}s`, padL, h - 6);
    ctx.fillText(`${tEnd.toFixed(0)}s`, padL + plotW - 26, h - 6);
  }
  ctx.fillStyle = '#6ee7b7';
  ctx.font = '10px sans-serif';
  ctx.fillText('↓ 越低代表群體越靠近食物高峰', padL + 46, h - 6);

  ctx.restore();
}
