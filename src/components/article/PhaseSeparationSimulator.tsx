import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const GRID_N = 64;
const KAPPA = 0.65;
const MOBILITY_M0 = 3.5;
const DT = 0.012;
const SUBSTEPS_PER_FRAME = 8;

type RegimeType = 'homogeneous' | 'nucleation' | 'spinodal';

interface PhaseBounds {
  phiC: number;
  chiC: number;
  spinodal: [number, number] | null;
  binodal: [number, number] | null;
  regime: RegimeType;
  fSecondDeriv: number;
}

interface SimMetrics {
  dropletCount: number;
  meanRadius: number;
  denseAreaPct: number;
  coarseningStep: number;
  meanPhi: number;
}

function clampPhi(phi: number): number {
  return Math.min(1 - 1e-7, Math.max(1e-7, phi));
}

function fhThermo(phi: number, chainN: number, chi: number) {
  const p = clampPhi(phi);
  const mu = (Math.log(p) + 1) / chainN - (Math.log(1 - p) + 1) + chi * (1 - 2 * p);
  const pi = p * (1 / chainN - 1) - Math.log(1 - p) - chi * p * p;
  const d2 = 1 / (chainN * p) + 1 / (1 - p) - 2 * chi;
  return { mu, pi, d2 };
}

function computeSpinodal(chainN: number, chi: number): [number, number] | null {
  const chiC = 0.5 * Math.pow(1 + 1 / Math.sqrt(chainN), 2);
  if (chi <= chiC + 1e-6) return null;
  const a = 2 * chi * chainN;
  const b = 2 * chi * chainN - chainN + 1;
  const disc = Math.sqrt(Math.max(0, b * b - 4 * a));
  const ps1 = Math.max(1e-6, (b - disc) / (2 * a));
  const ps2 = Math.min(1 - 1e-6, (b + disc) / (2 * a));
  return [ps1, ps2];
}

function computeBinodal(chainN: number, chi: number): [number, number] | null {
  const sp = computeSpinodal(chainN, chi);
  if (!sp) return null;
  const [ps1, ps2] = sp;
  const muLow = fhThermo(ps2, chainN, chi).mu;
  const muHigh = fhThermo(ps1, chainN, chi).mu;

  const solveLeft = (mu0: number): number => {
    let lo = -34;
    let hi = Math.log(ps1);
    for (let i = 0; i < 42; i++) {
      const mid = 0.5 * (lo + hi);
      const val = fhThermo(Math.exp(mid), chainN, chi).mu;
      if (val < mu0) lo = mid;
      else hi = mid;
    }
    return Math.exp(0.5 * (lo + hi));
  };

  const solveRight = (mu0: number): number => {
    let lo = -34;
    let hi = Math.log(Math.max(1e-10, 1 - ps2));
    for (let i = 0; i < 42; i++) {
      const mid = 0.5 * (lo + hi);
      const phi = 1 - Math.exp(mid);
      const val = fhThermo(phi, chainN, chi).mu;
      if (val > mu0) lo = mid;
      else hi = mid;
    }
    return 1 - Math.exp(0.5 * (lo + hi));
  };

  let mLo = muLow;
  let mHi = muHigh;
  for (let i = 0; i < 42; i++) {
    const mMid = 0.5 * (mLo + mHi);
    const pa = solveLeft(mMid);
    const pb = solveRight(mMid);
    const diff = fhThermo(pb, chainN, chi).pi - fhThermo(pa, chainN, chi).pi;
    if (diff < 0) mLo = mMid;
    else mHi = mMid;
  }

  const mStar = 0.5 * (mLo + mHi);
  return [solveLeft(mStar), solveRight(mStar)];
}

function analyzePhaseState(phi0: number, chainN: number, chi: number): PhaseBounds {
  const phiC = 1 / (1 + Math.sqrt(chainN));
  const chiC = 0.5 * Math.pow(1 + 1 / Math.sqrt(chainN), 2);
  const spinodal = computeSpinodal(chainN, chi);
  const binodal = computeBinodal(chainN, chi);
  const fSecondDeriv = fhThermo(phi0, chainN, chi).d2;

  let regime: RegimeType = 'homogeneous';
  if (spinodal && phi0 > spinodal[0] && phi0 < spinodal[1]) {
    regime = 'spinodal';
  } else if (binodal && phi0 > binodal[0] && phi0 < binodal[1]) {
    regime = 'nucleation';
  }

  return {
    phiC,
    chiC,
    spinodal,
    binodal,
    regime,
    fSecondDeriv,
  };
}

function measureDomains(
  phi: Float64Array,
  threshold: number
): { dropletCount: number; meanRadius: number; denseAreaPct: number; meanPhi: number } {
  const total = GRID_N * GRID_N;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let denseCount = 0;
  let sumPhi = 0;
  let dropletCount = 0;
  let radiusSum = 0;

  for (let i = 0; i < total; i++) {
    sumPhi += phi[i];
    if (phi[i] > threshold) denseCount++;
  }

  for (let start = 0; start < total; start++) {
    if (visited[start] || phi[start] <= threshold) continue;
    visited[start] = 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    let compSize = 0;

    while (head < tail) {
      const idx = queue[head++];
      compSize++;
      const r = Math.floor(idx / GRID_N);
      const c = idx % GRID_N;
      const neighbors = [
        ((r - 1 + GRID_N) % GRID_N) * GRID_N + c,
        ((r + 1) % GRID_N) * GRID_N + c,
        r * GRID_N + ((c - 1 + GRID_N) % GRID_N),
        r * GRID_N + ((c + 1) % GRID_N),
      ];
      for (let k = 0; k < 4; k++) {
        const nb = neighbors[k];
        if (!visited[nb] && phi[nb] > threshold) {
          visited[nb] = 1;
          queue[tail++] = nb;
        }
      }
    }

    if (compSize >= 4) {
      dropletCount++;
      radiusSum += Math.sqrt(compSize / Math.PI);
    }
  }

  return {
    dropletCount,
    meanRadius: dropletCount > 0 ? radiusSum / dropletCount : 0,
    denseAreaPct: (denseCount / total) * 100,
    meanPhi: sumPhi / total,
  };
}

export const PhaseSeparationSimulator: React.FC = () => {
  const [phi0, setPhi0] = useState<number>(0.11);
  const [chi, setChi] = useState<number>(1.48);
  const [chainN, setChainN] = useState<number>(4);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<'homogeneous' | 'nucleation' | 'spinodal' | 'custom'>('nucleation');
  const [simTick, setSimTick] = useState<number>(0);
  const [metrics, setMetrics] = useState<SimMetrics>({
    dropletCount: 0,
    meanRadius: 0,
    denseAreaPct: 0,
    coarseningStep: 0,
    meanPhi: 0.11,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phiRef = useRef<Float64Array>(new Float64Array(GRID_N * GRID_N));
  const muRef = useRef<Float64Array>(new Float64Array(GRID_N * GRID_N));
  const nextPhiRef = useRef<Float64Array>(new Float64Array(GRID_N * GRID_N));
  const animRef = useRef<number | null>(null);
  const stepCounterRef = useRef<number>(0);

  const phaseState = useMemo(() => analyzePhaseState(phi0, chainN, chi), [phi0, chainN, chi]);

  // Precompute binodal & spinodal curve points for current chainN
  const phaseDiagramCurves = useMemo(() => {
    const chiMin = 0.4;
    const chiMax = 2.4;
    const phiC = 1 / (1 + Math.sqrt(chainN));
    const chiC = 0.5 * Math.pow(1 + 1 / Math.sqrt(chainN), 2);

    const spinodalLeft: Array<{ phi: number; chi: number }> = [];
    const spinodalRight: Array<{ phi: number; chi: number }> = [];
    const binodalLeft: Array<{ phi: number; chi: number }> = [];
    const binodalRight: Array<{ phi: number; chi: number }> = [];

    const samples = 44;
    for (let i = 0; i <= samples; i++) {
      const cVal = chiC + ((chiMax - chiC) * i) / samples;
      if (i === 0) {
        spinodalLeft.push({ phi: phiC, chi: chiC });
        spinodalRight.push({ phi: phiC, chi: chiC });
        binodalLeft.push({ phi: phiC, chi: chiC });
        binodalRight.push({ phi: phiC, chi: chiC });
      } else {
        const sp = computeSpinodal(chainN, cVal);
        const bn = computeBinodal(chainN, cVal);
        if (sp) {
          spinodalLeft.push({ phi: sp[0], chi: cVal });
          spinodalRight.push({ phi: sp[1], chi: cVal });
        }
        if (bn) {
          binodalLeft.push({ phi: bn[0], chi: cVal });
          binodalRight.push({ phi: bn[1], chi: cVal });
        }
      }
    }

    return {
      chiMin,
      chiMax,
      phiC,
      chiC,
      spinodalLeft,
      spinodalRight,
      binodalLeft,
      binodalRight,
    };
  }, [chainN]);

  const seedField = useCallback((targetPhi0: number, targetN: number, targetChi: number) => {
    const phi = phiRef.current;
    const total = GRID_N * GRID_N;
    const state = analyzePhaseState(targetPhi0, targetN, targetChi);

    for (let i = 0; i < total; i++) {
      phi[i] = Math.min(0.98, Math.max(0.005, targetPhi0 + (Math.random() - 0.5) * 0.055));
    }

    // In the metastable nucleation regime, thermal fluctuations produce sub/super-critical pockets
    if (state.regime === 'nucleation' && state.binodal) {
      const denseTarget = Math.max(targetPhi0 + 0.25, Math.min(0.85, state.binodal[1] * 0.92));
      const pocketSeeds = [
        { r: 16, c: 18, rad: 3.2 },
        { r: 21, c: 25, rad: 2.8 },
        { r: 44, c: 20, rad: 3.4 },
        { r: 30, c: 48, rad: 2.6 },
        { r: 50, c: 46, rad: 3.1 },
        { r: 14, c: 50, rad: 1.9 },
        { r: 38, c: 12, rad: 1.8 },
        { r: 54, c: 28, rad: 2.2 },
      ];
      for (const seed of pocketSeeds) {
        const jR = seed.r + Math.round((Math.random() - 0.5) * 6);
        const jC = seed.c + Math.round((Math.random() - 0.5) * 6);
        const radCeil = Math.ceil(seed.rad);
        for (let dr = -radCeil; dr <= radCeil; dr++) {
          for (let dc = -radCeil; dc <= radCeil; dc++) {
            const dist = Math.hypot(dr, dc);
            if (dist <= seed.rad) {
              const rr = (jR + dr + GRID_N) % GRID_N;
              const cc = (jC + dc + GRID_N) % GRID_N;
              const blend = Math.exp(-(dist * dist) / (seed.rad * seed.rad * 0.6));
              phi[rr * GRID_N + cc] = targetPhi0 + (denseTarget - targetPhi0) * blend;
            }
          }
        }
      }
    }

    // Conserve exact average volume fraction targetPhi0
    let sum = 0;
    for (let i = 0; i < total; i++) sum += phi[i];
    const currentAvg = sum / total;
    if (currentAvg > 1e-6) {
      const scale = targetPhi0 / currentAvg;
      for (let i = 0; i < total; i++) {
        phi[i] = Math.min(0.99, Math.max(0.002, phi[i] * scale));
      }
    }

    stepCounterRef.current = 0;
    const threshold = state.binodal ? 0.5 * (state.binodal[0] + state.binodal[1]) : Math.max(0.35, targetPhi0 + 0.15);
    const measured = measureDomains(phi, threshold);
    setMetrics({
      ...measured,
      coarseningStep: 0,
    });
    setSimTick((t) => t + 1);
  }, []);

  // Initialize field on mount
  useEffect(() => {
    seedField(0.11, 4, 1.48);
  }, [seedField]);

  // Adjust spatial average smoothly when user moves phi0 slider directly
  const adjustFieldMean = (newPhi0: number) => {
    const phi = phiRef.current;
    const total = GRID_N * GRID_N;
    let sum = 0;
    for (let i = 0; i < total; i++) sum += phi[i];
    const oldAvg = sum / total;
    const delta = newPhi0 - oldAvg;

    for (let i = 0; i < total; i++) {
      phi[i] = Math.min(0.995, Math.max(0.002, phi[i] + delta));
    }
    setPhi0(newPhi0);
    setActivePreset('custom');

    const nextState = analyzePhaseState(newPhi0, chainN, chi);
    const threshold = nextState.binodal
      ? 0.5 * (nextState.binodal[0] + nextState.binodal[1])
      : Math.max(0.35, newPhi0 + 0.15);
    const measured = measureDomains(phi, threshold);
    setMetrics({
      ...measured,
      coarseningStep: stepCounterRef.current,
    });
    setSimTick((t) => t + 1);
  };

  // Step 2D conserved Cahn-Hilliard / Flory-Huggins PDE
  const stepPDE = useCallback(
    (targetN: number, targetChi: number) => {
      const phi = phiRef.current;
      const mu = muRef.current;
      const nextPhi = nextPhiRef.current;

      for (let sub = 0; sub < SUBSTEPS_PER_FRAME; sub++) {
        // 1. Evaluate local exchange chemical potential mu = df_FH/dphi - kappa * lap(phi)
        for (let r = 0; r < GRID_N; r++) {
          const rU = (r - 1 + GRID_N) % GRID_N;
          const rD = (r + 1) % GRID_N;
          for (let c = 0; c < GRID_N; c++) {
            const cL = (c - 1 + GRID_N) % GRID_N;
            const cR = (c + 1) % GRID_N;
            const idx = r * GRID_N + c;
            const p = Math.min(0.999999, Math.max(1e-6, phi[idx]));

            // 9-point isotropic discrete Laplacian on periodic grid
            const lap =
              (4 * (phi[rU * GRID_N + c] + phi[rD * GRID_N + c] + phi[r * GRID_N + cL] + phi[r * GRID_N + cR]) +
                (phi[rU * GRID_N + cL] + phi[rU * GRID_N + cR] + phi[rD * GRID_N + cL] + phi[rD * GRID_N + cR]) -
                20 * phi[idx]) /
              6;

            const muFH = (Math.log(p) + 1) / targetN - (Math.log(1 - p) + 1) + targetChi * (1 - 2 * p);
            mu[idx] = muFH - KAPPA * lap;
          }
        }

        // 2. Conservative staggered-flux divergence with degenerate Onsager mobility M(p) = M0 * p * (1 - p)
        for (let r = 0; r < GRID_N; r++) {
          const rU = (r - 1 + GRID_N) % GRID_N;
          const rD = (r + 1) % GRID_N;
          for (let c = 0; c < GRID_N; c++) {
            const cL = (c - 1 + GRID_N) % GRID_N;
            const cR = (c + 1) % GRID_N;
            const idx = r * GRID_N + c;

            const pc = phi[idx];
            const mc = pc * (1 - pc);
            const pR = phi[r * GRID_N + cR];
            const pL = phi[r * GRID_N + cL];
            const pD = phi[rD * GRID_N + c];
            const pU = phi[rU * GRID_N + c];

            const mR = MOBILITY_M0 * Math.sqrt(Math.max(0, mc * pR * (1 - pR)));
            const mL = MOBILITY_M0 * Math.sqrt(Math.max(0, mc * pL * (1 - pL)));
            const mD = MOBILITY_M0 * Math.sqrt(Math.max(0, mc * pD * (1 - pD)));
            const mU = MOBILITY_M0 * Math.sqrt(Math.max(0, mc * pU * (1 - pU)));

            const div =
              mR * (mu[r * GRID_N + cR] - mu[idx]) -
              mL * (mu[idx] - mu[r * GRID_N + cL]) +
              mD * (mu[rD * GRID_N + c] - mu[idx]) -
              mU * (mu[idx] - mu[rU * GRID_N + c]);

            nextPhi[idx] = Math.min(0.999999, Math.max(1e-6, pc + DT * div));
          }
        }

        phi.set(nextPhi);
      }

      stepCounterRef.current += SUBSTEPS_PER_FRAME;
    },
    []
  );

  // Animation loop
  useEffect(() => {
    if (!isRunning) return;
    let frame = 0;

    const tick = () => {
      stepPDE(chainN, chi);
      frame++;

      if (frame % 3 === 0) {
        const threshold = phaseState.binodal
          ? 0.5 * (phaseState.binodal[0] + phaseState.binodal[1])
          : Math.max(0.35, phi0 + 0.15);
        const measured = measureDomains(phiRef.current, threshold);
        setMetrics({
          ...measured,
          coarseningStep: stepCounterRef.current,
        });
        setSimTick((t) => t + 1);
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [isRunning, chainN, chi, phi0, phaseState, stepPDE]);

  // Render 2D Cahn-Hilliard field (left) and Flory-Huggins Phase Diagram (right)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#060a16';
    ctx.fillRect(0, 0, w, h);

    // --- Left Panel: 2D Conserved Cahn-Hilliard Field ---
    const fieldX = 24;
    const fieldY = 40;
    const fieldSize = 296;
    const cellPx = fieldSize / GRID_N;

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('2D 守恆 Cahn-Hilliard 相場演化（點擊可局部滴入蛋白核）', fieldX, 23);

    const phi = phiRef.current;
    for (let r = 0; r < GRID_N; r++) {
      for (let c = 0; c < GRID_N; c++) {
        const val = Math.min(1, Math.max(0, phi[r * GRID_N + c]));
        // Dilute dark slate/indigo -> interface teal -> dense luminous cyan-emerald condensate
        const t = Math.pow(val, 0.85);
        const red = Math.round(12 + 32 * t + (val > 0.65 ? 95 * (val - 0.65) : 0));
        const green = Math.round(22 + 195 * t + (val > 0.7 ? 45 * (val - 0.7) : 0));
        const blue = Math.round(48 + 188 * t);
        ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        ctx.fillRect(fieldX + c * cellPx, fieldY + r * cellPx, cellPx + 0.55, cellPx + 0.55);
      }
    }

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(fieldX, fieldY, fieldSize, fieldSize);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('深藍：稀相細胞質 (φ_dil)   亮青綠：濃縮液滴相 (φ_den)', fieldX, fieldY + fieldSize + 17);

    // --- Right Panel: Interactive Flory-Huggins (φ, χ) Phase Diagram ---
    const pL = 382;
    const pR = 774;
    const pT = 40;
    const pB = 336;
    const pW = pR - pL;
    const pH = pB - pT;

    ctx.fillStyle = '#0b1325';
    ctx.fillRect(pL, pT, pW, pH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(pL, pT, pW, pH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`Flory-Huggins 相圖 (鏈長 N = ${chainN}，點擊相圖可即時跳轉狀態點)`, pL, 23);

    const { chiMin, chiMax, phiC, chiC, spinodalLeft, spinodalRight, binodalLeft, binodalRight } =
      phaseDiagramCurves;

    const mapX = (pVal: number) => pL + Math.min(1, Math.max(0, pVal)) * pW;
    const mapY = (cVal: number) => pB - ((Math.min(chiMax, Math.max(chiMin, cVal)) - chiMin) / (chiMax - chiMin)) * pH;

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let pTick = 0.2; pTick <= 0.81; pTick += 0.2) {
      const gx = mapX(pTick);
      ctx.beginPath();
      ctx.moveTo(gx, pT);
      ctx.lineTo(gx, pB);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText(pTick.toFixed(1), gx - 8, pB + 12);
    }
    for (let cTick = 0.5; cTick <= 2.35; cTick += 0.5) {
      const gy = mapY(cTick);
      ctx.beginPath();
      ctx.moveTo(pL, gy);
      ctx.lineTo(pR, gy);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText(cTick.toFixed(1), pL - 26, gy + 3);
    }

    // Fill Binodal two-phase envelope (metastable nucleation & growth belt)
    if (binodalLeft.length > 1 && chiC < chiMax) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.13)';
      ctx.beginPath();
      for (let i = binodalLeft.length - 1; i >= 0; i--) {
        const pt = binodalLeft[i];
        if (i === binodalLeft.length - 1) ctx.moveTo(mapX(pt.phi), mapY(pt.chi));
        else ctx.lineTo(mapX(pt.phi), mapY(pt.chi));
      }
      for (let i = 1; i < binodalRight.length; i++) {
        const pt = binodalRight[i];
        ctx.lineTo(mapX(pt.phi), mapY(pt.chi));
      }
      ctx.closePath();
      ctx.fill();
    }

    // Fill Spinodal unstable region
    if (spinodalLeft.length > 1 && chiC < chiMax) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
      ctx.beginPath();
      for (let i = spinodalLeft.length - 1; i >= 0; i--) {
        const pt = spinodalLeft[i];
        if (i === spinodalLeft.length - 1) ctx.moveTo(mapX(pt.phi), mapY(pt.chi));
        else ctx.lineTo(mapX(pt.phi), mapY(pt.chi));
      }
      for (let i = 1; i < spinodalRight.length; i++) {
        const pt = spinodalRight[i];
        ctx.lineTo(mapX(pt.phi), mapY(pt.chi));
      }
      ctx.closePath();
      ctx.fill();
    }

    // Draw Binodal Curve (solid cyan)
    if (binodalLeft.length > 1 && chiC < chiMax) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = binodalLeft.length - 1; i >= 0; i--) {
        const pt = binodalLeft[i];
        if (i === binodalLeft.length - 1) ctx.moveTo(mapX(pt.phi), mapY(pt.chi));
        else ctx.lineTo(mapX(pt.phi), mapY(pt.chi));
      }
      for (let i = 1; i < binodalRight.length; i++) {
        const pt = binodalRight[i];
        ctx.lineTo(mapX(pt.phi), mapY(pt.chi));
      }
      ctx.stroke();
    }

    // Draw Spinodal Curve (dashed amber)
    if (spinodalLeft.length > 1 && chiC < chiMax) {
      ctx.strokeStyle = '#fbbf24';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = spinodalLeft.length - 1; i >= 0; i--) {
        const pt = spinodalLeft[i];
        if (i === spinodalLeft.length - 1) ctx.moveTo(mapX(pt.phi), mapY(pt.chi));
        else ctx.lineTo(mapX(pt.phi), mapY(pt.chi));
      }
      for (let i = 1; i < spinodalRight.length; i++) {
        const pt = spinodalRight[i];
        ctx.lineTo(mapX(pt.phi), mapY(pt.chi));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Critical Point marker (phi_c, chi_c)
    if (chiC <= chiMax && chiC >= chiMin) {
      const cx = mapX(phiC);
      const cy = mapY(chiC);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#fde68a';
      ctx.font = '10px monospace';
      ctx.fillText(`臨界點 (${phiC.toFixed(2)}, ${chiC.toFixed(2)})`, Math.min(pR - 120, cx + 8), cy + 12);
    }

    // Tie line if inside two-phase envelope
    if (phaseState.regime !== 'homogeneous' && phaseState.binodal) {
      const [dil, den] = phaseState.binodal;
      const ty = mapY(chi);
      ctx.strokeStyle = 'rgba(244, 244, 245, 0.55)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(mapX(dil), ty);
      ctx.lineTo(mapX(den), ty);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(mapX(dil), ty, 3.8, 0, Math.PI * 2);
      ctx.arc(mapX(den), ty, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Current (phi0, chi) state point
    const sx = mapX(phi0);
    const sy = mapY(chi);
    const pointColor =
      phaseState.regime === 'homogeneous'
        ? '#94a3b8'
        : phaseState.regime === 'nucleation'
        ? '#22d3ee'
        : '#f43f5e';

    ctx.strokeStyle = pointColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 9.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = pointColor;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Axis titles & legend
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px monospace';
    ctx.fillText('平均體積分率 φ₀', pR - 98, pB + 15);
    ctx.fillText('χ', pL - 18, pT + 10);

    ctx.fillStyle = '#22d3ee';
    ctx.font = '10px sans-serif';
    ctx.fillText('━ 雙節線 Binodal (成核與生長邊界)', pL + 10, pB - 24);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('-- 旋節線 Spinodal (∂²F/∂φ² = 0)', pL + 10, pB - 9);
  }, [simTick, phi0, chi, chainN, phaseState, phaseDiagramCurves]);

  const applyPreset = (preset: 'homogeneous' | 'nucleation' | 'spinodal') => {
    setActivePreset(preset);
    if (preset === 'homogeneous') {
      setPhi0(0.22);
      setChi(0.90);
      setChainN(4);
      seedField(0.22, 4, 0.90);
    } else if (preset === 'nucleation') {
      setPhi0(0.11);
      setChi(1.48);
      setChainN(4);
      seedField(0.11, 4, 1.48);
    } else {
      setPhi0(0.34);
      setChi(1.65);
      setChainN(4);
      seedField(0.34, 4, 1.65);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    // Left panel click: drop a localized condensate seed conserving total phi0
    const fieldX = 24;
    const fieldY = 40;
    const fieldSize = 296;
    if (cx >= fieldX && cx <= fieldX + fieldSize && cy >= fieldY && cy <= fieldY + fieldSize) {
      const targetCol = Math.floor(((cx - fieldX) / fieldSize) * GRID_N);
      const targetRow = Math.floor(((cy - fieldY) / fieldSize) * GRID_N);
      const phi = phiRef.current;
      const total = GRID_N * GRID_N;
      let addedMass = 0;
      const seedVal = phaseState.binodal ? Math.max(0.68, phaseState.binodal[1] * 0.9) : 0.72;

      for (let dr = -3; dr <= 3; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
          const dist = Math.hypot(dr, dc);
          if (dist <= 3.0) {
            const rr = (targetRow + dr + GRID_N) % GRID_N;
            const cc = (targetCol + dc + GRID_N) % GRID_N;
            const idx = rr * GRID_N + cc;
            const blend = Math.exp(-(dist * dist) / 5.0);
            const nextVal = Math.max(phi[idx], phi[idx] + (seedVal - phi[idx]) * blend);
            addedMass += nextVal - phi[idx];
            phi[idx] = nextVal;
          }
        }
      }

      // Uniformly compensate background to keep conserved average phi0
      if (addedMass > 0) {
        const subtract = addedMass / total;
        for (let i = 0; i < total; i++) {
          phi[i] = Math.max(0.002, phi[i] - subtract);
        }
      }
      setSimTick((t) => t + 1);
      return;
    }

    // Right panel click: jump directly to (phi0, chi) on phase diagram
    const pL = 382;
    const pR = 774;
    const pT = 40;
    const pB = 336;
    if (cx >= pL && cx <= pR && cy >= pT && cy <= pB) {
      const clickedPhi = Math.min(0.70, Math.max(0.05, Math.round(((cx - pL) / (pR - pL)) * 100) / 100));
      const { chiMin, chiMax } = phaseDiagramCurves;
      const rawChi = chiMin + ((pB - cy) / (pB - pT)) * (chiMax - chiMin);
      const clickedChi = Math.min(2.20, Math.max(0.50, Math.round(rawChi * 50) / 50));

      setChi(clickedChi);
      setPhi0(clickedPhi);
      setActivePreset('custom');
      seedField(clickedPhi, chainN, clickedChi);
    }
  };

  const regimeMeta =
    phaseState.regime === 'homogeneous'
      ? {
          label: '單相均勻溶液',
          color: 'text-slate-300',
          desc: '位於雙節線外側，熵勝過吸引交互作用 (∂²F/∂φ² > 0)',
        }
      : phaseState.regime === 'nucleation'
      ? {
          label: '介穩區：成核與生長',
          color: 'text-cyan-400',
          desc: '位於雙節線與旋節線之間，需跨越核化能障形成離散液滴',
        }
      : {
          label: '不穩定區：旋節分解',
          color: 'text-rose-400',
          desc: '位於旋節線內側 (∂²F/∂φ² < 0)，無能障自發湧現海綿網絡',
        };

  return (
    <div className="my-8 w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90 p-3 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-100">
              Flory-Huggins 熱力學與 2D 液－液相分離（LLPS）模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            即時求解週期網格二維守恆 Cahn-Hilliard 相場偏微分方程，觀察離散液滴融合、奧斯瓦爾德熟化與旋節分解
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsRunning((prev) => !prev)}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500 active:scale-95"
          >
            {isRunning ? '⏸ 暫停演化' : '▶ 繼續演化'}
          </button>
          <button
            onClick={() => seedField(phi0, chainN, chi)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-95"
          >
            ↺ 重新灑種擾動
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => applyPreset('homogeneous')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activePreset === 'homogeneous'
              ? 'bg-slate-600 text-white ring-1 ring-slate-400'
              : 'border border-slate-700 bg-slate-950/70 text-slate-300 hover:bg-slate-800'
          }`}
        >
          單相均勻溶解
        </button>
        <button
          onClick={() => applyPreset('nucleation')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activePreset === 'nucleation'
              ? 'bg-cyan-700 text-white ring-1 ring-cyan-400'
              : 'border border-slate-700 bg-slate-950/70 text-slate-300 hover:bg-slate-800'
          }`}
        >
          成核生長：離散液滴融合
        </button>
        <button
          onClick={() => applyPreset('spinodal')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activePreset === 'spinodal'
              ? 'bg-rose-700 text-white ring-1 ring-rose-400'
              : 'border border-slate-700 bg-slate-950/70 text-slate-300 hover:bg-slate-800'
          }`}
        >
          旋節分解：雙連續海綿網絡
        </button>
      </div>

      {/* Canvas View */}
      <div className="mt-3 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={365}
          onClick={handleCanvasClick}
          className="w-full h-auto block cursor-pointer rounded-lg"
        />
      </div>

      {/* KPI Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">熱力學相態區間</div>
          <div className={`mt-1 text-sm sm:text-base font-bold ${regimeMeta.color}`}>
            {regimeMeta.label}
          </div>
          <div className="text-[10px] text-slate-500">
            ∂²F/∂φ² = {phaseState.fSecondDeriv.toFixed(2)} k<sub>B</sub>T
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">Flory-Huggins 臨界點</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-amber-300">
            φ<sub>c</sub>={phaseState.phiC.toFixed(2)}, χ<sub>c</sub>={phaseState.chiC.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500">
            隨聚合鏈長 N = {chainN} 往低濃度左移
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">凝聚結構粗化監測</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-emerald-300">
            {metrics.dropletCount} 域 / R̄={metrics.meanRadius.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-500">
            濃相面積占比 {metrics.denseAreaPct.toFixed(1)}% · 步數 {metrics.coarseningStep}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">理論雙節線共存分率</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-sky-300">
            {phaseState.binodal
              ? `${phaseState.binodal[0].toFixed(3)} / ${phaseState.binodal[1].toFixed(3)}`
              : '無相分離共存'}
          </div>
          <div className="text-[10px] text-slate-500">
            守恆平均 φ̄ = {metrics.meanPhi.toFixed(3)} (設定 {phi0.toFixed(2)})
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">平均蛋白體積分率 φ₀</span>
            <span className="font-mono font-bold text-cyan-400">{phi0.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={0.70}
            step={0.01}
            value={phi0}
            onChange={(e) => adjustFieldMean(parseFloat(e.target.value))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.05 (極稀溶液)</span>
            <span>0.70 (極高擁擠)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Flory-Huggins 參數 χ</span>
            <span className="font-mono font-bold text-rose-400">{chi.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.50}
            max={2.20}
            step={0.02}
            value={chi}
            onChange={(e) => {
              setChi(parseFloat(e.target.value));
              setActivePreset('custom');
            }}
            className="mt-2 w-full accent-rose-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.50 (良溶劑溶解)</span>
            <span>2.20 (強黏扣吸引)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">有效鏈長／多價數 N</span>
            <span className="font-mono font-bold text-amber-300">N = {chainN}</span>
          </div>
          <input
            type="range"
            min={1}
            max={16}
            step={1}
            value={chainN}
            onChange={(e) => {
              setChainN(parseInt(e.target.value, 10));
              setActivePreset('custom');
            }}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>N=1 (對稱小分子)</span>
            <span>N=16 (長鏈多價蛋白)</span>
          </div>
        </div>
      </div>

      {/* Explicit Model Boundary Note */}
      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/75 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-400">
        <span className="font-semibold text-amber-300">模型簡化邊界：</span>
        本模擬器在二維週期網格上求解對稱二元（單一聚合物－溶劑）等溫守恆 Cahn-Hilliard／Flory-Huggins
        連續相場方程（介面能係數 κ = {KAPPA}，簡併遷移率 M(φ) ∝ φ(1−φ)）。真實活細胞內的無膜胞器並非理想雙組分平衡態溶液，而是受多種蛋白質與 RNA 支架、ATP 依賴性解旋酶／伴侶蛋白及轉譯後修飾動態調控的非平衡主動流體，且隨時間可能發生黏彈性老化或病理性液－固硬化。
      </div>
    </div>
  );
};
