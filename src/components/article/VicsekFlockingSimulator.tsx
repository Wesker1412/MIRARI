import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC, MouseEvent } from 'react';

type RegimePreset = 'ordered' | 'band' | 'gas' | 'custom';

interface SimulationParams {
  noiseEta: number;
  particleCount: number;
  speedV0: number;
  radiusR: number;
}

interface TelemetrySnapshot {
  phi: number;
  meanAngleDeg: number;
  avgNeighbors: number;
  stepCount: number;
}

const BOX_SIZE = 16.0;
const MAX_PARTICLES = 460;
const HISTORY_LEN = 180;

const PRESETS: Record<Exclude<RegimePreset, 'custom'>, SimulationParams> = {
  ordered: {
    noiseEta: 0.3,
    particleCount: 280,
    speedV0: 0.25,
    radiusR: 1.0,
  },
  band: {
    noiseEta: 2.2,
    particleCount: 380,
    speedV0: 0.42,
    radiusR: 0.85,
  },
  gas: {
    noiseEta: 4.8,
    particleCount: 280,
    speedV0: 0.25,
    radiusR: 1.0,
  },
};

function wrapPeriodic(val: number, box: number): number {
  const m = val % box;
  return m < 0 ? m + box : m;
}

function classifyRegime(phi: number, eta: number): { label: string; toneClass: string } {
  if (phi >= 0.78 && eta < 1.6) {
    return { label: '極性長程有序態 (Flocking)', toneClass: 'text-emerald-400' };
  }
  if (phi >= 0.3 && phi < 0.78) {
    return { label: '相共存／移動密集團帶 (Band Coexistence)', toneClass: 'text-amber-300' };
  }
  return { label: '高雜訊無序氣體態 (Disordered Gas)', toneClass: 'text-rose-400' };
}

function createInitialX(): Float64Array {
  const arr = new Float64Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    arr[i] = ((i * 0.61803398875) % 1) * BOX_SIZE;
  }
  return arr;
}

function createInitialY(): Float64Array {
  const arr = new Float64Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    arr[i] = ((i * 0.38196601125) % 1) * BOX_SIZE;
  }
  return arr;
}

function createInitialTheta(): Float64Array {
  const arr = new Float64Array(MAX_PARTICLES);
  const baseAngle = Math.PI * 0.22;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    arr[i] = baseAngle + Math.sin(i * 1.7) * 0.22;
  }
  return arr;
}

export const VicsekFlockingSimulator: FC = () => {
  const [noiseEta, setNoiseEta] = useState<number>(PRESETS.ordered.noiseEta);
  const [particleCount, setParticleCount] = useState<number>(PRESETS.ordered.particleCount);
  const [speedV0, setSpeedV0] = useState<number>(PRESETS.ordered.speedV0);
  const [radiusR, setRadiusR] = useState<number>(PRESETS.ordered.radiusR);
  const [activePreset, setActivePreset] = useState<RegimePreset>('ordered');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [showNeighborhood, setShowNeighborhood] = useState<boolean>(true);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    phi: 0.96,
    meanAngleDeg: 38,
    avgNeighbors: 3.4,
    stepCount: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pre-allocated typed buffers for up to MAX_PARTICLES particles
  const posXRef = useRef<Float64Array>(createInitialX());
  const posYRef = useRef<Float64Array>(createInitialY());
  const thetaRef = useRef<Float64Array>(createInitialTheta());
  const nextThetaRef = useRef<Float64Array>(new Float64Array(MAX_PARTICLES));
  const phiHistoryRef = useRef<number[]>([0.97]);
  const stepCounterRef = useRef<number>(0);
  const pulseEffectRef = useRef<{ x: number; y: number; ttl: number } | null>(null);

  const paramsRef = useRef<SimulationParams & { showNeighborhood: boolean }>({
    noiseEta,
    particleCount,
    speedV0,
    radiusR,
    showNeighborhood,
  });

  useEffect(() => {
    paramsRef.current = {
      noiseEta,
      particleCount,
      speedV0,
      radiusR,
      showNeighborhood,
    };
  }, [noiseEta, particleCount, speedV0, radiusR, showNeighborhood]);

  const seedParticles = useCallback((count: number, preset: RegimePreset) => {
    const px = posXRef.current;
    const py = posYRef.current;
    const th = thetaRef.current;

    const baseAngle = Math.PI * 0.22;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      px[i] = Math.random() * BOX_SIZE;
      py[i] = Math.random() * BOX_SIZE;
      if (preset === 'ordered') {
        th[i] = baseAngle + (Math.random() - 0.5) * 0.45;
      } else {
        th[i] = Math.random() * Math.PI * 2;
      }
    }

    let vx = 0;
    let vy = 0;
    for (let i = 0; i < count; i++) {
      vx += Math.cos(th[i]);
      vy += Math.sin(th[i]);
    }
    const initPhi = Math.hypot(vx, vy) / count;
    const initAngle = ((Math.atan2(vy, vx) * 180) / Math.PI + 360) % 360;

    phiHistoryRef.current = [initPhi];
    stepCounterRef.current = 0;
    pulseEffectRef.current = null;
    setTelemetry({
      phi: initPhi,
      meanAngleDeg: initAngle,
      avgNeighbors: (count * Math.PI * paramsRef.current.radiusR * paramsRef.current.radiusR) / (BOX_SIZE * BOX_SIZE),
      stepCount: 0,
    });
  }, []);

  const stepVicsek = useCallback((): { phi: number; meanAngle: number; avgNeighbors: number; focalNeighbors: number[] } => {
    const { noiseEta: eta, particleCount: n, speedV0: v0, radiusR: r } = paramsRef.current;
    const px = posXRef.current;
    const py = posYRef.current;
    const th = thetaRef.current;
    const nextTh = nextThetaRef.current;

    const rSq = r * r;
    const halfBox = BOX_SIZE * 0.5;

    // Spatial cell hashing for fast periodic O(N) neighbor lookup
    const gridDim = Math.max(1, Math.floor(BOX_SIZE / r));
    const cellSize = BOX_SIZE / gridDim;
    const cellHead = new Int32Array(gridDim * gridDim).fill(-1);
    const nextInCell = new Int32Array(n).fill(-1);

    for (let i = 0; i < n; i++) {
      const cx = Math.min(gridDim - 1, Math.floor(px[i] / cellSize));
      const cy = Math.min(gridDim - 1, Math.floor(py[i] / cellSize));
      const cIdx = cy * gridDim + cx;
      nextInCell[i] = cellHead[cIdx];
      cellHead[cIdx] = i;
    }

    let totalNeighbors = 0;
    const focalNeighbors: number[] = [];

    for (let i = 0; i < n; i++) {
      const xi = px[i];
      const yi = py[i];
      const cx = Math.min(gridDim - 1, Math.floor(xi / cellSize));
      const cy = Math.min(gridDim - 1, Math.floor(yi / cellSize));

      let sumCos = 0;
      let sumSin = 0;
      let localCount = 0;

      // Search 3x3 periodic cell neighborhood (cellSize = BOX_SIZE / floor(BOX_SIZE / r) >= r)
      for (let dyCell = -1; dyCell <= 1; dyCell++) {
        const ny = (cy + dyCell + gridDim) % gridDim;
        for (let dxCell = -1; dxCell <= 1; dxCell++) {
          const nx = (cx + dxCell + gridDim) % gridDim;
          let j = cellHead[ny * gridDim + nx];
          while (j !== -1) {
            let dx = px[j] - xi;
            if (dx > halfBox) dx -= BOX_SIZE;
            else if (dx < -halfBox) dx += BOX_SIZE;

            let dy = py[j] - yi;
            if (dy > halfBox) dy -= BOX_SIZE;
            else if (dy < -halfBox) dy += BOX_SIZE;

            if (dx * dx + dy * dy <= rSq) {
              sumCos += Math.cos(th[j]);
              sumSin += Math.sin(th[j]);
              localCount++;
              if (i === 0 && j !== 0) {
                focalNeighbors.push(j);
              }
            }
            j = nextInCell[j];
          }
        }
      }

      totalNeighbors += Math.max(0, localCount - 1);
      const meanHeading = Math.atan2(sumSin, sumCos);
      nextTh[i] = meanHeading + (Math.random() - 0.5) * eta;
    }

    let sumVx = 0;
    let sumVy = 0;
    for (let i = 0; i < n; i++) {
      const angle = wrapPeriodic(nextTh[i], Math.PI * 2);
      th[i] = angle;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      px[i] = wrapPeriodic(px[i] + v0 * c, BOX_SIZE);
      py[i] = wrapPeriodic(py[i] + v0 * s, BOX_SIZE);
      sumVx += c;
      sumVy += s;
    }

    const phi = Math.hypot(sumVx, sumVy) / n;
    const meanAngle = Math.atan2(sumVy, sumVx);
    const hist = phiHistoryRef.current;
    hist.push(phi);
    if (hist.length > HISTORY_LEN) hist.shift();
    stepCounterRef.current += 1;

    if (pulseEffectRef.current) {
      pulseEffectRef.current.ttl -= 1;
      if (pulseEffectRef.current.ttl <= 0) {
        pulseEffectRef.current = null;
      }
    }

    return {
      phi,
      meanAngle,
      avgNeighbors: totalNeighbors / n,
      focalNeighbors,
    };
  }, []);

  const drawCanvas = useCallback((focalNeighbors: number[], currentPhi: number, meanAngle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const { particleCount: n, radiusR: r, noiseEta: eta, showNeighborhood: showCircle } = paramsRef.current;
    const px = posXRef.current;
    const py = posYRef.current;
    const th = thetaRef.current;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#040914';
    ctx.fillRect(0, 0, w, h);

    // --- Left Panel: 2D Periodic Flocking Arena ---
    const arenaX = 16;
    const arenaY = 36;
    const arenaSize = 328;
    const scale = arenaSize / BOX_SIZE;

    ctx.fillStyle = '#070f20';
    ctx.fillRect(arenaX, arenaY, arenaSize, arenaSize);

    // Subtle spatial grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) {
      const gx = arenaX + (arenaSize * g) / 4;
      const gy = arenaY + (arenaSize * g) / 4;
      ctx.beginPath();
      ctx.moveTo(gx, arenaY);
      ctx.lineTo(gx, arenaY + arenaSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(arenaX, gy);
      ctx.lineTo(arenaX + arenaSize, gy);
      ctx.stroke();
    }

    // Periodic border dashed outline
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(arenaX, arenaY, arenaSize, arenaSize);
    ctx.setLineDash([]);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`2D 週期性群集空間 (N = ${n}, L = ${BOX_SIZE.toFixed(0)})`, arenaX, 22);

    // Clip to arena for crisp periodic circle / particle rendering
    ctx.save();
    ctx.beginPath();
    ctx.rect(arenaX, arenaY, arenaSize, arenaSize);
    ctx.clip();

    // Draw interaction radius R around focal particle #0
    if (showCircle && n > 0) {
      const fx = arenaX + px[0] * scale;
      const fy = arenaY + py[0] * scale;
      const rPx = r * scale;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(fx, fy, rPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw neighbor links for non-wrapped direct pairs
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
      ctx.lineWidth = 1;
      for (const j of focalNeighbors) {
        const jx = arenaX + px[j] * scale;
        const jy = arenaY + py[j] * scale;
        if (Math.hypot(jx - fx, jy - fy) <= rPx + 2) {
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(jx, jy);
          ctx.stroke();
        }
      }
    }

    // Draw click perturbation ripple if active
    if (pulseEffectRef.current) {
      const pulse = pulseEffectRef.current;
      const progress = 1 - pulse.ttl / 24;
      const rad = (0.4 + progress * 2.4) * scale;
      ctx.strokeStyle = `rgba(251, 191, 36, ${Math.max(0, 0.85 * (1 - progress))})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(arenaX + pulse.x * scale, arenaY + pulse.y * scale, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw all oriented boids colored by heading angle
    for (let i = 0; i < n; i++) {
      const x = arenaX + px[i] * scale;
      const y = arenaY + py[i] * scale;
      const angle = th[i];
      const hue = (((angle * 180) / Math.PI) % 360 + 360) % 360;
      const isFocal = showCircle && i === 0;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      const len = isFocal ? 8.2 : 6.2;
      const wing = isFocal ? 3.8 : 2.7;

      ctx.beginPath();
      ctx.moveTo(len, 0);
      ctx.lineTo(-len * 0.65, wing);
      ctx.lineTo(-len * 0.35, 0);
      ctx.lineTo(-len * 0.65, -wing);
      ctx.closePath();

      ctx.fillStyle = isFocal ? '#ffffff' : `hsl(${hue.toFixed(0)}, 86%, 62%)`;
      ctx.fill();

      if (isFocal) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('點擊空間可施加局部轉向擾動 · 箭頭顏色代表航向角 θᵢ', arenaX, h - 10);

    // --- Right Top Panel: Polar Order Parameter Φ(t) Time Series ---
    const plotX = 372;
    const plotY = 36;
    const plotW = 432;
    const plotH = 152;

    ctx.fillStyle = '#091224';
    ctx.fillRect(plotX, plotY, plotW, plotH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, plotY, plotW, plotH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('極性序參量時間序列 Φ(t) = |Σ vᵢ| / (N v₀)', plotX, 22);

    // Horizontal guides at 0.0, 0.5, 1.0
    for (const level of [0, 0.25, 0.5, 0.75, 1]) {
      const gy = plotY + plotH - 14 - level * (plotH - 28);
      ctx.strokeStyle = level === 0.5 ? 'rgba(251, 191, 36, 0.28)' : 'rgba(148, 163, 184, 0.12)';
      ctx.setLineDash(level === 0.5 ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(plotX + 34, gy);
      ctx.lineTo(plotX + plotW - 10, gy);
      ctx.stroke();
      ctx.setLineDash([]);

      if (level === 0 || level === 0.5 || level === 1) {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.fillText(level.toFixed(1), plotX + 6, gy + 3);
      }
    }

    const hist = phiHistoryRef.current;
    if (hist.length > 0) {
      const graphL = plotX + 36;
      const graphW = plotW - 48;
      const graphT = plotY + 14;
      const graphB = plotY + plotH - 14;
      const graphH = graphB - graphT;

      ctx.strokeStyle = currentPhi >= 0.75 ? '#34d399' : currentPhi >= 0.3 ? '#fbbf24' : '#fb7185';
      ctx.lineWidth = 2.2;
      ctx.beginPath();

      for (let idx = 0; idx < hist.length; idx++) {
        const pxPlot =
          hist.length === 1 ? graphL + graphW : graphL + (idx / Math.max(1, HISTORY_LEN - 1)) * graphW;
        const pyPlot = graphB - Math.max(0, Math.min(1, hist[idx])) * graphH;
        if (idx === 0) ctx.moveTo(pxPlot, pyPlot);
        else ctx.lineTo(pxPlot, pyPlot);
      }
      ctx.stroke();

      // Current value marker
      const lastX = hist.length === 1 ? graphL + graphW : graphL + ((hist.length - 1) / Math.max(1, HISTORY_LEN - 1)) * graphW;
      const lastY = graphB - Math.max(0, Math.min(1, hist[hist.length - 1])) * graphH;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Badge on Φ(t) plot
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(plotX + plotW - 120, plotY + 8, 110, 22);
    ctx.fillStyle = currentPhi >= 0.75 ? '#34d399' : currentPhi >= 0.3 ? '#fbbf24' : '#fb7185';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`Φ = ${currentPhi.toFixed(3)}`, plotX + plotW - 110, plotY + 23);

    // --- Right Bottom Panel: Heading Angle Polar Rose & Mean Vector ---
    const roseX = 372;
    const roseY = 204;
    const roseW = 432;
    const roseH = 160;

    ctx.fillStyle = '#091224';
    ctx.fillRect(roseX, roseY, roseW, roseH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(roseX, roseY, roseW, roseH);

    const cxRose = roseX + 94;
    const cyRose = roseY + 84;
    const rRose = 56;

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('航向角分佈玫瑰圖', roseX + 14, roseY + 18);

    // Outer circle
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cxRose, cyRose, rRose, 0, Math.PI * 2);
    ctx.stroke();

    // Bin heading angles into 24 angular sectors
    const numBins = 24;
    const bins = new Int32Array(numBins);
    let maxBin = 1;
    for (let i = 0; i < n; i++) {
      const norm = wrapPeriodic(th[i], Math.PI * 2) / (Math.PI * 2);
      const bIdx = Math.min(numBins - 1, Math.floor(norm * numBins));
      bins[bIdx]++;
      if (bins[bIdx] > maxBin) maxBin = bins[bIdx];
    }

    const binStep = (Math.PI * 2) / numBins;
    for (let b = 0; b < numBins; b++) {
      const count = bins[b];
      if (count === 0) continue;
      const frac = count / maxBin;
      const sectorR = Math.max(5, frac * (rRose - 4));
      const a0 = b * binStep;
      const a1 = (b + 1) * binStep;
      const hue = (b / numBins) * 360;

      ctx.fillStyle = `hsla(${hue.toFixed(0)}, 85%, 60%, 0.68)`;
      ctx.beginPath();
      ctx.moveTo(cxRose, cyRose);
      ctx.arc(cxRose, cyRose, sectorR, a0, a1);
      ctx.closePath();
      ctx.fill();
    }

    // Mean collective velocity vector arrow
    const meanLen = currentPhi * (rRose - 4);
    const mx = cxRose + Math.cos(meanAngle) * meanLen;
    const my = cyRose + Math.sin(meanAngle) * meanLen;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cxRose, cyRose);
    ctx.lineTo(mx, my);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx, my, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Right side summary stats inside bottom panel
    const infoX = roseX + 184;
    const infoY = roseY + 26;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText('即時狀態參數與動力學判讀', infoX, infoY);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px monospace';
    const density = n / (BOX_SIZE * BOX_SIZE);
    ctx.fillText(`數密度 ρ = N/L² = ${density.toFixed(2)}`, infoX, infoY + 26);
    ctx.fillText(`雜訊振幅 η = ${eta.toFixed(2)} rad (±${((eta * 180) / Math.PI / 2).toFixed(0)}°)`, infoX, infoY + 46);
    ctx.fillText(`交互作用半徑 R = ${r.toFixed(2)}`, infoX, infoY + 66);

    const regime = classifyRegime(currentPhi, eta);
    ctx.fillStyle = currentPhi >= 0.78 && eta < 1.6 ? '#34d399' : currentPhi >= 0.3 ? '#fbbf24' : '#fb7185';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(regime.label, infoX, infoY + 94);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText('白線向量長度對應 Φ ∈ [0, 1]', infoX, infoY + 116);
  }, []);

  // Animation loop & immediate draw on mount / parameter update
  useEffect(() => {
    let rafId = 0;
    let frameTick = 0;

    // Draw initial frame synchronously so reducedMotion & first paint always show populated canvas
    const initPx = posXRef.current;
    const initPy = posYRef.current;
    const initTh = thetaRef.current;
    let vx0 = 0;
    let vy0 = 0;
    const initNeighbors: number[] = [];
    const halfBox = BOX_SIZE * 0.5;
    const rSq0 = radiusR * radiusR;
    for (let i = 0; i < particleCount; i++) {
      vx0 += Math.cos(initTh[i]);
      vy0 += Math.sin(initTh[i]);
      if (i > 0) {
        let dx = initPx[i] - initPx[0];
        if (dx > halfBox) dx -= BOX_SIZE;
        else if (dx < -halfBox) dx += BOX_SIZE;
        let dy = initPy[i] - initPy[0];
        if (dy > halfBox) dy -= BOX_SIZE;
        else if (dy < -halfBox) dy += BOX_SIZE;
        if (dx * dx + dy * dy <= rSq0) initNeighbors.push(i);
      }
    }
    const phi0 = Math.hypot(vx0, vy0) / particleCount;
    const ang0 = Math.atan2(vy0, vx0);
    drawCanvas(initNeighbors, phi0, ang0);

    if (!isRunning) return;

    const tick = () => {
      const result = stepVicsek();
      drawCanvas(result.focalNeighbors, result.phi, result.meanAngle);
      frameTick++;
      if (frameTick % 4 === 0) {
        setTelemetry({
          phi: result.phi,
          meanAngleDeg: ((result.meanAngle * 180) / Math.PI + 360) % 360,
          avgNeighbors: result.avgNeighbors,
          stepCount: stepCounterRef.current,
        });
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isRunning, noiseEta, particleCount, speedV0, radiusR, showNeighborhood, stepVicsek, drawCanvas]);

  const applyPreset = (presetKey: Exclude<RegimePreset, 'custom'>) => {
    const cfg = PRESETS[presetKey];
    setNoiseEta(cfg.noiseEta);
    setParticleCount(cfg.particleCount);
    setSpeedV0(cfg.speedV0);
    setRadiusR(cfg.radiusR);
    setActivePreset(presetKey);
    paramsRef.current = { ...cfg, showNeighborhood };
    seedParticles(cfg.particleCount, presetKey);
  };

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) * canvas.width) / rect.width;
    const cy = ((e.clientY - rect.top) * canvas.height) / rect.height;

    const arenaX = 16;
    const arenaY = 36;
    const arenaSize = 328;
    if (cx < arenaX || cx > arenaX + arenaSize || cy < arenaY || cy > arenaY + arenaSize) {
      return;
    }

    const simX = ((cx - arenaX) / arenaSize) * BOX_SIZE;
    const simY = ((cy - arenaY) / arenaSize) * BOX_SIZE;
    const perturbRadiusSq = 2.6 * 2.6;
    const halfBox = BOX_SIZE * 0.5;
    const newHeading = Math.random() * Math.PI * 2;
    const px = posXRef.current;
    const py = posYRef.current;
    const th = thetaRef.current;

    for (let i = 0; i < particleCount; i++) {
      let dx = px[i] - simX;
      if (dx > halfBox) dx -= BOX_SIZE;
      else if (dx < -halfBox) dx += BOX_SIZE;
      let dy = py[i] - simY;
      if (dy > halfBox) dy -= BOX_SIZE;
      else if (dy < -halfBox) dy += BOX_SIZE;

      if (dx * dx + dy * dy <= perturbRadiusSq) {
        th[i] = newHeading + (Math.random() - 0.5) * 0.25;
      }
    }

    pulseEffectRef.current = { x: simX, y: simY, ttl: 24 };
    if (!isRunning) {
      const res = stepVicsek();
      drawCanvas(res.focalNeighbors, res.phi, res.meanAngle);
      setTelemetry({
        phi: res.phi,
        meanAngleDeg: ((res.meanAngle * 180) / Math.PI + 360) % 360,
        avgNeighbors: res.avgNeighbors,
        stepCount: stepCounterRef.current,
      });
    }
  };

  const regime = classifyRegime(telemetry.phi, noiseEta);
  const densityVal = particleCount / (BOX_SIZE * BOX_SIZE);

  return (
    <div className="my-8 w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90 p-3 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-100">
              Vicsek 2D 自驅動粒子群集相變模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            調整角度雜訊 η、粒徑半徑 R 與速率 v₀，觀察無序氣體、移動密集團帶與長程有序鳥群之間的相變切換
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRunning((prev) => !prev)}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500 active:scale-95"
          >
            {isRunning ? '⏸ 暫停演化' : '▶ 繼續演化'}
          </button>
          <button
            type="button"
            onClick={() => seedParticles(particleCount, activePreset)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-95"
          >
            ↺ 重新隨機撒點
          </button>
          <button
            type="button"
            onClick={() => setShowNeighborhood((prev) => !prev)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
              showNeighborhood
                ? 'border-sky-500/70 bg-sky-950/70 text-sky-300'
                : 'border-slate-700 bg-slate-800/80 text-slate-400'
            }`}
          >
            {showNeighborhood ? '◎ 隱藏半徑 R' : '◎ 顯示半徑 R'}
          </button>
        </div>
      </div>

      {/* Preset Regimes */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyPreset('ordered')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activePreset === 'ordered'
              ? 'bg-emerald-600 text-white'
              : 'border border-slate-700 bg-slate-950/70 text-slate-300 hover:bg-slate-800'
          }`}
        >
          低雜訊同步飛行
        </button>
        <button
          type="button"
          onClick={() => applyPreset('band')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activePreset === 'band'
              ? 'bg-amber-600 text-white'
              : 'border border-slate-700 bg-slate-950/70 text-slate-300 hover:bg-slate-800'
          }`}
        >
          臨界移動密集團帶
        </button>
        <button
          type="button"
          onClick={() => applyPreset('gas')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activePreset === 'gas'
              ? 'bg-rose-600 text-white'
              : 'border border-slate-700 bg-slate-950/70 text-slate-300 hover:bg-slate-800'
          }`}
        >
          高雜訊無序氣體
        </button>
      </div>

      {/* Canvas View */}
      <div className="mt-3 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <canvas
          ref={canvasRef}
          width={820}
          height={376}
          onClick={handleCanvasClick}
          className="w-full h-auto block cursor-crosshair rounded-lg"
        />
      </div>

      {/* KPI Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">極性序參量 Φ(t)</div>
          <div className={`mt-1 font-mono text-base sm:text-lg font-bold ${regime.toneClass}`}>
            Φ = {telemetry.phi.toFixed(3)}
          </div>
          <div className="text-[10px] text-slate-500">
            平均集體航向：{telemetry.meanAngleDeg.toFixed(0)}°
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">雜訊振幅 η</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-sky-400">
            {noiseEta.toFixed(2)} rad
          </div>
          <div className="text-[10px] text-slate-500">
            等於 η/(2π) = {((noiseEta / (Math.PI * 2)) * 100).toFixed(1)}% 全圓隨機擾動
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">數密度 ρ 與鄰居數</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-amber-300">
            ρ = {densityVal.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500">
            半徑 R 內平均鄰居 ≈ {telemetry.avgNeighbors.toFixed(1)} 隻
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">目前物態判斷</div>
          <div className={`mt-1 text-xs sm:text-sm font-bold leading-snug ${regime.toneClass}`}>
            {regime.label}
          </div>
          <div className="text-[10px] text-slate-500">
            已演化 {telemetry.stepCount} 個離散時間步
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">角度雜訊振幅 η (Noise)</span>
            <span className="font-mono font-bold text-cyan-400">η = {noiseEta.toFixed(2)} rad</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={6.28}
            step={0.05}
            value={noiseEta}
            onChange={(e) => {
              setNoiseEta(parseFloat(e.target.value));
              setActivePreset('custom');
            }}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.00 (完全無雜訊)</span>
            <span>~2.20 (團帶共存區)</span>
            <span>6.28 (2π 全向隨機)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">粒子數量 N (調節密度 ρ)</span>
            <span className="font-mono font-bold text-emerald-400">N = {particleCount} 隻</span>
          </div>
          <input
            type="range"
            min={100}
            max={450}
            step={20}
            value={particleCount}
            onChange={(e) => {
              setParticleCount(parseInt(e.target.value, 10));
              setActivePreset('custom');
            }}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>100 (稀疏氣體)</span>
            <span>280 (標準密度)</span>
            <span>450 (高密度聚集)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">交互作用半徑 R</span>
            <span className="font-mono font-bold text-sky-400">R = {radiusR.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.4}
            max={1.8}
            step={0.05}
            value={radiusR}
            onChange={(e) => {
              setRadiusR(parseFloat(e.target.value));
              setActivePreset('custom');
            }}
            className="mt-2 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.40 (極短程耦合)</span>
            <span>1.00 (標準單位半徑)</span>
            <span>1.80 (大範圍視覺場)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">自驅動推進速率 v₀</span>
            <span className="font-mono font-bold text-amber-400">v₀ = {speedV0.toFixed(2)} / step</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={0.6}
            step={0.05}
            value={speedV0}
            onChange={(e) => {
              setSpeedV0(parseFloat(e.target.value));
              setActivePreset('custom');
            }}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.10 (近靜態自旋極限)</span>
            <span>0.25 (標準對流)</span>
            <span>0.60 (高速混合／團帶)</span>
          </div>
        </div>
      </div>

      {/* Explicit Model Boundary Note */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">模型簡化與物理邊界說明：</span>
        本模擬器執行二維週期性邊界條件下的標準 Vicsek 離散時間演化，個體僅依固定度量半徑 R 進行標量角雜訊平均，未包含流體或空氣動力尾流耦合，亦未納入真實歐椋鳥（<em>Sturnus vulgaris</em>）在三維開放空間中所呈現的「固定鄰居數拓撲交互作用」與邊界凝聚力。
      </div>
    </div>
  );
};
