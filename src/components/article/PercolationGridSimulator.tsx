import React, { useState, useEffect, useRef, useMemo } from 'react';

export const PercolationGridSimulator: React.FC = () => {
  const [p, setP] = useState<number>(0.59); // 佔據機率，接近二維點滲流臨界點 pc ≈ 0.592746
  const [gridSize, setGridSize] = useState<number>(24); // 24x24 格點
  const [seed, setSeed] = useState<number>(42);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 二維方格點滲流理論臨界值 pc
  const pc_theory = 0.592746;

  // 使用 Union-Find (不相交集合並查集) 求解連通團簇
  const percolationResult = useMemo(() => {
    const N = gridSize;
    const totalSites = N * N;

    // 偽隨機生成佔據晶格 (以 seed 為基底)
    let pseudoRand = seed;
    const lcg = () => {
      pseudoRand = (pseudoRand * 1664525 + 1013904223) % 4294967296;
      return pseudoRand / 4294967296;
    };

    const occupied = new Uint8Array(totalSites);
    for (let i = 0; i < totalSites; i++) {
      occupied[i] = lcg() < p ? 1 : 0;
    }

    // 建立 Union-Find 結構
    const parent = new Int32Array(totalSites);
    const size = new Int32Array(totalSites);
    for (let i = 0; i < totalSites; i++) {
      parent[i] = i;
      size[i] = 1;
    }

    const find = (i: number): number => {
      let root = i;
      while (root !== parent[root]) {
        root = parent[root];
      }
      let curr = i;
      while (curr !== root) {
        const nxt = parent[curr];
        parent[curr] = root;
        curr = nxt;
      }
      return root;
    };

    const union = (i: number, j: number) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        if (size[rootI] < size[rootJ]) {
          parent[rootI] = rootJ;
          size[rootJ] += size[rootI];
        } else {
          parent[rootJ] = rootI;
          size[rootI] += size[rootJ];
        }
      }
    };

    // 連通相鄰四鄰域佔據晶格
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const idx = r * N + c;
        if (!occupied[idx]) continue;

        // 右鄰
        if (c + 1 < N && occupied[idx + 1]) {
          union(idx, idx + 1);
        }
        // 下鄰
        if (r + 1 < N && occupied[idx + N]) {
          union(idx, idx + N);
        }
      }
    }

    // 檢查是否有頂部到底部的貫穿團簇 (Percolating Cluster)
    const topRoots = new Set<number>();
    for (let c = 0; c < N; c++) {
      if (occupied[c]) {
        topRoots.add(find(c));
      }
    }

    let isPercolating = false;
    let percolatingRoot = -1;
    for (let c = 0; c < N; c++) {
      const bIdx = (N - 1) * N + c;
      if (occupied[bIdx]) {
        const root = find(bIdx);
        if (topRoots.has(root)) {
          isPercolating = true;
          percolatingRoot = root;
          break;
        }
      }
    }

    // 統計團簇尺寸與最大團簇強度 P_inf
    let maxClusterSize = 0;
    let occupiedCount = 0;
    for (let i = 0; i < totalSites; i++) {
      if (occupied[i]) {
        occupiedCount++;
        const r = find(i);
        if (size[r] > maxClusterSize) {
          maxClusterSize = size[r];
        }
      }
    }

    const pInf = occupiedCount > 0 ? (isPercolating ? size[percolatingRoot] / occupiedCount : 0) : 0;
    const maxClusterRatio = occupiedCount > 0 ? maxClusterSize / occupiedCount : 0;

    return {
      occupied,
      parent,
      find,
      isPercolating,
      percolatingRoot,
      pInf,
      maxClusterSize,
      maxClusterRatio,
      occupiedCount,
      totalSites,
    };
  }, [p, gridSize, seed]);

  // 繪製晶格與相變 S 曲線
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // 1. 左側：二維佔據晶格地圖 (寬度 width * 0.52)
    const N = gridSize;
    const gridPixelArea = Math.min(width * 0.5, height - 30);
    const cellSize = gridPixelArea / N;
    const gridStartX = 20;
    const gridStartY = (height - gridPixelArea) / 2;

    // 團簇配色映射 (生成確定性顏色)
    const getColorForRoot = (root: number, isPerc: boolean): string => {
      if (isPerc) return '#38bdf8'; // 貫穿無限團簇以明亮天藍色標示
      // 其餘有限團簇生成柔和低對比隨機色彩
      const hue = (root * 137.5) % 360;
      return `hsl(${hue}, 60%, 45%)`;
    };

    // 晶格背景底色
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(gridStartX - 2, gridStartY - 2, gridPixelArea + 4, gridPixelArea + 4);

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const idx = r * N + c;
        const x = gridStartX + c * cellSize;
        const y = gridStartY + r * cellSize;

        if (percolationResult.occupied[idx]) {
          const root = percolationResult.find(idx);
          const isPartOfPercolating = percolationResult.isPercolating && root === percolationResult.percolatingRoot;
          ctx.fillStyle = getColorForRoot(root, isPartOfPercolating);
          ctx.fillRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
        } else {
          ctx.fillStyle = '#1e293b'; // 空白未佔據微元
          ctx.fillRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
        }
      }
    }

    // 頂部與底部電流通路標示線
    ctx.strokeStyle = percolationResult.isPercolating ? '#38bdf8' : '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gridStartX, gridStartY - 4);
    ctx.lineTo(gridStartX + gridPixelArea, gridStartY - 4);
    ctx.moveTo(gridStartX, gridStartY + gridPixelArea + 4);
    ctx.lineTo(gridStartX + gridPixelArea, gridStartY + gridPixelArea + 4);
    ctx.stroke();

    // 2. 右側：巨型團簇強度 P_inf(p) 臨界 S 曲線 (寬度 width * 0.42)
    const chartLeft = width * 0.58;
    const chartRight = width * 0.95;
    const chartTop = 40;
    const chartBottom = height - 45;
    const chartWidth = chartRight - chartLeft;
    const chartHeight = chartBottom - chartTop;

    // 繪製座標系與網格
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = chartTop + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(chartLeft, chartTop);
    ctx.lineTo(chartLeft, chartBottom);
    ctx.lineTo(chartRight, chartBottom);
    ctx.stroke();

    // 坐標標籤
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText('貫穿團簇強度 P_inf(p)', chartLeft - 5, chartTop - 12);
    ctx.fillText('佔據機率 p', chartRight - 60, chartBottom + 25);
    ctx.fillText('0.0', chartLeft, chartBottom + 16);
    ctx.fillText('0.5', chartLeft + chartWidth * 0.5, chartBottom + 16);
    ctx.fillText('1.0', chartRight - 15, chartBottom + 16);

    // 標記臨界點 pc ≈ 0.5927
    const pcX = chartLeft + pc_theory * chartWidth;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pcX, chartTop);
    ctx.lineTo(pcX, chartBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`pc ≈ 0.593`, pcX - 25, chartTop + 14);

    // 繪製理論臨界 S 曲線 P_inf = (p - pc)^beta for p > pc (beta ≈ 5/36 = 0.1389 in 2D)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const beta = 5 / 36;
    for (let px = 0; px <= chartWidth; px++) {
      const currP = px / chartWidth;
      let val = 0;
      if (currP > pc_theory) {
        val = Math.pow((currP - pc_theory) / (1 - pc_theory), beta);
      }
      const yPix = chartBottom - val * chartHeight;
      if (px === 0) ctx.moveTo(chartLeft + px, yPix);
      else ctx.lineTo(chartLeft + px, yPix);
    }
    ctx.stroke();

    // 當前 p 的游標與數值點
    const currentPx = chartLeft + p * chartWidth;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(currentPx, chartTop);
    ctx.lineTo(currentPx, chartBottom);
    ctx.stroke();

    // 當前實測 pInf 點
    const measuredY = chartBottom - percolationResult.pInf * chartHeight;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(currentPx, measuredY, 5, 0, Math.PI * 2);
    ctx.fill();

  }, [percolationResult, p, gridSize]);

  // 動態掃描機率 p 體驗相變湧現
  useEffect(() => {
    if (!isAnimating) return;

    let dir = 0.005;
    const interval = setInterval(() => {
      setP((prev) => {
        let nxt = prev + dir;
        if (nxt >= 0.85) dir = -0.005;
        if (nxt <= 0.35) dir = 0.005;
        return parseFloat(nxt.toFixed(3));
      });
    }, 40);

    return () => clearInterval(interval);
  }, [isAnimating]);

  const randomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 100000));
  };

  return (
    <div className="my-8 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-md">
      {/* 頂部標題 */}
      <div className="flex flex-col gap-2 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-sky-400 animate-pulse" />
            <h3 className="text-lg font-bold tracking-wide text-slate-100">
              Percolation（滲流理論）晶格幾何相變與臨界連通模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            即時解算二維點滲流臨界機率 \(p_c \approx 0.5927\) 與無限團簇湧現之普適相變
          </p>
        </div>

        {/* 控制按鈕 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAnimating(!isAnimating)}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500 active:scale-95"
          >
            {isAnimating ? '⏸ 停止自動掃描' : '▶ 連續掃描 p'}
          </button>
          <button
            onClick={randomizeSeed}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
            title="生成全新隨機晶格排布"
          >
            <span>🔀 換個隨機種子</span>
          </button>
        </div>
      </div>

      {/* 畫布視圖 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={320}
          className="h-64 w-full object-contain sm:h-72"
        />
      </div>

      {/* 核心指標監控 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>🌐 全域貫穿狀態 (Percolating)</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`font-mono text-base font-bold ${
                percolationResult.isPercolating ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {percolationResult.isPercolating ? '已連通 (通路開放)' : '未貫穿 (孤島斷路)'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500">
            {p >= pc_theory ? '處於超臨界超導通相 (p > pc)' : '處於亞臨界阻斷相 (p < pc)'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>📈 無限團簇強度 \(P_\infty\)</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-emerald-300">
            {(percolationResult.pInf * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500">
            最大團簇佔據點數: {percolationResult.maxClusterSize}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>🧱 晶格充填率</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-amber-300">
            {percolationResult.occupiedCount} / {percolationResult.totalSites}
          </div>
          <div className="text-[10px] text-slate-500">
            實測密度: {((percolationResult.occupiedCount / percolationResult.totalSites) * 100).toFixed(1)}%
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>🎯 臨界距離 \(p - p_c\)</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-rose-300">
            {(p - pc_theory >= 0 ? '+' : '') + (p - pc_theory).toFixed(4)}
          </div>
          <div className="text-[10px] text-slate-500">
            理論臨界點 \(p_c \approx 0.5927\)
          </div>
        </div>
      </div>

      {/* 滑桿與設定 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">佔據機率 \(p\)</span>
            <span className="font-mono font-bold text-sky-400">{p.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={0.9}
            step={0.005}
            value={p}
            onChange={(e) => setP(parseFloat(e.target.value))}
            className="mt-2 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.20 (分散小孤島)</span>
            <span className="font-semibold text-rose-400">pc = 0.593 (劇烈相變)</span>
            <span>0.90 (緻密導通網)</span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">晶格解析度 ({gridSize} × {gridSize})</span>
            <span className="font-mono text-slate-400">{gridSize * gridSize} 頂點</span>
          </div>
          <div className="mt-2 flex gap-2">
            {[16, 24, 32, 40].map((size) => (
              <button
                key={size}
                onClick={() => setGridSize(size)}
                className={`flex-1 rounded py-1 text-xs font-semibold transition ${
                  gridSize === size
                    ? 'bg-sky-600 text-white'
                    : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {size}²
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 原理說明 */}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400">
        <span className="mt-0.5 text-sky-400">ℹ️</span>
        <p className="leading-relaxed">
          <strong className="text-slate-200">幾何相變與普適性（Universality）：</strong>
          滲流理論是統計物理學中最純粹的連續相變模型。當隨機佔據率 \(p\) 跨過臨界閾值 \(p_c\) 的一瞬間，無數零散孤立的微觀團簇突然以爆發式速度「突變」結合成貫穿整個巨觀系統的無限團簇（藍色標註）。臨界指數 \(\beta = 5/36\) 與關聯長度發散指數 \(\nu = 4/3\) 完全獨立於晶格具體幾何細節，深刻揭示了多孔岩石油氣滲透、森林火災蔓延、凝膠化反應（Gelation）以及疫情群聚感染臨界閾值的普適幾何規律。
        </p>
      </div>
    </div>
  );
};
