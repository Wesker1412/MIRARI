import React, { useState, useEffect, useRef, useMemo } from 'react';

export const ProteinFoldingFunnelSimulator: React.FC = () => {
  // 系統歸一化溫度 T / T_f (0.5 到 1.5)
  const [temperatureRatio, setTemperatureRatio] = useState<number>(0.90);
  // 能量漏斗粗糙受挫度 Delta E / k_B T (0.2 到 2.5)
  const [frustrationRoughness, setFrustrationRoughness] = useState<number>(0.8);
  // 模擬粒子系綜
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  // 突變最佳化模式
  const [isSequenceOptimized, setIsSequenceOptimized] = useState<boolean>(true);

  // 當前天然接觸比例 Q (0 到 1)
  const [nativeContactQ, setNativeContactQ] = useState<number>(0.2);
  const [foldingStatus, setFoldingStatus] = useState<string>('隨機無規捲曲 (Unfolded Coil)');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trajectoryRef = useRef<{ q: number; energy: number }[]>([]);
  const animRef = useRef<number | null>(null);

  // 熱力學指標計算
  const thermodynamics = useMemo(() => {
    // 折疊自由能差 Delta F = Delta E - T * Delta S
    // Q 從 0 變為 1: 能量下降 E_native, 構象熵下降 S_conf
    const eNative = isSequenceOptimized ? -48 : -32; // kcal/mol
    const deltaS = -38; // cal/(mol K)
    const T_Kelvin = 300 * temperatureRatio;
    const deltaF = (eNative - (T_Kelvin * deltaS) / 1000);

    // 折疊半衰期估算 (阿瑞尼斯 / 克喇默斯逃逸率)
    const barrier = Math.max(1.2, (frustrationRoughness * 4) + (temperatureRatio > 1.1 ? 6 : 0));
    const foldingTimeMs = Math.min(9999, Math.round(Math.exp(barrier / (temperatureRatio * 0.8)) * 0.25));

    return {
      deltaF_kcal: deltaF.toFixed(1),
      freeEnergyBarrier: barrier.toFixed(1),
      foldingTimeMs: foldingTimeMs,
      entropyRatio: ((1 - nativeContactQ) * 100).toFixed(0),
    };
  }, [temperatureRatio, frustrationRoughness, isSequenceOptimized, nativeContactQ]);

  // 即時郎之萬動力學在粗糙漏斗景觀中的隨機漫步
  useEffect(() => {
    if (!isSimulating) return;

    let q = nativeContactQ;
    const loop = () => {
      // 自由能梯度: dF/dQ
      // 漏斗具有向 Q=1 驅動的斜率，但受溫度與粗糙能壘阻礙
      const slope = isSequenceOptimized ? 2.8 : 1.6;
      // 粗糙受挫產生的微觀能阱 (波紋)
      const roughnessForce = frustrationRoughness * Math.sin(q * Math.PI * 16) * 1.8;
      // 熱擾動隨機力
      const thermalKick = (Math.random() - 0.5) * (temperatureRatio * 0.08);

      // 當溫度高於 Tf (temperatureRatio > 1.05)，熵驅動使向 Q=0 展開
      const entropyBias = temperatureRatio > 1.05 ? -(temperatureRatio - 1.0) * 2.2 : 0;

      // 郎之萬過阻尼位移
      const dq = (slope - roughnessForce + entropyBias) * 0.008 + thermalKick;
      q = Math.max(0.02, Math.min(0.98, q + dq));

      setNativeContactQ(q);

      // 判定當前結構狀態
      if (q > 0.85) {
        setFoldingStatus('天然功能構象 (Native Folded State)');
      } else if (q > 0.45) {
        setFoldingStatus('熔球態中間體 (Molten Globule Intermediate)');
      } else if (frustrationRoughness > 1.8 && q > 0.3 && q < 0.7) {
        setFoldingStatus('錯折疊動力學深阱 (Misfolded Kinetic Trap)');
      } else {
        setFoldingStatus('無規去折疊捲曲 (Denatured Coil)');
      }

      // 紀錄軌跡歷史
      const currentEnergy = -q * 25 + frustrationRoughness * 4 * Math.sin(q * 10);
      trajectoryRef.current.push({ q, energy: currentEnergy });
      if (trajectoryRef.current.length > 120) {
        trajectoryRef.current.shift();
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isSimulating, temperatureRatio, frustrationRoughness, isSequenceOptimized]);

  // 繪製自由能漏斗剖面、構象群分佈與時間軌跡
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 深邃背景
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    // 1. 左半部：2D/3D 投影「自由能漏斗」（Folding Funnel）
    const funnelCenterX = w * 0.28;
    const funnelTopY = 35;
    const funnelBottomY = h - 35;
    const funnelHeight = funnelBottomY - funnelTopY;
    const funnelTopRadius = 130;
    const funnelBottomRadius = 14;

    // 漏斗外輪廓填充
    const funnelGrad = ctx.createLinearGradient(funnelCenterX, funnelTopY, funnelCenterX, funnelBottomY);
    funnelGrad.addColorStop(0, 'rgba(30, 41, 59, 0.4)');
    funnelGrad.addColorStop(0.6, 'rgba(15, 23, 42, 0.8)');
    funnelGrad.addColorStop(1, 'rgba(16, 185, 129, 0.2)');

    ctx.fillStyle = funnelGrad;
    ctx.beginPath();
    ctx.moveTo(funnelCenterX - funnelTopRadius, funnelTopY);
    ctx.bezierCurveTo(
      funnelCenterX - funnelTopRadius * 0.6,
      funnelTopY + funnelHeight * 0.5,
      funnelCenterX - funnelBottomRadius * 1.5,
      funnelBottomY - funnelHeight * 0.2,
      funnelCenterX - funnelBottomRadius,
      funnelBottomY
    );
    ctx.lineTo(funnelCenterX + funnelBottomRadius, funnelBottomY);
    ctx.bezierCurveTo(
      funnelCenterX + funnelBottomRadius * 1.5,
      funnelBottomY - funnelHeight * 0.2,
      funnelCenterX + funnelTopRadius * 0.6,
      funnelTopY + funnelHeight * 0.5,
      funnelCenterX + funnelTopRadius,
      funnelTopY
    );
    ctx.closePath();
    ctx.fill();

    // 漏斗等能級等高線 (含粗糙受挫波紋)
    for (let f = 0.15; f <= 0.85; f += 0.18) {
      const curY = funnelTopY + f * funnelHeight;
      const curR = funnelTopRadius * (1 - f * 0.85);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(funnelCenterX, curY, curR, curR * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 粗糙受挫能阱 (Kinetic Traps) 浮凸紋理
    ctx.strokeStyle = frustrationRoughness > 1.2 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.5;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      for (let py = funnelTopY; py <= funnelBottomY; py += 3) {
        const normY = (py - funnelTopY) / funnelHeight;
        const radius = funnelTopRadius * (1 - normY * 0.85);
        // 疊加高頻粗糙受挫起伏
        const ripple = Math.sin(normY * Math.PI * 14) * (frustrationRoughness * 6);
        const px = funnelCenterX + side * (radius + ripple);
        if (py === funnelTopY) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // 當前多肽質點在漏斗中的動態座標
    const curNormY = nativeContactQ;
    const curRadius = funnelTopRadius * (1 - curNormY * 0.85);
    const particleAngle = performance.now() * 0.002;
    const particleX = funnelCenterX + Math.cos(particleAngle) * (curRadius * 0.65);
    const particleY = funnelTopY + curNormY * funnelHeight;

    // 繪製質點與光暈
    ctx.fillStyle = nativeContactQ > 0.85 ? '#34d399' : nativeContactQ > 0.45 ? '#fbbf24' : '#f43f5e';
    ctx.beginPath();
    ctx.arc(particleX, particleY, 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 標註天然態能谷 (Native State Basin)
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('★ 天然態 (Q = 1.0)', funnelCenterX - 38, funnelBottomY + 16);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('無規捲曲高熵區 (Q ≈ 0)', funnelCenterX - 50, funnelTopY - 12);

    // 2. 右半部：天然接觸率 Q(t) 演化即時時域追蹤圖
    const plotLeft = w * 0.58;
    const plotRight = w * 0.94;
    const plotTop = 35;
    const plotBottom = h - 35;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(plotLeft, plotTop, plotWidth, plotHeight);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(plotLeft, plotTop, plotWidth, plotHeight);

    // 網格線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let qVal = 0.25; qVal < 1.0; qVal += 0.25) {
      const lineY = plotBottom - qVal * plotHeight;
      ctx.beginPath();
      ctx.moveTo(plotLeft, lineY);
      ctx.lineTo(plotRight, lineY);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText(`Q=${qVal.toFixed(2)}`, plotLeft + 6, lineY - 3);
    }

    // 繪製軌跡折線
    const history = trajectoryRef.current;
    if (history.length > 1) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const px = plotLeft + (i / 120) * plotWidth;
        const py = plotBottom - history[i].q * plotHeight;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // 最新點指示
      const lastX = plotLeft + ((history.length - 1) / 120) * plotWidth;
      const lastY = plotBottom - history[history.length - 1].q * plotHeight;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 圖表標頭與註記
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('天然接觸序參量 Q(t) 時間進程', plotLeft + 10, plotTop + 16);

  }, [nativeContactQ, frustrationRoughness, temperatureRatio, isSequenceOptimized]);

  const resetUnfoldedState = () => {
    setNativeContactQ(0.05);
    trajectoryRef.current = [];
  };

  return (
    <div className="my-8 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-md">
      {/* 頂部標題 */}
      <div className="flex flex-col gap-2 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-lg font-bold tracking-wide text-slate-100">
              蛋白質折疊自由能漏斗與萊文索爾佯謬模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            解構最小受挫原理（Minimal Frustration）、構象熵降解與熔球態中間體動態景觀
          </p>
        </div>

        {/* 操作按鈕 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-95"
          >
            {isSimulating ? '⏸ 暫停動力學' : '▶ 繼續模擬'}
          </button>
          <button
            onClick={resetUnfoldedState}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 active:scale-95"
          >
            ↻ 注入無規捲曲
          </button>
          <button
            onClick={() => setIsSequenceOptimized(!isSequenceOptimized)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              isSequenceOptimized
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-rose-900/60 border border-rose-600 text-rose-200'
            }`}
          >
            {isSequenceOptimized ? '自然演化序列 (平滑漏斗)' : '未最佳化序列 (高受挫)'}
          </button>
        </div>
      </div>

      {/* 主畫布視圖 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
        <canvas
          ref={canvasRef}
          width={760}
          height={280}
          className="h-64 w-full object-contain sm:h-72"
        />
      </div>

      {/* 實時動態物理指標 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">🧬 天然接觸比例 \(Q\)</div>
          <div className="mt-1 font-mono text-lg font-bold text-sky-400">
            {(nativeContactQ * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500">
            {nativeContactQ > 0.85 ? '完全折疊' : nativeContactQ > 0.45 ? '熔球態' : '展開態'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">📉 折疊自由能 \(\Delta F\)</div>
          <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
            {thermodynamics.deltaF_kcal} kcal/mol
          </div>
          <div className="text-[10px] text-slate-500">
            熱力學自發驅動力
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">⏱️ 平均折疊時標 \(\tau\)</div>
          <div className="mt-1 font-mono text-lg font-bold text-amber-400">
            {thermodynamics.foldingTimeMs} ms
          </div>
          <div className="text-[10px] text-slate-500">
            遠低於盲搜 10⁷⁷ 年極限
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">🏷️ 當前構象狀態</div>
          <div className="mt-1 font-mono text-xs font-bold text-purple-300 leading-snug">
            {foldingStatus}
          </div>
          <div className="text-[10px] text-slate-500">
            剩餘構象熵 ~{thermodynamics.entropyRatio}%
          </div>
        </div>
      </div>

      {/* 滑桿控制盤 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* 溫度控制 */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">體系溫度 \(T / T_f\)（折疊溫度比）</span>
            <span className="font-mono font-bold text-sky-400">{temperatureRatio.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.02}
            value={temperatureRatio}
            onChange={(e) => setTemperatureRatio(parseFloat(e.target.value))}
            className="mt-2 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.50 (低溫玻色玻璃凍結)</span>
            <span className="text-emerald-400 font-semibold">0.90 ~ 1.0 (生理最佳折疊區)</span>
            <span>1.50 (高溫熱變性)</span>
          </div>
        </div>

        {/* 能量景觀受挫度 */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">景觀粗糙受挫度 \(\Delta E / k_B T\)</span>
            <span className="font-mono font-bold text-amber-400">{frustrationRoughness.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={2.5}
            step={0.05}
            value={frustrationRoughness}
            onChange={(e) => setFrustrationRoughness(parseFloat(e.target.value))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.20 (平滑漏斗高速滑落)</span>
            <span>0.80 (典型生物蛋白)</span>
            <span>2.50 (深度動力學陷阱/易聚集)</span>
          </div>
        </div>
      </div>

      {/* 原理提示 */}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400">
        <span className="mt-0.5 text-emerald-400">🧬</span>
        <p className="leading-relaxed">
          <strong className="text-slate-200">萊文索爾佯謬的熱力學解答：</strong>
          一條由 100 個胺基酸組成的多肽鏈約有 3¹⁹⁸ ≈ 10⁹⁴ 種空間構象。若蛋白質透過隨機布朗運動逐一嘗試，即使每 10⁻¹³ 秒試一次，也需要超過 10⁷⁷ 年才能找到天然態。然而真實蛋白質在毫秒內即可完成折疊。自由能漏斗理論指出，蛋白質折疊絕非在「高爾夫球場」般的平坦表面尋找孤立洞口，而是在一個向天然基態強烈傾斜的高維多維漏斗中行進。自然演化篩選出的序列遵循「最小受挫原理」，天然接觸帶來的自由能下降遠遠壓過了構象熵的損失，使多肽鏈沿著平滑的能量斜坡自發「滑落」至功能構象。
        </p>
      </div>
    </div>
  );
};
