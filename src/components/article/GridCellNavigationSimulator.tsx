import React, { useState, useEffect, useRef } from 'react';

const ARENA_CM = 180; // 180 cm x 180 cm exploration box

// Hexagonal grid firing rate via three 120-degree plane waves
function gridFiringActivity(x: number, y: number, lambdaCm: number, thetaDeg: number): number {
  const theta = (thetaDeg * Math.PI) / 180;
  const kMag = (4 * Math.PI) / (Math.sqrt(3) * lambdaCm);
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const angle = theta + (i * Math.PI) / 3;
    const kx = kMag * Math.cos(angle);
    const ky = kMag * Math.sin(angle);
    sum += Math.cos(kx * x + ky * y);
  }
  // Normalize roughly from [-1.5, 3.0] -> [0, 1]
  return Math.max(0, Math.min(1, (sum + 1.5) / 4.5));
}

export const GridCellNavigationSimulator: React.FC = () => {
  const [gridSpacing, setGridSpacing] = useState<number>(48);
  const [orientationDeg, setOrientationDeg] = useState<number>(15);
  const [driftNoise, setDriftNoise] = useState<number>(0.35);
  const [isExploring, setIsExploring] = useState<boolean>(true);
  const [renderTick, setRenderTick] = useState<number>(0);

  const [telemetry, setTelemetry] = useState<{
    driftErrorCm: number;
    spikeCount: number;
    firingRateHz: number;
  }>({ driftErrorCm: 4.2, spikeCount: 28, firingRateHz: 11.4 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const agentRef = useRef<{
    trueX: number;
    trueY: number;
    estX: number;
    estY: number;
    vx: number;
    vy: number;
  }>({
    trueX: 90,
    trueY: 90,
    estX: 94,
    estY: 88,
    vx: 1.4,
    vy: 1.0,
  });

  const pathRef = useRef<Array<{ x: number; y: number }>>([]);
  const spikesRef = useRef<Array<{ x: number; y: number }>>([]);
  const animRef = useRef<number | null>(null);

  // Seed initial foraging path & spikes so first frame is immediately informative
  const seedInitialExploration = (lam: number, deg: number) => {
    const pts: Array<{ x: number; y: number }> = [];
    const spks: Array<{ x: number; y: number }> = [];
    let x = 35;
    let y = 45;
    let ang = 0.45;
    for (let i = 0; i < 180; i++) {
      ang += Math.sin(i * 0.17) * 0.18 + Math.cos(i * 0.09) * 0.1;
      x += Math.cos(ang) * 2.2;
      y += Math.sin(ang) * 2.2;
      if (x < 12 || x > ARENA_CM - 12) {
        ang = Math.PI - ang;
        x = Math.max(12, Math.min(ARENA_CM - 12, x));
      }
      if (y < 12 || y > ARENA_CM - 12) {
        ang = -ang;
        y = Math.max(12, Math.min(ARENA_CM - 12, y));
      }
      pts.push({ x, y });
      const act = gridFiringActivity(x, y, lam, deg);
      if (act > 0.78 && i % 2 === 0) {
        spks.push({ x, y });
      }
    }
    pathRef.current = pts;
    spikesRef.current = spks;
    agentRef.current = {
      trueX: x,
      trueY: y,
      estX: x + 4.0,
      estY: y - 2.0,
      vx: Math.cos(ang) * 1.6,
      vy: Math.sin(ang) * 1.6,
    };
  };

  useEffect(() => {
    seedInitialExploration(48, 15);
  }, []);

  // Exploration & Path Integration loop
  useEffect(() => {
    if (!isExploring) return;
    let frame = 0;

    const loop = () => {
      const ag = agentRef.current;
      // Smooth persistent random turn
      const turn = (Math.random() - 0.5) * 0.28;
      const cosT = Math.cos(turn);
      const sinT = Math.sin(turn);
      let nvx = ag.vx * cosT - ag.vy * sinT;
      let nvy = ag.vx * sinT + ag.vy * cosT;

      const speed = Math.hypot(nvx, nvy) || 1.7;
      nvx = (nvx / speed) * 1.65;
      nvy = (nvy / speed) * 1.65;

      let nx = ag.trueX + nvx;
      let ny = ag.trueY + nvy;

      if (nx < 10 || nx > ARENA_CM - 10) {
        nvx = -nvx;
        nx = Math.max(10, Math.min(ARENA_CM - 10, nx));
      }
      if (ny < 10 || ny > ARENA_CM - 10) {
        nvy = -nvy;
        ny = Math.max(10, Math.min(ARENA_CM - 10, ny));
      }

      // Internal path integrator sees true velocity + cumulative drift noise
      const noiseScale = driftNoise * 0.35;
      const ex = ag.estX + nvx + (Math.random() - 0.5) * noiseScale;
      const ey = ag.estY + nvy + (Math.random() - 0.5) * noiseScale;

      agentRef.current = {
        trueX: nx,
        trueY: ny,
        estX: ex,
        estY: ey,
        vx: nvx,
        vy: nvy,
      };

      pathRef.current.push({ x: nx, y: ny });
      if (pathRef.current.length > 420) pathRef.current.shift();

      // Grid cell fires according to internal path-integrated position (estX, estY)
      const act = gridFiringActivity(ex, ey, gridSpacing, orientationDeg);
      if (act > 0.76 && Math.random() < (act - 0.65) * 1.8) {
        spikesRef.current.push({ x: nx, y: ny });
        if (spikesRef.current.length > 260) spikesRef.current.shift();
      }

      frame++;
      if (frame % 3 === 0) {
        const drift = Math.hypot(ex - nx, ey - ny);
        setTelemetry({
          driftErrorCm: drift,
          spikeCount: spikesRef.current.length,
          firingRateHz: act * 22.0,
        });
        setRenderTick((t) => t + 1);
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isExploring, gridSpacing, orientationDeg, driftNoise]);

  // Render Arena (Left) and Toroidal CAN Sheet + Multi-scale Modules (Right)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#060a15';
    ctx.fillRect(0, 0, w, h);

    // --- Left Panel: Spatial Exploration Arena ---
    const arenaX = 24;
    const arenaY = 38;
    const arenaSize = 300;
    const cmToPx = arenaSize / ARENA_CM;

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('探索箱六角放電場與脈衝軌跡 (點擊可導引移動)', arenaX, 22);

    // Draw hexagonal firing field heatmap
    const res = 50;
    const cellPx = arenaSize / res;
    for (let r = 0; r < res; r++) {
      for (let c = 0; c < res; c++) {
        const xCm = ((c + 0.5) / res) * ARENA_CM;
        const yCm = ((r + 0.5) / res) * ARENA_CM;
        const act = gridFiringActivity(xCm, yCm, gridSpacing, orientationDeg);
        const alpha = act > 0.55 ? (act - 0.55) * 1.1 : 0.04;
        ctx.fillStyle = `rgba(16, 185, 129, ${alpha.toFixed(3)})`;
        ctx.fillRect(arenaX + c * cellPx, arenaY + r * cellPx, cellPx + 0.5, cellPx + 0.5);
      }
    }

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(arenaX, arenaY, arenaSize, arenaSize);

    // Trajectory
    const pts = pathRef.current;
    if (pts.length > 1) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const px = arenaX + p.x * cmToPx;
        const py = arenaY + p.y * cmToPx;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    // Recorded spikes
    for (const spk of spikesRef.current) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(arenaX + spk.x * cmToPx, arenaY + spk.y * cmToPx, 2.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // True agent vs drifted path-integration estimate
    const ag = agentRef.current;
    const tx = arenaX + ag.trueX * cmToPx;
    const ty = arenaY + ag.trueY * cmToPx;
    const ex = arenaX + Math.max(0, Math.min(ARENA_CM, ag.estX)) * cmToPx;
    const ey = arenaY + Math.max(0, Math.min(ARENA_CM, ag.estY)) * cmToPx;

    if (Math.hypot(ex - tx, ey - ty) > 2) {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.8)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey, 5.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(tx, ty, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('● 真實位置   ○ 路徑積分推算(漂移)   ● 網格放電脈衝', arenaX, arenaY + arenaSize + 16);

    // --- Right Top: Toroidal Continuous Attractor Network (CAN) Sheet ---
    const canX = 385;
    const canY = 38;
    const canW = 385;
    const canH = 195;

    ctx.fillStyle = '#0b1222';
    ctx.fillRect(canX, canY, canW, canH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(canX, canY, canW, canH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('連續吸引子網路（CAN）環面拓撲神經活動峰', canX, 22);

    // Map internal estimated coordinates onto periodic toroidal sheet
    const nxRes = 40;
    const nyRes = 22;
    const nCellW = canW / nxRes;
    const nCellH = canH / nyRes;

    const phaseX = (((ag.estX % gridSpacing) + gridSpacing) % gridSpacing) / gridSpacing;
    const phaseY = (((ag.estY % gridSpacing) + gridSpacing) % gridSpacing) / gridSpacing;

    for (let r = 0; r < nyRes; r++) {
      for (let c = 0; c < nxRes; c++) {
        const u = (c + 0.5) / nxRes;
        const v = (r + 0.5) / nyRes;
        // Periodic toroidal distance on [0,1)^2
        const dx = Math.min(Math.abs(u - phaseX), 1 - Math.abs(u - phaseX));
        const dy = Math.min(Math.abs(v - phaseY), 1 - Math.abs(v - phaseY));
        const distSq = dx * dx + dy * dy;
        const bump = Math.exp(-distSq / 0.025);

        const lum = Math.round(18 + bump * 215);
        const green = Math.round(25 + bump * 175);
        const blue = Math.round(48 + bump * 207);
        ctx.fillStyle = `rgb(${Math.round(lum * 0.25)}, ${green}, ${blue})`;
        ctx.fillRect(canX + c * nCellW, canY + r * nCellH, nCellW + 0.5, nCellH + 0.5);
      }
    }

    // Wrap-around torus arrows indicator
    ctx.fillStyle = '#7dd3fc';
    ctx.font = '10px monospace';
    ctx.fillText('⇄ 左右首尾相接 (環面週期 0 ↔ 2π)', canX + 8, canY + canH - 8);

    // --- Right Bottom: Multi-scale Discrete Modules (√2 progression) ---
    const modX = 385;
    const modY = 258;
    const modW = 385;
    const modH = 80;

    ctx.fillStyle = '#0b1222';
    ctx.fillRect(modX, modY, modW, modH);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(modX, modY, modW, modH);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('多尺度離散模組 (λ 呈 ≈ √2 倍級距展開，消除週期混疊)', modX, modY - 8);

    const scales = [
      { label: 'M1 (當前)', val: gridSpacing, col: '#10b981' },
      { label: 'M2 (×√2)', val: gridSpacing * Math.SQRT2, col: '#38bdf8' },
      { label: 'M3 (×2.0)', val: gridSpacing * 2, col: '#a855f7' },
    ];

    scales.forEach((sc, idx) => {
      const rowY = modY + 12 + idx * 22;
      const barW = Math.min(230, (sc.val / 180) * 230);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(sc.label, modX + 10, rowY + 11);

      ctx.fillStyle = sc.col;
      ctx.fillRect(modX + 85, rowY + 2, barW, 11);

      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`${sc.val.toFixed(1)} cm`, modX + 92 + barW, rowY + 11);
    });
  }, [renderTick, gridSpacing, orientationDeg, driftNoise]);

  const handleArenaClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const arenaX = 24;
    const arenaY = 38;
    const arenaSize = 300;
    if (cx >= arenaX && cx <= arenaX + arenaSize && cy >= arenaY && cy <= arenaY + arenaSize) {
      const targetX = ((cx - arenaX) / arenaSize) * ARENA_CM;
      const targetY = ((cy - arenaY) / arenaSize) * ARENA_CM;
      const ag = agentRef.current;
      const dx = targetX - ag.trueX;
      const dy = targetY - ag.trueY;
      const dist = Math.hypot(dx, dy) || 1;
      agentRef.current = {
        ...ag,
        trueX: targetX,
        trueY: targetY,
        estX: ag.estX + dx,
        estY: ag.estY + dy,
        vx: (dx / dist) * 1.65,
        vy: (dy / dist) * 1.65,
      };
      pathRef.current.push({ x: targetX, y: targetY });
      setRenderTick((t) => t + 1);
    }
  };

  const resetDriftWithBorderCell = () => {
    const ag = agentRef.current;
    agentRef.current = {
      ...ag,
      estX: ag.trueX,
      estY: ag.trueY,
    };
    setTelemetry((prev) => ({ ...prev, driftErrorCm: 0 }));
    setRenderTick((t) => t + 1);
  };

  const clearTrace = () => {
    pathRef.current = [{ x: agentRef.current.trueX, y: agentRef.current.trueY }];
    spikesRef.current = [];
    setTelemetry((prev) => ({ ...prev, spikeCount: 0 }));
    setRenderTick((t) => t + 1);
  };

  return (
    <div className="my-8 w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90 p-3 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-100">
              內嗅皮層網格細胞與環面路徑積分模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            調整六角網格間距 λ、朝向角 θ 與積分雜訊，觀察空間脈衝晶格與環面吸引子活動峰的同步移動
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsExploring(!isExploring)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 active:scale-95"
          >
            {isExploring ? '⏸ 暫停探索' : '▶ 繼續探索'}
          </button>
          <button
            onClick={resetDriftWithBorderCell}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500 active:scale-95"
          >
            🧱 邊界細胞相位重設
          </button>
          <button
            onClick={clearTrace}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            ↺ 清空脈衝
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="mt-4 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          onClick={handleArenaClick}
          className="w-full h-auto block cursor-pointer rounded-lg"
        />
      </div>

      {/* KPI Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">網格間距 λ (模組 M1)</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-emerald-400">
            {gridSpacing} cm
          </div>
          <div className="text-[10px] text-slate-500">
            M2 ≈ {(gridSpacing * Math.SQRT2).toFixed(1)} cm (×√2)
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">晶格朝向角 θ</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-sky-400">
            {orientationDeg}°
          </div>
          <div className="text-[10px] text-slate-500">六角主軸對稱週期 60°</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">路徑積分累積漂移</div>
          <div
            className={`mt-1 font-mono text-base sm:text-lg font-bold ${
              telemetry.driftErrorCm > 15 ? 'text-rose-400' : 'text-amber-300'
            }`}
          >
            {telemetry.driftErrorCm.toFixed(1)} cm
          </div>
          <div className="text-[10px] text-slate-500">
            雜訊強度 σ<sub>v</sub> = {driftNoise.toFixed(2)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">即時神經放電率</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-purple-300">
            {telemetry.firingRateHz.toFixed(1)} Hz
          </div>
          <div className="text-[10px] text-slate-500">已紀錄脈衝：{telemetry.spikeCount} 次</div>
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">網格間距 λ</span>
            <span className="font-mono font-bold text-emerald-400">{gridSpacing} cm</span>
          </div>
          <input
            type="range"
            min={30}
            max={90}
            step={2}
            value={gridSpacing}
            onChange={(e) => setGridSpacing(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>30 cm (背側高解析)</span>
            <span>90 cm (腹側大尺度)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">網格朝向角 θ</span>
            <span className="font-mono font-bold text-sky-400">{orientationDeg}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={60}
            step={1}
            value={orientationDeg}
            onChange={(e) => setOrientationDeg(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0°</span>
            <span>30°</span>
            <span>60° (六角對稱)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">路徑積分噪聲漂移 σ<sub>v</sub></span>
            <span className="font-mono font-bold text-rose-400">{driftNoise.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={driftNoise}
            onChange={(e) => setDriftNoise(parseFloat(e.target.value))}
            className="mt-2 w-full accent-rose-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.00 (無雜訊)</span>
            <span>1.50 (黑暗快速失真)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
