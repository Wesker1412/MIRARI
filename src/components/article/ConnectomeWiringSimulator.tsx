import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

type LayerId = 'sensory' | 'central' | 'motor';
type NeurotransmitterSign = 'exc' | 'inh';
type NeuromodulatorState = 'baseline' | 'dopamine' | 'gaba_sedated';
type StimulusPattern = 'optic_left' | 'bilateral_explore' | 'multi_right';
type ClickMode = 'ablate' | 'inspect';
type MatrixViewMode = 'weights' | 'flux';

interface ConnectomeNode {
  id: number;
  code: string;
  labelZh: string;
  region: string;
  layer: LayerId;
  isRichClub: boolean;
  ntSign: NeurotransmitterSign;
  ntLabel: string;
  x: number; // SVG coordinate in [0, 760]
  y: number; // SVG coordinate in [0, 400]
}

interface DirectedEdge {
  from: number;
  to: number;
  weight: number; // positive = excitatory (ACh), negative = inhibitory (GABA/Glu)
}

interface ModulatorParams {
  id: NeuromodulatorState;
  labelZh: string;
  subLabel: string;
  excGain: number;
  inhModGain: number;
  threshold: number;
  spontaneousDrive: number;
  badgeColor: string;
}

const MODULATOR_CONFIGS: Record<NeuromodulatorState, ModulatorParams> = {
  baseline: {
    id: 'baseline',
    labelZh: '低喚醒基線',
    subLabel: 'Baseline (平衡傳導)',
    excGain: 0.96,
    inhModGain: 1.0,
    threshold: 0.22,
    spontaneousDrive: 0.025,
    badgeColor: 'text-sky-700 bg-sky-50 border-sky-200',
  },
  dopamine: {
    id: 'dopamine',
    labelZh: '高多巴胺探索態',
    subLabel: 'High Dopamine (高增益迴響)',
    excGain: 1.44,
    inhModGain: 0.72,
    threshold: 0.11,
    spontaneousDrive: 0.075,
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  gaba_sedated: {
    id: 'gaba_sedated',
    labelZh: 'GABA 過抑制鎮靜態',
    subLabel: 'GABA Over-Inhibition (門控關閉)',
    excGain: 0.72,
    inhModGain: 1.65,
    threshold: 0.34,
    spontaneousDrive: 0.005,
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
  },
};

const STIMULUS_CONFIGS: Record<
  StimulusPattern,
  { labelZh: string; desc: string; targets: number[] }
> = {
  optic_left: {
    labelZh: '左側視覺閃影',
    desc: '刺激左側視葉通道 (OS-L1, OS-L2) 與局部觸角輔助輸入',
    targets: [0, 1, 4],
  },
  bilateral_explore: {
    labelZh: '雙側平衡探索',
    desc: '均勻驅動雙側視葉與觸角嗅覺／機械感受通道',
    targets: [0, 2, 4, 6],
  },
  multi_right: {
    labelZh: '右側多模態刺激',
    desc: '同步激活右側視葉與右側觸角複合感覺通路',
    targets: [2, 3, 6, 7],
  },
};

const NODES: ConnectomeNode[] = [
  // Layer 1: Sensory Input (0..7)
  { id: 0, code: 'OS-L1', labelZh: '左視葉背側', region: 'Optic L', layer: 'sensory', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 88, y: 54 },
  { id: 1, code: 'OS-L2', labelZh: '左視葉腹側', region: 'Optic L', layer: 'sensory', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 88, y: 98 },
  { id: 2, code: 'OS-R1', labelZh: '右視葉背側', region: 'Optic R', layer: 'sensory', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 88, y: 146 },
  { id: 3, code: 'OS-R2', labelZh: '右視葉腹側', region: 'Optic R', layer: 'sensory', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 88, y: 190 },
  { id: 4, code: 'AN-L1', labelZh: '左觸角嗅覺', region: 'Antennal L', layer: 'sensory', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 88, y: 242 },
  { id: 5, code: 'AN-L2', labelZh: '左觸角機械', region: 'Antennal L', layer: 'sensory', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 88, y: 286 },
  { id: 6, code: 'AN-R1', labelZh: '右觸角嗅覺', region: 'Antennal R', layer: 'sensory', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 88, y: 330 },
  { id: 7, code: 'AN-R2', labelZh: '右觸角機械', region: 'Antennal R', layer: 'sensory', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 88, y: 372 },

  // Layer 2: Rich-Club Hubs (8..13) + Local Interneurons (14..17)
  { id: 8, code: 'RC-L1', labelZh: '豐富俱樂部・左視整合', region: 'Rich-Club Core', layer: 'central', isRichClub: true, ntSign: 'exc', ntLabel: 'ACh (+)', x: 325, y: 112 },
  { id: 9, code: 'RC-R1', labelZh: '豐富俱樂部・右視整合', region: 'Rich-Club Core', layer: 'central', isRichClub: true, ntSign: 'exc', ntLabel: 'ACh (+)', x: 325, y: 288 },
  { id: 10, code: 'RC-CX1', labelZh: '豐富俱樂部・中央複合體 A', region: 'Rich-Club Core', layer: 'central', isRichClub: true, ntSign: 'exc', ntLabel: 'ACh (+)', x: 410, y: 158 },
  { id: 11, code: 'RC-CX2', labelZh: '豐富俱樂部・中央複合體 B', region: 'Rich-Club Core', layer: 'central', isRichClub: true, ntSign: 'exc', ntLabel: 'ACh (+)', x: 410, y: 244 },
  { id: 12, code: 'RC-MB1', labelZh: '豐富俱樂部・蕈形體樞紐', region: 'Rich-Club Core', layer: 'central', isRichClub: true, ntSign: 'exc', ntLabel: 'ACh (+)', x: 486, y: 200 },
  { id: 13, code: 'RC-INH', labelZh: '豐富俱樂部・跨區抑制樞紐', region: 'Rich-Club Core', layer: 'central', isRichClub: true, ntSign: 'inh', ntLabel: 'GABA (-)', x: 365, y: 200 },

  // Local peripheral interneurons (non-Rich-Club)
  { id: 14, code: 'IN-L', labelZh: '局部側抑・左', region: 'Local Interneuron', layer: 'central', isRichClub: false, ntSign: 'inh', ntLabel: 'GABA/Glu (-)', x: 245, y: 66 },
  { id: 15, code: 'IN-R', labelZh: '局部側抑・右', region: 'Local Interneuron', layer: 'central', isRichClub: false, ntSign: 'inh', ntLabel: 'GABA/Glu (-)', x: 245, y: 334 },
  { id: 16, code: 'IN-G1', labelZh: '前饋門控抑制元', region: 'Local Interneuron', layer: 'central', isRichClub: false, ntSign: 'inh', ntLabel: 'GABA (-)', x: 525, y: 82 },
  { id: 17, code: 'IN-G2', labelZh: '回饋穩態抑制元', region: 'Local Interneuron', layer: 'central', isRichClub: false, ntSign: 'inh', ntLabel: 'Glu/GABA (-)', x: 525, y: 318 },

  // Layer 3: Descending Motor Output Neurons (18..23)
  { id: 18, code: 'DN-L1', labelZh: '下行左轉主通道', region: 'DN Left Turn', layer: 'motor', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 670, y: 74 },
  { id: 19, code: 'DN-L2', labelZh: '下行左轉輔助', region: 'DN Left Turn', layer: 'motor', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 670, y: 124 },
  { id: 20, code: 'DN-F1', labelZh: '下行前行主通道', region: 'DN Forward', layer: 'motor', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 670, y: 178 },
  { id: 21, code: 'DN-F2', labelZh: '下行前行輔助', region: 'DN Forward', layer: 'motor', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 670, y: 226 },
  { id: 22, code: 'DN-R1', labelZh: '下行右轉主通道', region: 'DN Right Turn', layer: 'motor', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 670, y: 280 },
  { id: 23, code: 'DN-R2', labelZh: '下行右轉輔助', region: 'DN Right Turn', layer: 'motor', isRichClub: false, ntSign: 'exc', ntLabel: 'ACh (+)', x: 670, y: 330 },
];

// Directed signed synaptic adjacency list (representing excitatory ACh vs inhibitory GABA/Glu weights)
const EDGES: DirectedEdge[] = [
  // Sensory -> Rich-Club Hubs (convergent multi-modal funnel)
  { from: 0, to: 8, weight: 0.78 },
  { from: 0, to: 14, weight: 0.52 },
  { from: 1, to: 8, weight: 0.72 },
  { from: 1, to: 10, weight: 0.45 },
  { from: 2, to: 9, weight: 0.78 },
  { from: 2, to: 15, weight: 0.52 },
  { from: 3, to: 9, weight: 0.72 },
  { from: 3, to: 11, weight: 0.45 },
  { from: 4, to: 8, weight: 0.58 },
  { from: 4, to: 12, weight: 0.62 },
  { from: 5, to: 8, weight: 0.44 },
  { from: 5, to: 14, weight: 0.42 },
  { from: 6, to: 9, weight: 0.58 },
  { from: 6, to: 12, weight: 0.62 },
  { from: 7, to: 9, weight: 0.44 },
  { from: 7, to: 15, weight: 0.42 },

  // Local lateral inhibition onto hubs & sensory pathways
  { from: 14, to: 8, weight: -0.42 },
  { from: 14, to: 9, weight: -0.28 },
  { from: 15, to: 9, weight: -0.42 },
  { from: 15, to: 8, weight: -0.28 },

  // Rich-Club Core dense cross-module & cross-hemisphere recurrent network (6 hubs: 8..13)
  { from: 8, to: 10, weight: 0.68 },
  { from: 8, to: 12, weight: 0.52 },
  { from: 8, to: 13, weight: 0.48 },
  { from: 8, to: 9, weight: 0.25 },
  { from: 9, to: 11, weight: 0.68 },
  { from: 9, to: 12, weight: 0.52 },
  { from: 9, to: 13, weight: 0.48 },
  { from: 9, to: 8, weight: 0.25 },

  { from: 10, to: 11, weight: 0.36 },
  { from: 10, to: 12, weight: 0.54 },
  { from: 10, to: 8, weight: 0.28 },
  { from: 10, to: 13, weight: 0.42 },

  { from: 11, to: 10, weight: 0.36 },
  { from: 11, to: 12, weight: 0.54 },
  { from: 11, to: 9, weight: 0.28 },
  { from: 11, to: 13, weight: 0.42 },

  { from: 12, to: 10, weight: 0.46 },
  { from: 12, to: 11, weight: 0.46 },
  { from: 12, to: 8, weight: 0.26 },
  { from: 12, to: 9, weight: 0.26 },
  { from: 12, to: 16, weight: 0.44 },
  { from: 12, to: 17, weight: 0.44 },

  // Rich-Club Inhibitory Hub (13) regulates all core hubs (E/I balance)
  { from: 13, to: 8, weight: -0.46 },
  { from: 13, to: 9, weight: -0.46 },
  { from: 13, to: 10, weight: -0.52 },
  { from: 13, to: 11, weight: -0.52 },
  { from: 13, to: 12, weight: -0.56 },

  // Rich-Club Hubs -> Descending Motor Neurons (crossed + forward routing)
  // Left visual/sensory stimulation (RC-L1=8, RC-CX1=10) biases contralateral right escape (DN-R) + forward
  { from: 8, to: 22, weight: 0.64 },
  { from: 8, to: 23, weight: 0.46 },
  { from: 8, to: 20, weight: 0.36 },

  { from: 9, to: 18, weight: 0.64 },
  { from: 9, to: 19, weight: 0.46 },
  { from: 9, to: 21, weight: 0.36 },

  { from: 10, to: 20, weight: 0.62 },
  { from: 10, to: 22, weight: 0.44 },
  { from: 10, to: 18, weight: 0.24 },

  { from: 11, to: 21, weight: 0.62 },
  { from: 11, to: 18, weight: 0.44 },
  { from: 11, to: 22, weight: 0.24 },

  { from: 12, to: 20, weight: 0.68 },
  { from: 12, to: 21, weight: 0.68 },
  { from: 12, to: 19, weight: 0.32 },
  { from: 12, to: 23, weight: 0.32 },

  // Inhibitory gating interneurons onto DNs
  { from: 16, to: 18, weight: -0.48 },
  { from: 16, to: 19, weight: -0.42 },
  { from: 16, to: 20, weight: -0.35 },
  { from: 17, to: 22, weight: -0.48 },
  { from: 17, to: 23, weight: -0.42 },
  { from: 17, to: 21, weight: -0.35 },

  // Weak direct sensorimotor reflex bypass (insufficient without Rich-Club)
  { from: 0, to: 22, weight: 0.16 },
  { from: 2, to: 18, weight: 0.16 },
];

const N = NODES.length;

function buildAdjacencyMatrix(): number[][] {
  const mat = Array.from({ length: N }, () => Array(N).fill(0));
  for (const e of EDGES) {
    mat[e.to][e.from] = e.weight;
  }
  return mat;
}

const STATIC_W = buildAdjacencyMatrix();

function computeNodeDegrees() {
  const inDeg = Array(N).fill(0);
  const outDeg = Array(N).fill(0);
  for (const e of EDGES) {
    outDeg[e.from]++;
    inDeg[e.to]++;
  }
  return NODES.map((n) => ({
    ...n,
    inDeg: inDeg[n.id],
    outDeg: outDeg[n.id],
    totalDeg: inDeg[n.id] + outDeg[n.id],
  }));
}

const NODE_STATS = computeNodeDegrees();

const RICH_CLUB_AVG_DEG = (() => {
  const rc = NODE_STATS.filter((n) => n.isRichClub);
  return rc.reduce((s, n) => s + n.totalDeg, 0) / rc.length;
})();

const PERIPHERAL_AVG_DEG = (() => {
  const per = NODE_STATS.filter((n) => !n.isRichClub);
  return per.reduce((s, n) => s + n.totalDeg, 0) / per.length;
})();

function activationFn(x: number, theta: number): number {
  const slope = 5.4;
  const raw = 1 / (1 + Math.exp(-slope * (x - theta)));
  const zeroRef = 1 / (1 + Math.exp(slope * theta));
  return Math.max(0, Math.min(1, (raw - zeroRef) / (1 - zeroRef)));
}

function edgePathD(from: ConnectomeNode, to: ConnectomeNode): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  // Slight perpendicular curvature so reciprocal edges don't overlap
  const nx = -dy / dist;
  const ny = dx / dist;
  const curveOffset = from.id < to.id ? 14 : -14;
  const cx = (from.x + to.x) / 2 + nx * curveOffset;
  const cy = (from.y + to.y) / 2 + ny * curveOffset;

  // Trim start/end slightly so arrowheads sit cleanly at node radius (~13px)
  const rStart = 13;
  const rEnd = 15;
  const sx = from.x + ((cx - from.x) / (Math.hypot(cx - from.x, cy - from.y) || 1)) * rStart;
  const sy = from.y + ((cy - from.y) / (Math.hypot(cx - from.x, cy - from.y) || 1)) * rStart;
  const ex = to.x - ((to.x - cx) / (Math.hypot(to.x - cx, to.y - cy) || 1)) * rEnd;
  const ey = to.y - ((to.y - cy) / (Math.hypot(to.x - cx, to.y - cy) || 1)) * rEnd;

  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

export const ConnectomeWiringSimulator: React.FC = () => {
  const [modulator, setModulator] = useState<NeuromodulatorState>('baseline');
  const [stimulus, setStimulus] = useState<StimulusPattern>('optic_left');
  const [inhGain, setInhGain] = useState<number>(1.0);
  const [ablatedIds, setAblatedIds] = useState<Set<number>>(() => new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<number>(10); // Default inspect RC-CX1
  const [clickMode, setClickMode] = useState<ClickMode>('ablate');
  const [matrixMode, setMatrixMode] = useState<MatrixViewMode>('flux');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [pulseCounter, setPulseCounter] = useState<number>(1);
  const [rates, setRates] = useState<number[]>(() => Array(N).fill(0.03));

  const ratesRef = useRef<number[]>(Array(N).fill(0.03));
  const simTimeRef = useRef<number>(0);
  const lastPulseAtRef = useRef<number>(0);
  const historyRef = useRef<Array<{ t: number; sensory: number; richClub: number; motor: number }>>([]);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const matrixCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const modCfg = MODULATOR_CONFIGS[modulator];
  const stimCfg = STIMULUS_CONFIGS[stimulus];

  const triggerPulse = useCallback(() => {
    lastPulseAtRef.current = simTimeRef.current;
    setPulseCounter((c) => c + 1);
  }, []);

  const toggleAblateNode = useCallback((nodeId: number) => {
    setSelectedNodeId(nodeId);
    setAblatedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleNodeClick = useCallback(
    (nodeId: number) => {
      if (clickMode === 'ablate') {
        toggleAblateNode(nodeId);
      } else {
        setSelectedNodeId(nodeId);
      }
    },
    [clickMode, toggleAblateNode]
  );

  const ablateRichClubPreset = useCallback(() => {
    setAblatedIds(new Set([8, 10, 12]));
    setSelectedNodeId(10);
  }, []);

  const restoreAllNodes = useCallback(() => {
    setAblatedIds(new Set());
  }, []);

  // Trigger a fresh pulse automatically when stimulus pattern or modulator changes
  useEffect(() => {
    lastPulseAtRef.current = simTimeRef.current;
  }, [stimulus, modulator]);

  // Seed initial history so chart renders immediately on mount
  useEffect(() => {
    const seedHist: Array<{ t: number; sensory: number; richClub: number; motor: number }> = [];
    for (let i = 0; i < 80; i++) {
      seedHist.push({
        t: -2.4 + i * 0.03,
        sensory: 0.04,
        richClub: 0.03,
        motor: 0.02,
      });
    }
    historyRef.current = seedHist;
    lastPulseAtRef.current = 0;
  }, []);

  // Leaky-rate ODE integration loop
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    let frameCount = 0;
    const dt = 0.016;
    const tau = 0.065;

    const step = () => {
      const r = ratesRef.current.slice();
      const tNow = simTimeRef.current;

      // Repeating gentle pulse every 3.4s OR immediate pulse on user trigger
      const elapsedSincePulse = tNow - lastPulseAtRef.current;
      const cycleElapsed = elapsedSincePulse > 3.4 ? elapsedSincePulse % 3.4 : elapsedSincePulse;
      // Smooth sensory burst envelope peaking around 0.15s - 0.85s
      const burstStrength =
        cycleElapsed >= 0 && cycleElapsed < 1.1
          ? Math.exp(-Math.pow((cycleElapsed - 0.35) / 0.32, 2)) * 0.92
          : 0.0;

      const targetSet = new Set(stimCfg.targets);
      const nextR = new Array<number>(N);

      for (let i = 0; i < N; i++) {
        if (ablatedIds.has(i)) {
          nextR[i] = 0;
          continue;
        }

        let synInput = 0;
        const row = STATIC_W[i];
        for (let j = 0; j < N; j++) {
          const w = row[j];
          if (w === 0) continue;
          const preRate = ablatedIds.has(j) ? 0 : r[j];
          if (w > 0) {
            synInput += w * modCfg.excGain * preRate;
          } else {
            synInput += w * inhGain * modCfg.inhModGain * preRate;
          }
        }

        const extInput =
          (i < 8 && targetSet.has(i) ? burstStrength : 0) +
          (i < 8 ? modCfg.spontaneousDrive : modCfg.spontaneousDrive * 0.45);

        const targetRate = activationFn(synInput + extInput, modCfg.threshold);
        nextR[i] = Math.max(0, Math.min(1, r[i] + (dt / tau) * (-r[i] + targetRate)));
      }

      ratesRef.current = nextR;
      simTimeRef.current += dt;
      frameCount++;

      // Update React UI + Canvas at ~30 Hz
      if (frameCount % 2 === 0) {
        const sensoryMean = nextR.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
        const richMean = nextR.slice(8, 14).reduce((a, b) => a + b, 0) / 6;
        const motorMean = nextR.slice(18, 24).reduce((a, b) => a + b, 0) / 6;

        historyRef.current.push({
          t: simTimeRef.current,
          sensory: sensoryMean,
          richClub: richMean,
          motor: motorMean,
        });
        if (historyRef.current.length > 130) {
          historyRef.current.shift();
        }
        setRates(nextR);
      }

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, modCfg, inhGain, ablatedIds, stimCfg]);

  // Draw Layer Average Firing Rate r(t) Time-Series Canvas
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, w, h);

    const padL = 34;
    const padR = 12;
    const padT = 18;
    const padB = 22;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Horizontal grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    [0, 0.25, 0.5, 0.75, 1.0].forEach((val) => {
      const y = padT + (1 - val) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(val.toFixed(2), 4, y + 3);
    });

    const hist = historyRef.current;
    if (hist.length > 1) {
      const drawSeries = (getter: (pt: (typeof hist)[number]) => number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        hist.forEach((pt, idx) => {
          const x = padL + (idx / (hist.length - 1)) * plotW;
          const y = padT + (1 - Math.max(0, Math.min(1, getter(pt)))) * plotH;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      };

      drawSeries((p) => p.sensory, '#f59e0b');
      drawSeries((p) => p.richClub, '#38bdf8');
      drawSeries((p) => p.motor, '#34d399');
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('平均正規化發火率 r(t)', padL, 12);
    ctx.fillText('過去 ~4.0 秒時間窗 →', w - 118, h - 6);
  }, [rates]);

  // Draw 24x24 Connectivity / Flux Heatmap Canvas
  useEffect(() => {
    const canvas = matrixCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, size, size);

    const pad = 18;
    const gridSize = size - pad - 6;
    const cell = gridSize / N;

    for (let to = 0; to < N; to++) {
      for (let from = 0; from < N; from++) {
        const w = STATIC_W[to][from];
        const x = pad + from * cell;
        const y = 4 + to * cell;

        if (w === 0) {
          ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
          ctx.fillRect(x, y, cell - 0.4, cell - 0.4);
          continue;
        }

        const isAblated = ablatedIds.has(from) || ablatedIds.has(to);
        if (isAblated) {
          ctx.fillStyle = 'rgba(71, 85, 105, 0.25)';
          ctx.fillRect(x, y, cell - 0.4, cell - 0.4);
          continue;
        }

        let intensity: number;
        if (matrixMode === 'weights') {
          intensity = Math.min(1, Math.abs(w) / 0.85);
        } else {
          const effGain = w > 0 ? modCfg.excGain : inhGain * modCfg.inhModGain;
          intensity = Math.min(1, (Math.abs(w) * effGain * rates[from]) / 0.72);
        }

        const alpha = 0.18 + intensity * 0.82;
        ctx.fillStyle =
          w > 0
            ? `rgba(56, 189, 248, ${alpha.toFixed(2)})`
            : `rgba(251, 113, 133, ${alpha.toFixed(2)})`;
        ctx.fillRect(x, y, cell - 0.4, cell - 0.4);
      }
    }

    // Layer boundary lines at index 8 and 18
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 1;
    [8, 18].forEach((b) => {
      const bx = pad + b * cell;
      const by = 4 + b * cell;
      ctx.beginPath();
      ctx.moveTo(bx, 4);
      ctx.lineTo(bx, 4 + gridSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad, by);
      ctx.lineTo(pad + gridSize, by);
      ctx.stroke();
    });

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.fillText('突觸前 Presynaptic →', pad + 4, size - 3);
  }, [rates, matrixMode, ablatedIds, modCfg, inhGain]);

  // Motor output breakdown
  const motorStats = useMemo(() => {
    const leftTurn = (rates[18] + rates[19]) / 2;
    const forward = (rates[20] + rates[21]) / 2;
    const rightTurn = (rates[22] + rates[23]) / 2;
    const richAvg = rates.slice(8, 14).reduce((a, b) => a + b, 0) / 6;

    let behaviorLabel = '靜息待命（微弱基線輸出）';
    let behaviorTone = 'text-slate-700 bg-slate-100 border-slate-200';
    const maxMotor = Math.max(leftTurn, forward, rightTurn);

    if (maxMotor < 0.1) {
      behaviorLabel =
        ablatedIds.size >= 3
          ? '核心樞紐受損・訊號跨區中斷'
          : '過抑制門控關閉・行為靜止 (Quiescence)';
      behaviorTone = 'text-rose-700 bg-rose-50 border-rose-200';
    } else if (forward >= leftTurn * 1.05 && forward >= rightTurn * 1.05 && forward > 0.25) {
      behaviorLabel = '穩定前行探索 (Forward Locomotion)';
      behaviorTone = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (rightTurn > leftTurn + 0.08) {
      behaviorLabel = '對側右轉避險 (Right Turn Bias)';
      behaviorTone = 'text-sky-700 bg-sky-50 border-sky-200';
    } else if (leftTurn > rightTurn + 0.08) {
      behaviorLabel = '對側左轉避險 (Left Turn Bias)';
      behaviorTone = 'text-amber-700 bg-amber-50 border-amber-200';
    } else {
      behaviorLabel = '雙側平衡整合輸出 (Balanced Drive)';
      behaviorTone = 'text-sky-700 bg-sky-50 border-sky-200';
    }

    return { leftTurn, forward, rightTurn, richAvg, behaviorLabel, behaviorTone };
  }, [rates, ablatedIds.size]);

  const selectedStat = NODE_STATS[selectedNodeId] || NODE_STATS[10];
  const ablatedRichCount = useMemo(
    () => Array.from(ablatedIds).filter((id) => NODES[id]?.isRichClub).length,
    [ablatedIds]
  );

  return (
    <div className="my-8 w-full max-w-full rounded-2xl border border-mirari-line bg-white shadow-sm overflow-hidden font-sans">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="p-4 sm:p-6 border-b border-mirari-line bg-mirari-surfaceAlt/40 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
              <span className="text-[11px] sm:text-xs uppercase tracking-wider font-semibold text-mirari-cobalt font-mono">
                FlyWire 2024 + Marder 2012 · 有向帶符號拓撲動力學
              </span>
            </div>
            <h3 className="font-serif text-lg sm:text-xl font-bold text-mirari-ink mt-1">
              果蠅全腦接線拓撲與神經調質狀態切換模擬器
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={triggerPulse}
              className="px-3 py-1.5 rounded-xl bg-mirari-cobalt text-white hover:opacity-90 text-xs font-medium transition shadow-xs cursor-pointer"
            >
              ⚡ 施加感覺脈衝 (#{pulseCounter})
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="px-3 py-1.5 rounded-xl border border-mirari-line bg-white text-mirari-ink hover:bg-mirari-paper text-xs font-medium transition cursor-pointer"
            >
              {isPlaying ? '⏸ 暫停積分' : '▶ 繼續積分'}
            </button>
          </div>
        </div>

        {/* Explicit Model Scope Disclaimer */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2 text-xs text-amber-950 leading-relaxed">
          <span className="font-semibold">模型示意：</span>
          簡化 24 節點有向帶符號漏積分激發（Leaky Rate）拓撲示範模型，展示豐富俱樂部樞紐損傷與神經調質增益如何重塑訊號流，非 FlyWire 139,255 神經元全尺度實測模擬。
        </div>
      </div>

      {/* ─── Control Panel ──────────────────────────────────────── */}
      <div className="p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-3.5 sm:p-4 rounded-xl border border-mirari-line bg-mirari-paper/60">
          {/* Neuromodulator State */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-mirari-ink">
                1. 神經調質狀態（相同接線，不同增益）
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
              {(['baseline', 'dopamine', 'gaba_sedated'] as NeuromodulatorState[]).map((key) => {
                const cfg = MODULATOR_CONFIGS[key];
                const active = modulator === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setModulator(key)}
                    className={`px-3 py-1.5 rounded-lg text-left text-xs transition border cursor-pointer ${
                      active
                        ? 'bg-mirari-ink text-white border-mirari-ink shadow-xs'
                        : 'bg-white text-mirari-muted border-mirari-line hover:text-mirari-ink'
                    }`}
                  >
                    <div className="font-semibold">{cfg.labelZh}</div>
                    <div className={`text-[10px] ${active ? 'text-slate-300' : 'text-mirari-dim'}`}>
                      {cfg.subLabel}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sensory Stimulus Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-mirari-ink block">
              2. 感覺輸入脈衝通道 (Optic / Antennal)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
              {(['optic_left', 'bilateral_explore', 'multi_right'] as StimulusPattern[]).map((key) => {
                const cfg = STIMULUS_CONFIGS[key];
                const active = stimulus === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setStimulus(key);
                      triggerPulse();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-left text-xs transition border cursor-pointer ${
                      active
                        ? 'bg-sky-700 text-white border-sky-700 shadow-xs'
                        : 'bg-white text-mirari-muted border-mirari-line hover:text-mirari-ink'
                    }`}
                  >
                    <div className="font-semibold">{cfg.labelZh}</div>
                    <div className={`text-[10px] ${active ? 'text-sky-100' : 'text-mirari-dim'}`}>
                      {cfg.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Global Inhibition Gain & Lesion Presets */}
          <div className="space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="connectome-inh-slider" className="font-semibold text-mirari-ink">
                  3. 全域抑制增益 (GABA / Glu 權重)
                </label>
                <span className="font-mono font-semibold text-rose-600">
                  {inhGain.toFixed(2)}×
                </span>
              </div>
              <input
                id="connectome-inh-slider"
                type="range"
                min={0.3}
                max={2.2}
                step={0.05}
                value={inhGain}
                onChange={(e) => setInhGain(parseFloat(e.target.value))}
                className="w-full accent-rose-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-mirari-dim">
                <span>0.30× 去抑制狂飆</span>
                <span>1.00× 平衡</span>
                <span>2.20× 強煞車</span>
              </div>
            </div>

            <div className="pt-2 border-t border-mirari-line space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-mirari-ink">虛擬雷射燒灼 (Lesion)</span>
                <span className="font-mono text-[11px] text-mirari-muted">
                  已靜默: {ablatedIds.size}/24（樞紐 {ablatedRichCount}/6）
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={ablateRichClubPreset}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-[11px] font-medium transition cursor-pointer"
                >
                  燒灼 3 顆豐富俱樂部樞紐
                </button>
                <button
                  type="button"
                  onClick={restoreAllNodes}
                  disabled={ablatedIds.size === 0}
                  className="px-2.5 py-1 rounded-lg bg-white border border-mirari-line text-mirari-ink hover:bg-mirari-paper disabled:opacity-40 text-[11px] font-medium transition cursor-pointer"
                >
                  修復全部神經元
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Main Stage: Network Graph + Analytics ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 7 Cols: Interactive SVG Connectome */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-mirari-paper p-1 rounded-lg border border-mirari-line">
                <button
                  type="button"
                  onClick={() => setClickMode('ablate')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    clickMode === 'ablate'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-mirari-muted hover:text-mirari-ink'
                  }`}
                >
                  ⚡ 點擊：虛擬雷射燒灼
                </button>
                <button
                  type="button"
                  onClick={() => setClickMode('inspect')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    clickMode === 'inspect'
                      ? 'bg-mirari-ink text-white shadow-xs'
                      : 'text-mirari-muted hover:text-mirari-ink'
                  }`}
                >
                  🔍 點擊：檢視節點度數
                </button>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-mirari-muted">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-sky-400 inline-block" /> 興奮性突觸 (ACh)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-rose-400 inline-block" /> 抑制性突觸 (GABA/Glu)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full border border-amber-400 bg-amber-400/20 inline-block" /> 豐富俱樂部
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0b1120] overflow-hidden shadow-inner">
              <svg
                viewBox="0 0 760 400"
                className="w-full h-auto block select-none"
                role="img"
                aria-label="24 節點果蠅有向帶符號腦連結體模擬圖"
              >
                <defs>
                  <marker
                    id="arrow-exc"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#38bdf8" />
                  </marker>
                  <marker
                    id="arrow-inh"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <rect x="6" y="1.5" width="2.2" height="7" fill="#fb7185" />
                  </marker>
                </defs>

                {/* Layer Region Columns */}
                <rect x="16" y="18" width="144" height="370" rx="12" fill="rgba(30, 41, 59, 0.35)" stroke="rgba(148, 163, 184, 0.14)" />
                <text x="88" y="34" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">
                  感覺輸入層 (8)
                </text>

                {/* Rich-Club Halo Box */}
                <rect
                  x="275"
                  y="74"
                  width="245"
                  height="252"
                  rx="24"
                  fill="rgba(245, 158, 11, 0.05)"
                  stroke="rgba(245, 158, 11, 0.42)"
                  strokeDasharray="6 4"
                />
                <text x="398" y="92" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="600">
                  豐富俱樂部核心 Rich-Club (6 樞紐)
                </text>
                <text x="398" y="388" textAnchor="middle" fill="#64748b" fontSize="10">
                  中央複合體・蕈形體整合層與局部中間神經元 (10)
                </text>

                <rect x="600" y="18" width="144" height="370" rx="12" fill="rgba(30, 41, 59, 0.35)" stroke="rgba(148, 163, 184, 0.14)" />
                <text x="672" y="34" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">
                  下行運動輸出 DN (6)
                </text>

                {/* Motor Group Sub-labels */}
                <text x="718" y="102" textAnchor="middle" fill="#7dd3fc" fontSize="9.5" fontFamily="monospace">
                  左轉
                </text>
                <text x="718" y="205" textAnchor="middle" fill="#6ee7b7" fontSize="9.5" fontFamily="monospace">
                  前行
                </text>
                <text x="718" y="308" textAnchor="middle" fill="#fcd34d" fontSize="9.5" fontFamily="monospace">
                  右轉
                </text>

                {/* Directed Signed Synaptic Edges */}
                {EDGES.map((edge, idx) => {
                  const fromNode = NODES[edge.from];
                  const toNode = NODES[edge.to];
                  const isAblated = ablatedIds.has(edge.from) || ablatedIds.has(edge.to);
                  const preRate = isAblated ? 0 : rates[edge.from];
                  const isExc = edge.weight > 0;
                  const effGain = isExc ? modCfg.excGain : inhGain * modCfg.inhModGain;
                  const flux = Math.min(1, Math.abs(edge.weight) * effGain * preRate);
                  const isSelectedTouch =
                    edge.from === selectedNodeId || edge.to === selectedNodeId;

                  const strokeColor = isAblated
                    ? 'rgba(71, 85, 105, 0.15)'
                    : isExc
                    ? `rgba(56, 189, 248, ${(0.16 + flux * 0.78).toFixed(2)})`
                    : `rgba(251, 113, 133, ${(0.16 + flux * 0.78).toFixed(2)})`;

                  return (
                    <path
                      key={idx}
                      d={edgePathD(fromNode, toNode)}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isAblated ? 0.7 : 0.9 + flux * 2.5 + (isSelectedTouch ? 0.5 : 0)}
                      strokeDasharray={isAblated ? '3 3' : undefined}
                      markerEnd={
                        isAblated ? undefined : isExc ? 'url(#arrow-exc)' : 'url(#arrow-inh)'
                      }
                    />
                  );
                })}

                {/* Neuron Nodes */}
                {NODES.map((node) => {
                  const rVal = ablatedIds.has(node.id) ? 0 : rates[node.id];
                  const isAblated = ablatedIds.has(node.id);
                  const isSelected = selectedNodeId === node.id;

                  let baseColor = '#38bdf8';
                  if (node.ntSign === 'inh') baseColor = '#fb7185';
                  else if (node.layer === 'sensory') baseColor = '#f59e0b';
                  else if (node.layer === 'motor') baseColor = '#34d399';
                  else if (node.isRichClub) baseColor = '#38bdf8';

                  const radius = node.isRichClub ? 13.5 : 10.5;
                  const glowRadius = radius + 3 + rVal * 8;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => handleNodeClick(node.id)}
                      onMouseEnter={() => setSelectedNodeId(node.id)}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={`${node.code} ${node.labelZh} ${isAblated ? '已燒灼' : '正常'}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNodeClick(node.id);
                        }
                      }}
                    >
                      {/* Activity Aura */}
                      {!isAblated && rVal > 0.08 && (
                        <circle
                          r={glowRadius}
                          fill={baseColor}
                          opacity={0.12 + rVal * 0.28}
                        />
                      )}

                      {/* Rich-Club Gold Outer Ring */}
                      {node.isRichClub && !isAblated && (
                        <circle
                          r={radius + 3.2}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth={isSelected ? 2.2 : 1.3}
                          opacity={0.85}
                        />
                      )}

                      {/* Main Soma Circle */}
                      <circle
                        r={radius}
                        fill={isAblated ? '#1e293b' : baseColor}
                        fillOpacity={isAblated ? 0.85 : 0.25 + rVal * 0.75}
                        stroke={isSelected ? '#ffffff' : isAblated ? '#ef4444' : baseColor}
                        strokeWidth={isSelected ? 2.4 : 1.6}
                        strokeDasharray={isAblated ? '3 2' : undefined}
                      />

                      {/* Ablated X mark */}
                      {isAblated && (
                        <path
                          d="M -5 -5 L 5 5 M 5 -5 L -5 5"
                          stroke="#ef4444"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      )}

                      {/* Node Code Label */}
                      <text
                        x={node.layer === 'sensory' ? -18 : node.layer === 'motor' ? -18 : 0}
                        y={node.layer === 'central' ? radius + 11 : 3.5}
                        textAnchor={node.layer === 'central' ? 'middle' : 'end'}
                        fill={isAblated ? '#64748b' : '#e2e8f0'}
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight={node.isRichClub ? '700' : '500'}
                      >
                        {node.code}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Selected Node Topology Inspector */}
            <div className="rounded-xl border border-mirari-line bg-mirari-paper/60 p-3 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-mirari-ink">
                    {selectedStat.code}
                  </span>
                  <span className="font-medium text-mirari-ink">{selectedStat.labelZh}</span>
                  {selectedStat.isRichClub && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                      Rich-Club 樞紐
                    </span>
                  )}
                  {ablatedIds.has(selectedStat.id) && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-semibold">
                      已雷射靜默
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-mirari-muted">
                  神經傳遞物質：{selectedStat.ntLabel} · 腦區：{selectedStat.region}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                <span className="px-2 py-1 rounded bg-white border border-mirari-line">
                  入度 k_in: <strong>{selectedStat.inDeg}</strong>
                </span>
                <span className="px-2 py-1 rounded bg-white border border-mirari-line">
                  出度 k_out: <strong>{selectedStat.outDeg}</strong>
                </span>
                <span className="px-2 py-1 rounded bg-white border border-mirari-line text-sky-700">
                  r(t): <strong>{(ablatedIds.has(selectedStat.id) ? 0 : rates[selectedStat.id]).toFixed(2)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Time-Series r(t), Motor Output, & Matrix Heatmap */}
          <div className="lg:col-span-5 space-y-4">
            {/* Layer r(t) Time-Series */}
            <div className="rounded-xl border border-mirari-line bg-white p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-mirari-ink">各層平均發火率 r(t)</span>
                <div className="flex items-center gap-2.5 text-[10px] font-mono">
                  <span className="text-amber-600">● 感覺層</span>
                  <span className="text-sky-600">● 豐富俱樂部</span>
                  <span className="text-emerald-600">● 運動 DN</span>
                </div>
              </div>
              <canvas
                ref={waveCanvasRef}
                width={420}
                height={150}
                className="w-full h-auto rounded-lg block"
              />
            </div>

            {/* Motor Output Behavioral State */}
            <div className="rounded-xl border border-mirari-line bg-white p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-mirari-ink">
                  下行運動輸出分佈 (DN Output)
                </span>
                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${motorStats.behaviorTone}`}>
                  {motorStats.behaviorLabel}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                {[
                  { label: '左轉通道 (DN-L)', val: motorStats.leftTurn, bar: 'bg-sky-500' },
                  { label: '前行探索 (DN-Fwd)', val: motorStats.forward, bar: 'bg-emerald-500' },
                  { label: '右轉通道 (DN-R)', val: motorStats.rightTurn, bar: 'bg-amber-500' },
                ].map((item) => (
                  <div key={item.label} className="space-y-0.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-mirari-muted">{item.label}</span>
                      <span className="font-mono font-semibold text-mirari-ink">
                        {(item.val * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-150 ${item.bar}`}
                        style={{ width: `${Math.min(100, item.val * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 24x24 Adjacency / Flux Matrix Heatmap & Hub Degree Summary */}
            <div className="rounded-xl border border-mirari-line bg-white p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-mirari-ink">
                  24×24 路徑轉移矩陣熱圖
                </span>
                <div className="flex items-center gap-1 bg-mirari-paper p-0.5 rounded-lg border border-mirari-line">
                  <button
                    type="button"
                    onClick={() => setMatrixMode('flux')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                      matrixMode === 'flux'
                        ? 'bg-mirari-ink text-white'
                        : 'text-mirari-muted hover:text-mirari-ink'
                    }`}
                  >
                    即時有效通量
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixMode('weights')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                      matrixMode === 'weights'
                        ? 'bg-mirari-ink text-white'
                        : 'text-mirari-muted hover:text-mirari-ink'
                    }`}
                  >
                    靜態權重 W_ij
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <canvas
                  ref={matrixCanvasRef}
                  width={196}
                  height={196}
                  className="w-full max-w-[196px] mx-auto h-auto rounded-lg block"
                />
                <div className="space-y-2 text-[11px] text-mirari-muted">
                  <div className="p-2 rounded-lg bg-mirari-paper border border-mirari-line">
                    <div className="font-semibold text-mirari-ink">Rich-Club 拓撲集中度</div>
                    <div className="mt-1 font-mono text-mirari-ink">
                      樞紐平均度數: <strong>{RICH_CLUB_AVG_DEG.toFixed(1)}</strong>
                    </div>
                    <div className="font-mono">
                      一般節點平均: <strong>{PERIPHERAL_AVG_DEG.toFixed(1)}</strong>
                    </div>
                  </div>
                  <p className="leading-relaxed">
                    橘線分隔感覺層 (0–7)、中樞層 (8–17) 與運動層 (18–23)。青藍代表興奮性 ACh 投射，珊瑚紅代表抑制性 GABA/Glu 門控。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
