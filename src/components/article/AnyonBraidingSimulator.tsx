import React, { useState, useEffect, useRef, useMemo } from 'react';

type AnyonType = 'abelian_laughlin' | 'non_abelian_ising';

interface BraidOperation {
  generator: string; // 'sigma1', 'sigma1_inv', 'sigma2', 'sigma2_inv', 'sigma3', 'sigma3_inv'
  label: string;
  p1: number;
  p2: number;
  clockwise: boolean;
}

export const AnyonBraidingSimulator: React.FC = () => {
  const [anyonType, setAnyonType] = useState<AnyonType>('abelian_laughlin');
  const [braidHistory, setBraidHistory] = useState<BraidOperation[]>([]);
  const [noiseLevel, setNoiseLevel] = useState<number>(0); // 0 to 1
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [animProgress, setAnimProgress] = useState<number>(1.0); // 0 to 1
  const [activeOp, setActiveOp] = useState<BraidOperation | null>(null);

  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const worldlineCanvasRef = useRef<HTMLCanvasElement>(null);

  // Quantum State Computation
  const quantumState = useMemo(() => {
    if (anyonType === 'abelian_laughlin') {
      // Abelian Laughlin nu = 1/3: each exchange adds theta = pi/3 = 60 deg, full braid adds 2*pi/3 = 120 deg
      let totalPhaseDeg = 0;
      for (const op of braidHistory) {
        const delta = op.clockwise ? 120 : -120;
        totalPhaseDeg += delta;
      }
      const normalizedPhase = ((totalPhaseDeg % 360) + 360) % 360;
      return {
        type: 'abelian' as const,
        totalPhaseDeg,
        normalizedPhase,
        wavefunctionExpr: `e^{i (${normalizedPhase}^\\circ)} |\\Psi_0\\rangle`,
      };
    } else {
      // Non-Abelian Ising anyons: 4 anyons encode 1 topological qubit (qubit states |0> and |1>)
      // Initial state |0> = (1, 0)^T
      // sigma1 acts as phase gate R = diag(e^{-i*pi/8}, e^{3i*pi/8})
      // sigma2 acts as Hadamard-like mixing in degenerate subspace!
      // R_sigma2 = 1/sqrt(2) * [[1, -i], [-i, 1]] * e^{-i*pi/8}
      let aRe = 1.0;
      let aIm = 0.0;
      let bRe = 0.0;
      let bIm = 0.0;

      for (const op of braidHistory) {
        if (op.p1 === 0 && op.p2 === 1) {
          // sigma1: changes relative phase between |0> and |1>
          const angle = op.clockwise ? Math.PI / 2 : -Math.PI / 2; // relative phase
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const newBRe = bRe * cos - bIm * sin;
          const newBIm = bRe * sin + bIm * cos;
          bRe = newBRe;
          bIm = newBIm;
        } else if (op.p1 === 1 && op.p2 === 2) {
          // sigma2: rotates between |0> and |1> (qubit superposition)
          // [a', b']^T = 1/sqrt(2) * [a - (i or -i)*b, - (i or -i)*a + b]
          const sign = op.clockwise ? 1 : -1;
          const factor = 1 / Math.SQRT2;
          // a_next = factor * (a + sign * b * i)
          // b_next = factor * (sign * a * i + b)
          const nextARe = factor * (aRe - sign * bIm);
          const nextAIm = factor * (aIm + sign * bRe);
          const nextBRe = factor * (bRe - sign * aIm);
          const nextBIm = factor * (bIm + sign * aRe);
          aRe = nextARe;
          aIm = nextAIm;
          bRe = nextBRe;
          bIm = nextBIm;
        } else if (op.p1 === 2 && op.p2 === 3) {
          // sigma3: similar phase action
          const angle = op.clockwise ? Math.PI / 2 : -Math.PI / 2;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const newBRe = bRe * cos - bIm * sin;
          const newBIm = bRe * sin + bIm * cos;
          bRe = newBRe;
          bIm = newBIm;
        }
      }

      const p0 = aRe * aRe + aIm * aIm;
      const p1 = bRe * bRe + bIm * bIm;
      const norm = Math.sqrt(p0 + p1) || 1;

      return {
        type: 'non_abelian' as const,
        p0: p0 / (norm * norm),
        p1: p1 / (norm * norm),
        stateVector: `${(aRe).toFixed(2)} |0\\rangle + ${(bRe).toFixed(2)} |1\\rangle`,
      };
    }
  }, [anyonType, braidHistory]);

  // Execute a braid operation
  const applyBraid = (p1: number, p2: number, clockwise: boolean) => {
    if (isAnimating) return;
    const genName = `σ_${p1 + 1}${clockwise ? '' : '⁻¹'}`;
    const op: BraidOperation = {
      generator: `sigma${p1 + 1}_${clockwise ? 'cw' : 'ccw'}`,
      label: genName,
      p1,
      p2,
      clockwise,
    };
    setActiveOp(op);
    setIsAnimating(true);
    setAnimProgress(0);
  };

  // Animation frame loop
  useEffect(() => {
    if (!isAnimating || !activeOp) return;
    let frameId: number;
    let startTimestamp: number | null = null;
    const duration = 500; // ms

    const step = (now: number) => {
      if (!startTimestamp) startTimestamp = now;
      const elapsed = now - startTimestamp;
      const progress = Math.min(1.0, elapsed / duration);
      setAnimProgress(progress);

      if (progress < 1.0) {
        frameId = requestAnimationFrame(step);
      } else {
        setBraidHistory((prev) => [...prev, activeOp]);
        setActiveOp(null);
        setIsAnimating(false);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [isAnimating, activeOp]);

  // Render 2D Top View Canvas
  useEffect(() => {
    const canvas = canvas2dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Quantum Hall 2D background plate
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Magnetic field vector lines (perpendicular dots)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    for (let x = 20; x < width; x += 40) {
      for (let y = 20; y < height; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Default 4 anyon positions on the 2D plane
    const basePositions = [
      { x: width * 0.2, y: height * 0.5 },
      { x: width * 0.4, y: height * 0.5 },
      { x: width * 0.6, y: height * 0.5 },
      { x: width * 0.8, y: height * 0.5 },
    ];

    // Compute animated current positions
    const currentPositions = basePositions.map((pos) => ({ ...pos }));

    if (isAnimating && activeOp) {
      const p1 = activeOp.p1;
      const p2 = activeOp.p2;
      const center = {
        x: (basePositions[p1].x + basePositions[p2].x) / 2,
        y: (basePositions[p1].y + basePositions[p2].y) / 2,
      };
      const radius = Math.abs(basePositions[p2].x - basePositions[p1].x) / 2;
      const startAngle1 = basePositions[p1].x < basePositions[p2].x ? Math.PI : 0;
      const startAngle2 = startAngle1 + Math.PI;
      const rotSign = activeOp.clockwise ? 1 : -1;
      const angleOffset = rotSign * Math.PI * animProgress;

      currentPositions[p1] = {
        x: center.x + radius * Math.cos(startAngle1 + angleOffset),
        y: center.y + radius * Math.sin(startAngle1 + angleOffset),
      };
      currentPositions[p2] = {
        x: center.x + radius * Math.cos(startAngle2 + angleOffset),
        y: center.y + radius * Math.sin(startAngle2 + angleOffset),
      };

      // Draw braiding trajectory arc
      ctx.strokeStyle = activeOp.clockwise ? 'rgba(245, 158, 11, 0.6)' : 'rgba(168, 85, 247, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Apply thermal/local noise jitter if enabled
    if (noiseLevel > 0) {
      currentPositions.forEach((pos) => {
        pos.x += (Math.random() - 0.5) * noiseLevel * 14;
        pos.y += (Math.random() - 0.5) * noiseLevel * 14;
      });
    }

    // Draw Anyons
    const colors = ['#38bdf8', '#f59e0b', '#10b981', '#ec4899'];
    currentPositions.forEach((pos, idx) => {
      // Glow ring
      const grad = ctx.createRadialGradient(pos.x, pos.y, 4, pos.x, pos.y, 22);
      grad.addColorStop(0, colors[idx]);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
      ctx.fill();

      // Core particle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors[idx];
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '600 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`A${idx + 1}`, pos.x, pos.y - 12);
    });

    // Magnetic field label
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('B ⊗ 強垂直磁場', width - 15, 20);
    ctx.fillText('ν = 2D 拓撲朗道相', width - 15, 34);
  }, [anyonType, isAnimating, animProgress, activeOp, noiseLevel]);

  // Render Worldline (3D Space-Time Braid) Canvas
  useEffect(() => {
    const canvas = worldlineCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Deep dark space-time background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    const colors = ['#38bdf8', '#f59e0b', '#10b981', '#ec4899'];
    const xBase = [width * 0.2, width * 0.4, width * 0.6, width * 0.8];

    // Compute steps in time
    const totalSteps = braidHistory.length + (isAnimating && activeOp ? 1 : 0);
    const stepHeight = Math.min(50, Math.max(26, (height - 60) / Math.max(1, totalSteps)));

    // Track particle order: which strand is currently at which x slot
    let strandAtSlot = [0, 1, 2, 3];
    let currentY = 30;

    // Time Axis arrow on left
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(30, 20);
    ctx.lineTo(30, height - 20);
    ctx.stroke();
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(26, height - 26);
    ctx.lineTo(30, height - 18);
    ctx.lineTo(34, height - 26);
    ctx.fillStyle = '#64748b';
    ctx.fill();
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('時間軸 t', 15, height - 8);

    // Draw initial strand dots
    xBase.forEach((x, slot) => {
      ctx.fillStyle = colors[slot];
      ctx.beginPath();
      ctx.arc(x, currentY, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    const drawStep = (p1Slot: number, p2Slot: number, clockwise: boolean, progress: number) => {
      const startY = currentY;
      const endY = currentY + stepHeight * progress;
      const nextStrandAtSlot = [...strandAtSlot];

      // Draw all strands
      for (let s = 0; s < 4; s++) {
        const strandId = strandAtSlot[s];
        const color = colors[strandId];

        if (s === p1Slot) {
          // p1 curves to p2
          const xStart = xBase[p1Slot];
          const xEnd = xBase[p1Slot] + (xBase[p2Slot] - xBase[p1Slot]) * progress;
          
          // Draw under/over crossing for 3D topological visual
          ctx.strokeStyle = color;
          ctx.lineWidth = clockwise ? 3.5 : 2;
          ctx.beginPath();
          ctx.moveTo(xStart, startY);
          ctx.bezierCurveTo(
            xStart,
            startY + stepHeight * 0.5 * progress,
            xEnd,
            startY + stepHeight * 0.5 * progress,
            xEnd,
            endY
          );
          ctx.stroke();
        } else if (s === p2Slot) {
          // p2 curves to p1
          const xStart = xBase[p2Slot];
          const xEnd = xBase[p2Slot] + (xBase[p1Slot] - xBase[p2Slot]) * progress;

          ctx.strokeStyle = color;
          ctx.lineWidth = clockwise ? 2 : 3.5;
          ctx.beginPath();
          ctx.moveTo(xStart, startY);
          ctx.bezierCurveTo(
            xStart,
            startY + stepHeight * 0.5 * progress,
            xEnd,
            startY + stepHeight * 0.5 * progress,
            xEnd,
            endY
          );
          ctx.stroke();
        } else {
          // Straight vertical worldline
          const x = xBase[s];
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(x, startY);
          ctx.lineTo(x, endY);
          ctx.stroke();
        }
      }

      if (progress >= 1.0) {
        // Swap slots
        const temp = nextStrandAtSlot[p1Slot];
        nextStrandAtSlot[p1Slot] = nextStrandAtSlot[p2Slot];
        nextStrandAtSlot[p2Slot] = temp;
      }
      strandAtSlot = nextStrandAtSlot;
      currentY = endY;
    };

    // Draw completed braids
    for (const op of braidHistory) {
      drawStep(op.p1, op.p2, op.clockwise, 1.0);
    }

    // Draw animating braid
    if (isAnimating && activeOp) {
      drawStep(activeOp.p1, activeOp.p2, activeOp.clockwise, animProgress);
    }

    // Draw current end dots
    strandAtSlot.forEach((strandId, slot) => {
      ctx.fillStyle = colors[strandId];
      ctx.beginPath();
      ctx.arc(xBase[slot], currentY, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    if (braidHistory.length === 0 && !isAnimating) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('點擊下方編織運算子，即時構建時空軌跡編織圖 (Braid Diagram)', width / 2, height / 2);
    }
  }, [braidHistory, isAnimating, animProgress, activeOp]);

  const resetBraid = () => {
    if (isAnimating) return;
    setBraidHistory([]);
    setActiveOp(null);
  };

  return (
    <div className="my-8 rounded-xl border border-slate-700 bg-slate-900/95 p-5 text-slate-100 shadow-2xl backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-wide text-cyan-400">
            拓撲編織與任意子量子態模擬器
          </h3>
          <p className="text-xs text-slate-400">
            二維平面粒子交換 → (2+1) 維時空世界線編織結 → 量子相角與么正矩陣旋轉
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAnyonType('abelian_laughlin');
              resetBraid();
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              anyonType === 'abelian_laughlin'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            阿貝爾 (Laughlin ν=1/3)
          </button>
          <button
            type="button"
            onClick={() => {
              setAnyonType('non_abelian_ising');
              resetBraid();
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              anyonType === 'non_abelian_ising'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            非阿貝爾 (Ising / Majorana)
          </button>
        </div>
      </div>

      {/* Dual Viewports: 2D Motion & Space-Time Braiding */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: 2D Spatial Motion in Quantum Well */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">① 二維實空間準粒子運動 (Top View)</span>
            <span>4 個局域拓撲準粒子</span>
          </div>
          <canvas
            ref={canvas2dRef}
            width={480}
            height={200}
            className="w-full rounded border border-slate-800 bg-slate-950"
          />
        </div>

        {/* Right: (2+1)D Worldline Braid Diagram */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">② 時空世界線編織結 (Space-Time Braid)</span>
            <span className="font-mono text-cyan-400">
              編織長度: {braidHistory.length} 階
            </span>
          </div>
          <canvas
            ref={worldlineCanvasRef}
            width={480}
            height={200}
            className="w-full rounded border border-slate-800 bg-slate-950"
          />
        </div>
      </div>

      {/* Quantum State Readout Box */}
      <div className="mt-4 rounded-lg border border-cyan-900/50 bg-cyan-950/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            {anyonType === 'abelian_laughlin' ? '量子統計相角積累 (Topological Phase)' : '拓撲簡併子空間態向量 (|ψ⟩)'}
          </span>
          <span className="text-xs text-slate-400">
            {anyonType === 'abelian_laughlin'
              ? '每一次逆時針交換積累 120° (2π/3)'
              : '編織操作對應非對易 Clifford 矩陣運算'}
          </span>
        </div>

        {anyonType === 'abelian_laughlin' ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded border border-slate-800 bg-slate-900/80 p-2.5">
              <div className="text-[11px] text-slate-400">累計拓撲相角</div>
              <div className="mt-1 text-xl font-mono font-bold text-cyan-300">
                {(quantumState as any).totalPhaseDeg}°
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/80 p-2.5">
              <div className="text-[11px] text-slate-400">等效正規化相角 [0, 360°)</div>
              <div className="mt-1 text-xl font-mono font-bold text-amber-300">
                {(quantumState as any).normalizedPhase}°
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/80 p-2.5">
              <div className="text-[11px] text-slate-400">波函數幾何因子</div>
              <div className="mt-1 text-sm font-mono text-emerald-400">
                {(quantumState as any).wavefunctionExpr}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between text-xs font-mono text-slate-300">
              <span>|0⟩ 機率: {(((quantumState as any).p0) * 100).toFixed(1)}%</span>
              <span>|1⟩ 機率: {(((quantumState as any).p1) * 100).toFixed(1)}%</span>
            </div>
            {/* Superposition probability bar */}
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="bg-cyan-500 transition-all duration-300"
                style={{ width: `${(quantumState as any).p0 * 100}%` }}
              />
              <div
                className="bg-purple-500 transition-all duration-300"
                style={{ width: `${(quantumState as any).p1 * 100}%` }}
              />
            </div>
            <div className="mt-2 text-center font-mono text-xs text-purple-300">
              態向量: |Ψ⟩ = {(quantumState as any).stateVector}
            </div>
          </div>
        )}
      </div>

      {/* Braiding Controls & Noise Injection */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {/* Braid generator buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">基本生成元:</span>
          <button
            type="button"
            disabled={isAnimating}
            onClick={() => applyBraid(0, 1, true)}
            className="rounded bg-slate-800 px-3 py-1.5 font-mono text-xs font-bold text-cyan-300 transition hover:bg-slate-700 disabled:opacity-50"
          >
            σ₁ (1↻2)
          </button>
          <button
            type="button"
            disabled={isAnimating}
            onClick={() => applyBraid(0, 1, false)}
            className="rounded bg-slate-800 px-3 py-1.5 font-mono text-xs font-bold text-cyan-300 transition hover:bg-slate-700 disabled:opacity-50"
          >
            σ₁⁻¹ (1↺2)
          </button>
          <button
            type="button"
            disabled={isAnimating}
            onClick={() => applyBraid(1, 2, true)}
            className="rounded bg-slate-800 px-3 py-1.5 font-mono text-xs font-bold text-amber-300 transition hover:bg-slate-700 disabled:opacity-50"
          >
            σ₂ (2↻3)
          </button>
          <button
            type="button"
            disabled={isAnimating}
            onClick={() => applyBraid(1, 2, false)}
            className="rounded bg-slate-800 px-3 py-1.5 font-mono text-xs font-bold text-amber-300 transition hover:bg-slate-700 disabled:opacity-50"
          >
            σ₂⁻¹ (2↺3)
          </button>
          <button
            type="button"
            disabled={isAnimating}
            onClick={() => applyBraid(2, 3, true)}
            className="rounded bg-slate-800 px-3 py-1.5 font-mono text-xs font-bold text-emerald-300 transition hover:bg-slate-700 disabled:opacity-50"
          >
            σ₃ (3↻4)
          </button>
          <button
            type="button"
            disabled={isAnimating}
            onClick={() => applyBraid(2, 3, false)}
            className="rounded bg-slate-800 px-3 py-1.5 font-mono text-xs font-bold text-emerald-300 transition hover:bg-slate-700 disabled:opacity-50"
          >
            σ₃⁻¹ (3↺4)
          </button>
          <button
            type="button"
            disabled={isAnimating || braidHistory.length === 0}
            onClick={resetBraid}
            className="rounded bg-rose-950/60 px-3 py-1.5 text-xs text-rose-300 transition hover:bg-rose-900/80 disabled:opacity-40"
          >
            重設編織
          </button>
        </div>

        {/* Noise Injection Toggle */}
        <div className="flex items-center gap-2">
          <label htmlFor="noise-slider" className="text-xs text-slate-400">
            局域熱擾動噪聲:
          </label>
          <input
            id="noise-slider"
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={noiseLevel}
            onChange={(e) => setNoiseLevel(parseFloat(e.target.value))}
            className="h-1.5 w-24 accent-cyan-500"
          />
          <span className="font-mono text-xs text-cyan-400">
            {noiseLevel > 0 ? `${(noiseLevel * 100).toFixed(0)}%` : '無'}
          </span>
        </div>
      </div>

      {/* Educational Note */}
      <div className="mt-4 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">拓撲保護核心原理：</span>
        即使滑動「局域熱擾動噪聲」讓準粒子的微觀幾何路徑劇烈抖動，波函數的積累相位或量子疊加態也
        <strong className="text-cyan-300">完全不發生任何漂移</strong>！
        量子資訊不是被儲存在任何單個粒子的局域坐標中，而是完全銘刻在時空軌跡所形成的整體
        <strong className="text-amber-300">拓撲編織結（Braid Knot）</strong>之中。這正是拓撲量子計算抗環境消相干的終極基石。
      </div>
    </div>
  );
};
