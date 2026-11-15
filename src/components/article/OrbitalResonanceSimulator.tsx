import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// 木衛一物理常數 (SI)
const G_CONST = 6.6743e-11;
const M_JUPITER = 1.898e27; // kg
const R_IO = 1.8216e6; // m
const A_IO = 4.217e8; // m
const N_IO = 4.1105e-5; // rad/s (1.769 days)
const K2_IO = 0.54; // 流變核心等效勒夫數 k2
const SURFACE_AREA_IO = 4 * Math.PI * R_IO * R_IO; // m^2
const RADIOGENIC_POWER_TW = 0.5; // 埃歐矽酸鹽放射性衰變背景熱功率 (~0.5 TW, ~0.012 W/m^2)

function computeTidalMetrics(ecc: number, qFactor: number) {
  const k2OverQ = K2_IO / qFactor;
  const tidalWatts =
    10.5 *
    k2OverQ *
    ((G_CONST * M_JUPITER * M_JUPITER * Math.pow(R_IO, 5) * N_IO * ecc * ecc) /
      Math.pow(A_IO, 6));
  const tidalTW = tidalWatts / 1e12;
  const totalTW = tidalTW + RADIOGENIC_POWER_TW;
  const heatFluxWm2 = (totalTW * 1e12) / SURFACE_AREA_IO;
  // 黏彈相位延遲角 delta ≈ 1 / (2Q) (以誇張視覺化倍數呈現)
  const lagRad = 1 / (2 * qFactor);
  return {
    tidalTW,
    totalTW,
    heatFluxWm2,
    k2OverQ,
    lagRad,
  };
}

export const OrbitalResonanceSimulator: React.FC = () => {
  // 強迫偏心率基準 e (真實埃歐 e ≈ 0.0041)
  const [forcedEcc, setForcedEcc] = useState<number>(0.0041);
  // 岩石黏彈品質因子 Q (真實約 32~40)
  const [qualityFactor, setQualityFactor] = useState<number>(36);
  // 4:2:1 拉普拉斯共振鎖定開關
  const [resonanceLocked, setResonanceLocked] = useState<boolean>(true);
  // 動畫運行狀態
  const [isRunning, setIsRunning] = useState<boolean>(true);

  // 即時演化偏心率 (共振關閉時隨時間指數圓化衰減)
  const [liveEcc, setLiveEcc] = useState<number>(0.0041);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<number>(0);
  const liveEccRef = useRef<number>(0.0041);
  const historyRef = useRef<{ ecc: number; powerTW: number }[]>([]);
  const rafRef = useRef<number | null>(null);

  // 同步滑桿與顯示數據：當共振鎖定時，liveEcc 立即追蹤 forcedEcc
  useEffect(() => {
    if (resonanceLocked) {
      liveEccRef.current = forcedEcc;
      setLiveEcc(forcedEcc);
    }
  }, [forcedEcc, resonanceLocked]);

  // 以當前顯示偏心率與 Q 即時計算功率指標
  const displayedEcc = resonanceLocked ? forcedEcc : liveEcc;
  const metrics = useMemo(
    () => computeTidalMetrics(displayedEcc, qualityFactor),
    [displayedEcc, qualityFactor]
  );

  // 畫布繪圖函式 (確保初始與每次參數變更立即渲染非透明像素)
  const drawFrame = useCallback(
    (theta1: number, currentEcc: number, qVal: number, locked: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // 深空背景
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, W, H);

      // 左側：木星與伽利略內三衛星 4:2:1 拉普拉斯軌道平面
      const cx = W * 0.31;
      const cy = H * 0.52;

      // 背景微弱星點 (確定性)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      for (let i = 0; i < 36; i++) {
        const sx = ((i * 197 + 43) % (W * 0.58));
        const sy = ((i * 131 + 29) % H);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // 軌道半徑 (視覺縮放)
      const a1 = 58; // Io
      const a2 = 96; // Europa
      const a3 = 142; // Ganymede

      // 誇張偏心視覺化 (使 e=0.0041 肉眼可辨橢圓離心)
      const visEcc = Math.min(0.32, currentEcc * 42);
      const b1 = a1 * Math.sqrt(1 - visEcc * visEcc);
      const cFocus = a1 * visEcc;

      // 繪製 Ganymede (木衛三) 與 Europa (木衛二) 軌道
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, a3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy, a2, 0, Math.PI * 2);
      ctx.stroke();

      // 繪製 Io 偏心橢圓軌道 (焦點在木星 cx, cy)
      ctx.strokeStyle = locked ? 'rgba(251, 146, 60, 0.65)' : 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(cx - cFocus, cy, a1, b1, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 計算衛星 4:2:1 角位置：theta1, theta2 = theta1/2 + pi/2, theta3 = theta1/4 + pi/4
      // 滿足拉普拉斯共振角 Φ_L = λ1 - 3λ2 + 2λ3 = π (180°)
      const t1 = theta1;
      const t2 = locked ? theta1 * 0.5 + Math.PI : theta1 * 0.47 + 0.8;
      const t3 = locked ? theta1 * 0.25 + Math.PI * 0.5 : theta1 * 0.23 + 1.9;

      const r1 = (a1 * (1 - visEcc * visEcc)) / (1 + visEcc * Math.cos(t1));
      const ioX = cx + r1 * Math.cos(t1);
      const ioY = cy + r1 * Math.sin(t1);
      const euX = cx + a2 * Math.cos(t2);
      const euY = cy + a2 * Math.sin(t2);
      const gaX = cx + a3 * Math.cos(t3);
      const gaY = cy + a3 * Math.sin(t3);

      // 若相位接近合相，繪製引力攝動連線
      const diff12 = Math.abs(((t1 - t2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (locked && diff12 > Math.PI - 0.55) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(ioX, ioY);
        ctx.lineTo(euX, euY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 繪製木星 (帶氣體條紋漸層)
      const jupGrad = ctx.createRadialGradient(cx - 5, cy - 5, 3, cx, cy, 20);
      jupGrad.addColorStop(0, '#fde68a');
      jupGrad.addColorStop(0.55, '#d97706');
      jupGrad.addColorStop(1, '#78350f');
      ctx.fillStyle = jupGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('木星 Jupiter', cx - 28, cy + 32);

      // 繪製 Ganymede (木衛三)
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(gaX, gaY, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px sans-serif';
      ctx.fillText('木衛三 1x', gaX + 9, gaY + 3);

      // 繪製 Europa (木衛二，冰殼藍光)
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(euX, euY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7dd3fc';
      ctx.fillText('木衛二 2x', euX + 8, euY + 3);

      // 繪製 Io (木衛一) 與 潮汐隆起黏彈形變橢圓 (含相位延遲角)
      const localMetrics = computeTidalMetrics(currentEcc, qVal);
      const bulgeStretch = 1 + Math.min(0.45, currentEcc * 55);
      const lagAngle = t1 + (1 / Math.max(10, qVal)) * 8; // 誇張可視相位延遲

      ctx.save();
      ctx.translate(ioX, ioY);
      ctx.rotate(lagAngle);

      // 潮汐應力隆起外暈
      const heatAlpha = Math.min(0.85, 0.15 + localMetrics.tidalTW / 180);
      ctx.fillStyle = `rgba(249, 115, 22, ${heatAlpha * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12 * bulgeStretch, 12 / Math.sqrt(bulgeStretch), 0, 0, Math.PI * 2);
      ctx.fill();

      // 熔岩核心主體
      ctx.fillStyle = localMetrics.tidalTW > 30 ? '#fb923c' : '#9ca3af';
      ctx.strokeStyle = localMetrics.tidalTW > 30 ? '#fef08a' : '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8 * bulgeStretch, 8 / Math.sqrt(bulgeStretch), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 火山噴發熱點
      if (localMetrics.tidalTW > 15) {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(3, -2, 2, 0, Math.PI * 2);
        ctx.arc(-4, 2, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = '#fed7aa';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('木衛一 4x', ioX + 12, ioY + 4);

      // 左上角狀態標籤
      ctx.fillStyle = locked ? '#34d399' : '#f87171';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(
        locked ? '● 4:2:1 拉普拉斯共振鎖定：偏心率持續泵浦' : '○ 共振解除：軌道潮汐圓化冷卻中',
        16,
        24
      );

      // 右側：功率時間演化圖與熱通量對比柱狀圖
      const rx = W * 0.58;
      const rw = W * 0.39;
      const topChartY = 44;
      const topChartH = 148;

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.fillRect(rx, topChartY, rw, topChartH);
      ctx.strokeRect(rx, topChartY, rw, topChartH);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('潮汐耗散功率 P_tidal (TW) 動態追蹤', rx + 10, topChartY + 18);

      // 參考基準線: 100 TW (Io 觀測基準)
      const maxP = 250;
      const ref100Y = topChartY + topChartH - (100 / maxP) * (topChartH - 34) - 10;
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(rx + 8, ref100Y);
      ctx.lineTo(rx + rw - 8, ref100Y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fb923c';
      ctx.font = '9px monospace';
      ctx.fillText('實測基準 ~100 TW', rx + rw - 92, ref100Y - 4);

      // 繪製功率歷史曲線
      const hist = historyRef.current;
      if (hist.length > 1) {
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const px = rx + 10 + (i / 100) * (rw - 20);
          const clampedP = Math.min(maxP, hist[i].powerTW);
          const py = topChartY + topChartH - (clampedP / maxP) * (topChartH - 34) - 10;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else {
        // 初始靜態水平線 (確保無動畫時也有曲線可視化)
        const py = topChartY + topChartH - (Math.min(maxP, localMetrics.tidalTW) / maxP) * (topChartH - 34) - 10;
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(rx + 10, py);
        ctx.lineTo(rx + rw - 10, py);
        ctx.stroke();
      }

      // 右下方：表面熱通量對比 (W/m^2)
      const botY = 212;
      const botH = 126;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#1e293b';
      ctx.fillRect(rx, botY, rw, botH);
      ctx.strokeRect(rx, botY, rw, botH);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('內源熱通量對比 (W/m²)', rx + 10, botY + 18);

      const bars = [
        { label: '木衛一 (模擬)', val: localMetrics.heatFluxWm2, color: '#f97316', max: 6.0 },
        { label: '地球地熱平均', val: 0.08, color: '#38bdf8', max: 6.0 },
        { label: '純放射性衰變', val: 0.012, color: '#94a3b8', max: 6.0 },
      ];

      bars.forEach((b, idx) => {
        const yPos = botY + 34 + idx * 28;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.fillText(b.label, rx + 10, yPos + 10);

        const barStartX = rx + 96;
        const barMaxW = rw - 156;
        const barW = Math.max(3, Math.min(barMaxW, (b.val / b.max) * barMaxW));

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(barStartX, yPos, barMaxW, 13);
        ctx.fillStyle = b.color;
        ctx.fillRect(barStartX, yPos, barW, 13);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${b.val.toFixed(2)}`, barStartX + barMaxW + 6, yPos + 10);
      });
    },
    []
  );

  // 動畫迴圈
  useEffect(() => {
    // 立即繪製首幀
    drawFrame(phaseRef.current, liveEccRef.current, qualityFactor, resonanceLocked);

    if (!isRunning) return;

    let lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      phaseRef.current += dt * 1.9;

      if (resonanceLocked) {
        // 共振鎖定：受木衛二/木衛三合相週期泵浦，於 forcedEcc 附近微幅震盪
        const osc = 1 + 0.04 * Math.sin(phaseRef.current * 2);
        liveEccRef.current = forcedEcc * osc;
      } else {
        // 解除共振：潮汐耗散迅速阻尼軌道偏心率 e -> 0 (圓化)
        const dampingRate = 0.42 * (36 / Math.max(15, qualityFactor));
        liveEccRef.current = Math.max(0.0001, liveEccRef.current * Math.exp(-dampingRate * dt));
        setLiveEcc(liveEccRef.current);
      }

      const curM = computeTidalMetrics(liveEccRef.current, qualityFactor);
      historyRef.current.push({ ecc: liveEccRef.current, powerTW: curM.tidalTW });
      if (historyRef.current.length > 100) {
        historyRef.current.shift();
      }

      drawFrame(phaseRef.current, liveEccRef.current, qualityFactor, resonanceLocked);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, resonanceLocked, forcedEcc, qualityFactor, drawFrame]);

  const toggleResonance = () => {
    const next = !resonanceLocked;
    setResonanceLocked(next);
    if (next) {
      liveEccRef.current = forcedEcc;
      setLiveEcc(forcedEcc);
    }
  };

  const resetToIoBaseline = () => {
    setForcedEcc(0.0041);
    setQualityFactor(36);
    setResonanceLocked(true);
    liveEccRef.current = 0.0041;
    setLiveEcc(0.0041);
    historyRef.current = [];
  };

  return (
    <div className="my-8 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 sm:p-5 shadow-2xl overflow-hidden">
      {/* 標題與控制列 */}
      <div className="flex flex-col gap-3 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-orange-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-100">
              拉普拉斯 4:2:1 共振與潮汐加熱即時模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            即時演算木衛一（Io）、木衛二、木衛三軌道共振鎖定、黏彈潮汐隆起與 10<sup>14</sup> W 級火山熔融功率
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleResonance}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
              resonanceLocked
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-rose-900/70 border border-rose-500/70 text-rose-200 hover:bg-rose-800/80'
            }`}
          >
            {resonanceLocked ? '🔒 4:2:1 共振鎖定：開啟' : '🔓 共振已解除（軌道圓化中）'}
          </button>

          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            {isRunning ? '⏸ 暫停' : '▶ 繼續'}
          </button>

          <button
            type="button"
            onClick={resetToIoBaseline}
            className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
          >
            ↺ 埃歐基準
          </button>
        </div>
      </div>

      {/* 主畫布 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          className="w-full h-auto block rounded-lg"
        />
      </div>

      {/* 四項即時物理指標 */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-w-0">
          <div className="text-xs text-slate-400">🔥 潮汐加熱功率 P<sub>tidal</sub></div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-orange-400">
            {metrics.tidalTW.toFixed(1)} TW
          </div>
          <div className="text-[10px] text-slate-500">
            1 TW = 10<sup>12</sup> W（基準 ≈ 100 TW）
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-w-0">
          <div className="text-xs text-slate-400">🌡️ 表面平均熱通量</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-amber-300">
            {metrics.heatFluxWm2.toFixed(2)} W/m²
          </div>
          <div className="text-[10px] text-slate-500">
            相當於地球平均地熱 {(metrics.heatFluxWm2 / 0.08).toFixed(1)} 倍
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-w-0">
          <div className="text-xs text-slate-400">🪐 當前軌道偏心率 e</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-sky-400">
            {displayedEcc.toFixed(4)}
          </div>
          <div className="text-[10px] text-slate-500">
            {resonanceLocked ? '受合相引力共振泵浦維持' : '無共振保護，趨近圓軌道'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-w-0">
          <div className="text-xs text-slate-400">🌋 黏彈耗散比 k<sub>2</sub>/Q</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-emerald-400">
            {metrics.k2OverQ.toFixed(4)}
          </div>
          <div className="text-[10px] text-slate-500">
            太陽輻射僅 ≈ 50 W/m² (5.2 AU)
          </div>
        </div>
      </div>

      {/* 互動滑桿區 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-semibold text-slate-300">強迫偏心率基準 e</span>
            <span className="font-mono font-bold text-sky-400">{forcedEcc.toFixed(4)}</span>
          </div>
          <input
            type="range"
            min={0.0005}
            max={0.0080}
            step={0.0001}
            value={forcedEcc}
            onChange={(e) => setForcedEcc(parseFloat(e.target.value))}
            className="mt-2 w-full accent-orange-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.0005 (近圓形微熱)</span>
            <span className="text-orange-400 font-semibold">0.0041 (木衛一實測)</span>
            <span>0.0080 (極端熔融)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-semibold text-slate-300">地函岩石品質因子 Q（耗散倒數）</span>
            <span className="font-mono font-bold text-amber-400">Q = {qualityFactor}</span>
          </div>
          <input
            type="range"
            min={18}
            max={180}
            step={2}
            value={qualityFactor}
            onChange={(e) => setQualityFactor(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>18 (軟流層強耗散)</span>
            <span className="text-amber-300 font-semibold">36 (Io 實測反演)</span>
            <span>180 (剛性低耗散)</span>
          </div>
        </div>
      </div>

      {/* 機制說明 */}
      <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400 leading-relaxed">
        <strong className="text-slate-200">物理提示：</strong>
        潮汐加熱功率正比於 (k<sub>2</sub>/Q) × e²。當「4:2:1 拉普拉斯共振」鎖定開啟時，木衛二與木衛三的週期性合相重力攝動持續注入偏心率 e ≈ 0.0041，使木衛一地函在每次 1.77 天的軌道週期中反覆經歷數十公尺級的垂直潮汐揉捏；一旦關閉共振鎖定，內摩擦會迅速將能量轉為熱輻射並把軌道拉回正圓，火山爐心隨之冷卻熄滅。
      </div>
    </div>
  );
};
