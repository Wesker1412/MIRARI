import React, { useState, useEffect, useRef, useMemo } from 'react';

type PauliError = 'I' | 'X' | 'Z' | 'Y';
type BrushMode = 'X' | 'Z' | 'Y' | 'clear';

interface StabilizerInfo {
  id: string;
  type: 'X' | 'Z';
  row: number;
  col: number;
  cx: number;
  cy: number;
  qubits: Array<[number, number]>;
  isBoundary: boolean;
  triggered: boolean;
}

export const SurfaceCodeSimulator: React.FC = () => {
  const [distance, setDistance] = useState<3 | 5 | 7>(5);
  const [physicalErrorRate, setPhysicalErrorRate] = useState<number>(0.0047);
  const [brushMode, setBrushMode] = useState<BrushMode>('X');
  // Seed initial errors on (1, 1) as X and (2, 3) as Z so syndromes are visible on first load
  const [errors, setErrors] = useState<Record<string, PauliError>>({
    '1,1': 'X',
    '2,3': 'Z',
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const pThreshold = 0.01; // ~1% circuit-level surface code threshold benchmark

  // Build rotated surface code stabilizer geometry and evaluate syndromes
  const surfaceState = useMemo(() => {
    const d = distance;
    const stabilizers: StabilizerInfo[] = [];

    const hasXFlip = (err: PauliError | undefined) => err === 'X' || err === 'Y';
    const hasZFlip = (err: PauliError | undefined) => err === 'Z' || err === 'Y';

    const evalParity = (type: 'X' | 'Z', qubits: Array<[number, number]>): boolean => {
      let flips = 0;
      for (const [r, c] of qubits) {
        const err = errors[`${r},${c}`];
        if (type === 'Z' && hasXFlip(err)) flips++;
        if (type === 'X' && hasZFlip(err)) flips++;
      }
      return flips % 2 === 1;
    };

    // Bulk (d-1) x (d-1) weight-4 plaquettes
    for (let r = 0; r < d - 1; r++) {
      for (let c = 0; c < d - 1; c++) {
        const type: 'X' | 'Z' = (r + c) % 2 === 0 ? 'Z' : 'X';
        const qubits: Array<[number, number]> = [
          [r, c],
          [r, c + 1],
          [r + 1, c],
          [r + 1, c + 1],
        ];
        stabilizers.push({
          id: `bulk-${r}-${c}`,
          type,
          row: r,
          col: c,
          cx: c + 0.5,
          cy: r + 0.5,
          qubits,
          isBoundary: false,
          triggered: evalParity(type, qubits),
        });
      }
    }

    // Top & Bottom weight-2 X-stabilizers (detect Z flips, terminate vertical X_L)
    for (let c = 0; c < d - 1; c++) {
      if (c % 2 === 0) {
        const qubits: Array<[number, number]> = [
          [0, c],
          [0, c + 1],
        ];
        stabilizers.push({
          id: `top-${c}`,
          type: 'X',
          row: -1,
          col: c,
          cx: c + 0.5,
          cy: -0.35,
          qubits,
          isBoundary: true,
          triggered: evalParity('X', qubits),
        });
      }
      if ((d - 1 + c) % 2 === 1) {
        const qubits: Array<[number, number]> = [
          [d - 1, c],
          [d - 1, c + 1],
        ];
        stabilizers.push({
          id: `bot-${c}`,
          type: 'X',
          row: d - 1,
          col: c,
          cx: c + 0.5,
          cy: d - 0.65,
          qubits,
          isBoundary: true,
          triggered: evalParity('X', qubits),
        });
      }
    }

    // Left & Right weight-2 Z-stabilizers (detect X flips, terminate horizontal Z_L)
    for (let r = 0; r < d - 1; r++) {
      if (r % 2 === 1) {
        const qubits: Array<[number, number]> = [
          [r, 0],
          [r + 1, 0],
        ];
        stabilizers.push({
          id: `left-${r}`,
          type: 'Z',
          row: r,
          col: -1,
          cx: -0.35,
          cy: r + 0.5,
          qubits,
          isBoundary: true,
          triggered: evalParity('Z', qubits),
        });
      }
      if ((r + d - 1) % 2 === 0) {
        const qubits: Array<[number, number]> = [
          [r, d - 1],
          [r + 1, d - 1],
        ];
        stabilizers.push({
          id: `right-${r}`,
          type: 'Z',
          row: r,
          col: d - 1,
          cx: d - 0.65,
          cy: r + 0.5,
          qubits,
          isBoundary: true,
          triggered: evalParity('Z', qubits),
        });
      }
    }

    let xErrorsCount = 0;
    let zErrorsCount = 0;
    for (let r = 0; r < d; r++) {
      for (let c = 0; c < d; c++) {
        const err = errors[`${r},${c}`];
        if (hasXFlip(err)) xErrorsCount++;
        if (hasZFlip(err)) zErrorsCount++;
      }
    }

    const zSyndromeCount = stabilizers.filter((s) => s.type === 'Z' && s.triggered).length;
    const xSyndromeCount = stabilizers.filter((s) => s.type === 'X' && s.triggered).length;

    const lambdaFactor = pThreshold / physicalErrorRate;
    const minUnrecoverable = (d + 1) / 2;
    const logicalErrorRate = Math.min(0.5, 0.03 * Math.pow(physicalErrorRate / pThreshold, minUnrecoverable));
    const isBelowThreshold = lambdaFactor > 1.0;

    return {
      stabilizers,
      xErrorsCount,
      zErrorsCount,
      zSyndromeCount,
      xSyndromeCount,
      lambdaFactor,
      logicalErrorRate,
      isBelowThreshold,
      totalPhysicalQubits: d * d + (d * d - 1),
      minUnrecoverable,
    };
  }, [distance, errors, physicalErrorRate]);

  // Draw Surface Code Lattice & Threshold Scaling Curve on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#060c1a';
    ctx.fillRect(0, 0, w, h);

    // --- Left Panel: Rotated Surface Code Checkerboard ---
    const d = distance;
    const boardArea = 250;
    const boardOriginX = 72;
    const boardOriginY = 55;
    const step = boardArea / (d - 1);

    // Title
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`旋轉表面碼格點 (d = ${d}，共 ${d * d + (d * d - 1)} 顆物理量子位元)`, 22, 24);

    // Boundary labels
    ctx.fillStyle = '#38bdf8';
    ctx.font = '10px monospace';
    ctx.fillText('X-邊界 (Z_L 垂直保護)', boardOriginX + boardArea * 0.25, boardOriginY - 26);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('Z-邊界', 14, boardOriginY + boardArea * 0.5);

    // Draw stabilizer tiles
    for (const stab of surfaceState.stabilizers) {
      const isX = stab.type === 'X';
      const baseFill = isX
        ? stab.triggered
          ? 'rgba(56, 189, 248, 0.55)'
          : 'rgba(14, 116, 144, 0.22)'
        : stab.triggered
        ? 'rgba(245, 158, 11, 0.55)'
        : 'rgba(180, 83, 9, 0.20)';

      const strokeCol = stab.triggered
        ? isX
          ? '#7dd3fc'
          : '#fcd34d'
        : isX
        ? 'rgba(56, 189, 248, 0.35)'
        : 'rgba(245, 158, 11, 0.35)';

      ctx.fillStyle = baseFill;
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = stab.triggered ? 2.2 : 1;

      if (!stab.isBoundary) {
        const x0 = boardOriginX + stab.col * step;
        const y0 = boardOriginY + stab.row * step;
        ctx.fillRect(x0, y0, step, step);
        ctx.strokeRect(x0, y0, step, step);
      } else {
        const px = boardOriginX + stab.cx * step;
        const py = boardOriginY + stab.cy * step;
        ctx.beginPath();
        ctx.arc(px, py, step * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Ancilla dot in center
      const ancX = boardOriginX + stab.cx * step;
      const ancY = boardOriginY + stab.cy * step;
      ctx.fillStyle = stab.triggered ? '#ffffff' : isX ? '#38bdf8' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(ancX, ancY, stab.triggered ? 5.5 : 3.2, 0, Math.PI * 2);
      ctx.fill();

      if (stab.triggered) {
        ctx.strokeStyle = isX ? '#38bdf8' : '#f59e0b';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(ancX, ancY, 9.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Draw Data Qubits
    for (let r = 0; r < d; r++) {
      for (let c = 0; c < d; c++) {
        const qx = boardOriginX + c * step;
        const qy = boardOriginY + r * step;
        const err = errors[`${r},${c}`] || 'I';

        ctx.fillStyle =
          err === 'X'
            ? '#f43f5e'
            : err === 'Z'
            ? '#a855f7'
            : err === 'Y'
            ? '#ec4899'
            : '#0f172a';
        ctx.strokeStyle = err === 'I' ? '#94a3b8' : '#ffffff';
        ctx.lineWidth = err === 'I' ? 1.5 : 2;
        ctx.beginPath();
        ctx.arc(qx, qy, d === 7 ? 7.5 : d === 5 ? 9.5 : 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (err !== 'I') {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${d === 7 ? 8 : 10}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(err, qx, qy + 0.5);
        }
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Legend below lattice
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('● 資料位元 (點擊注入誤差)   ■ Z穩定子 (捉X)   ■ X穩定子 (捉Z)   ◎ 亮起症候群', 20, h - 14);

    // --- Right Panel: Threshold Scaling Log Plot ε_L vs Code Distance d ---
    const plotL = 435;
    const plotR = 770;
    const plotT = 56;
    const plotB = 298;
    const plotW = plotR - plotL;
    const plotH = plotB - plotT;

    ctx.fillStyle = '#0b1326';
    ctx.fillRect(plotL, plotT, plotW, plotH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(plotL, plotT, plotW, plotH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('碼距擴張與閾值指數縮放律 log₁₀(ε_L) vs d', plotL, 24);

    // Horizontal log grid (-5 to 0 -> 10^-5 to 10^0)
    const minLog = -5;
    const maxLog = 0;
    for (let lg = minLog; lg <= maxLog; lg++) {
      const y = plotB - ((lg - minLog) / (maxLog - minLog)) * plotH;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.beginPath();
      ctx.moveTo(plotL, y);
      ctx.lineTo(plotR, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText(`10^${lg}`, plotL - 32, y + 3);
    }

    const xForD = (dVal: number) => plotL + ((dVal - 2) / 6) * plotW;
    const yForErr = (errVal: number) => {
      const clamped = Math.max(1e-5, Math.min(1, errVal));
      const lg = Math.log10(clamped);
      return plotB - ((lg - minLog) / (maxLog - minLog)) * plotH;
    };

    // Draw reference super-threshold curve (p = 1.5% > p_th)
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    [3, 5, 7].forEach((dVal, idx) => {
      const err = Math.min(0.5, 0.03 * Math.pow(0.015 / pThreshold, (dVal + 1) / 2));
      const px = xForD(dVal);
      const py = yForErr(err);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Willow benchmark curve (Λ = 2.14, d=7 at 0.143%)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    [3, 5, 7].forEach((dVal, idx) => {
      const err = 0.00143 * Math.pow(2.14, (7 - dVal) / 2);
      const px = xForD(dVal);
      const py = yForErr(err);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw current p curve
    ctx.strokeStyle = surfaceState.isBelowThreshold ? '#10b981' : '#f43f5e';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    [3, 5, 7].forEach((dVal, idx) => {
      const err = Math.min(0.5, 0.03 * Math.pow(physicalErrorRate / pThreshold, (dVal + 1) / 2));
      const px = xForD(dVal);
      const py = yForErr(err);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Points & X-axis labels
    [3, 5, 7].forEach((dVal) => {
      const err = Math.min(0.5, 0.03 * Math.pow(physicalErrorRate / pThreshold, (dVal + 1) / 2));
      const px = xForD(dVal);
      const py = yForErr(err);
      const isSelected = dVal === distance;

      ctx.fillStyle = isSelected ? '#fbbf24' : surfaceState.isBelowThreshold ? '#34d399' : '#fb7185';
      ctx.beginPath();
      ctx.arc(px, py, isSelected ? 6.5 : 4.2, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      ctx.fillStyle = isSelected ? '#fbbf24' : '#94a3b8';
      ctx.font = isSelected ? 'bold 11px monospace' : '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`d=${dVal}`, px, plotB + 16);
    });
    ctx.textAlign = 'left';

    // Plot legend
    ctx.fillStyle = '#38bdf8';
    ctx.font = '10px sans-serif';
    ctx.fillText('⋯ Willow 實測基準 (Λ=2.14)', plotL + 10, plotT + 18);
    ctx.fillStyle = '#f43f5e';
    ctx.fillText('-- 高於閾值惡化區 (p=1.5%)', plotL + 10, plotT + 34);
    ctx.fillStyle = surfaceState.isBelowThreshold ? '#34d399' : '#fb7185';
    ctx.fillText(
      `━ 當前物理誤差 p=${(physicalErrorRate * 100).toFixed(2)}% (Λ=${surfaceState.lambdaFactor.toFixed(2)})`,
      plotL + 10,
      plotT + 50
    );
  }, [distance, errors, physicalErrorRate, surfaceState]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const d = distance;
    const boardArea = 250;
    const boardOriginX = 72;
    const boardOriginY = 55;
    const step = boardArea / (d - 1);

    let closestKey: string | null = null;
    let closestDist = 22;

    for (let r = 0; r < d; r++) {
      for (let c = 0; c < d; c++) {
        const qx = boardOriginX + c * step;
        const qy = boardOriginY + r * step;
        const dist = Math.hypot(cx - qx, cy - qy);
        if (dist < closestDist) {
          closestDist = dist;
          closestKey = `${r},${c}`;
        }
      }
    }

    if (closestKey) {
      setErrors((prev) => {
        const next = { ...prev };
        if (brushMode === 'clear' || next[closestKey] === brushMode) {
          delete next[closestKey];
        } else {
          next[closestKey] = brushMode;
        }
        return next;
      });
    }
  };

  const injectRandomNoise = () => {
    const d = distance;
    const next: Record<string, PauliError> = {};
    // Amplify display probability slightly so low p still shows sample errors when testing, or use max(p, 0.04)
    const sampleProb = Math.max(physicalErrorRate * 8, 0.05);
    for (let r = 0; r < d; r++) {
      for (let c = 0; c < d; c++) {
        if (Math.random() < sampleProb) {
          const roll = Math.random();
          next[`${r},${c}`] = roll < 0.45 ? 'X' : roll < 0.9 ? 'Z' : 'Y';
        }
      }
    }
    setErrors(next);
  };

  const handleDistanceChange = (newD: 3 | 5 | 7) => {
    setDistance(newD);
    setErrors((prev) => {
      const pruned: Record<string, PauliError> = {};
      for (const [k, v] of Object.entries(prev)) {
        const [r, c] = k.split(',').map(Number);
        if (r < newD && c < newD) pruned[k] = v;
      }
      return pruned;
    });
  };

  return (
    <div className="my-8 w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90 p-3 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-100">
              表面碼（Surface Code）穩定子症候群與容錯閾值模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            點擊左側資料量子位元注入 X/Z 翻轉誤差，觀察穩定子奇偶警報與碼距 d = 3, 5, 7 指數壓制效應
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={injectRandomNoise}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500 active:scale-95"
          >
            ⚡ 隨機注入物理誤差
          </button>
          <button
            onClick={() => setErrors({})}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-95"
          >
            ↺ 清除全部誤差
          </button>
        </div>
      </div>

      {/* Canvas View */}
      <div className="mt-4 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          onClick={handleCanvasClick}
          className="w-full h-auto block cursor-pointer rounded-lg"
        />
      </div>

      {/* KPI Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">壓制因子 Λ (p<sub>th</sub>/p)</div>
          <div
            className={`mt-1 font-mono text-base sm:text-lg font-bold ${
              surfaceState.isBelowThreshold ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            Λ = {surfaceState.lambdaFactor.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500">
            {surfaceState.isBelowThreshold ? '低於閾值：指數壓制 (Λ > 1)' : '高於閾值：越糾越錯 (Λ < 1)'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">推估單循環邏輯錯誤率 ε<sub>L</sub></div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-sky-400">
            {(surfaceState.logicalErrorRate * 100).toFixed(3)}%
          </div>
          <div className="text-[10px] text-slate-500">
            需至少 {surfaceState.minUnrecoverable} 顆連續翻轉跨越邊界
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">觸發穩定子症候群</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-amber-300">
            {surfaceState.zSyndromeCount} Z / {surfaceState.xSyndromeCount} X
          </div>
          <div className="text-[10px] text-slate-500">
            已注入誤差：{surfaceState.xErrorsCount} X、{surfaceState.zErrorsCount} Z
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">物理資源總量 (d = {distance})</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-purple-300">
            {surfaceState.totalPhysicalQubits} 顆位元
          </div>
          <div className="text-[10px] text-slate-500">
            {distance * distance} 資料 + {distance * distance - 1} 輔助穩定子
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">物理位元錯誤率 p</span>
            <span className="font-mono font-bold text-cyan-400">
              {(physicalErrorRate * 100).toFixed(2)}%
            </span>
          </div>
          <input
            type="range"
            min={0.001}
            max={0.02}
            step={0.0005}
            value={physicalErrorRate}
            onChange={(e) => setPhysicalErrorRate(parseFloat(e.target.value))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.10% (極低噪聲)</span>
            <span className="text-amber-400 font-semibold">p<sub>th</sub> ≈ 1.00% 閾值</span>
            <span>2.00% (越糾越錯)</span>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">切換碼距 d 與點擊筆刷</span>
            <span className="font-mono text-slate-400">當前筆刷：{brushMode === 'clear' ? '橡皮擦' : `${brushMode} 誤差`}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([3, 5, 7] as const).map((dVal) => (
              <button
                key={dVal}
                onClick={() => handleDistanceChange(dVal)}
                className={`flex-1 min-w-[64px] rounded-md py-1 text-xs font-semibold transition ${
                  distance === dVal
                    ? 'bg-cyan-600 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                d = {dVal}
              </button>
            ))}
            {(['X', 'Z', 'Y', 'clear'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setBrushMode(mode)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  brushMode === mode
                    ? 'bg-amber-600 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {mode === 'clear' ? '擦除' : `+${mode}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
