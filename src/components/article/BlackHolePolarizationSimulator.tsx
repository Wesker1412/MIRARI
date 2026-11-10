import React, { useState, useEffect, useRef, useMemo } from 'react';

export const BlackHolePolarizationSimulator: React.FC = () => {
  // 黑洞自旋參數 a* (-0.99 到 +0.99)
  const [spinA, setSpinA] = useState<number>(0.90);
  // 吸積盤磁化狀態：MAD (磁阻滯盤) vs SANE (標準吸積盤)
  const [diskAccretionState, setDiskAccretionState] = useState<'MAD' | 'SANE'>('MAD');
  // 磁場螺旋角 / 法拉第旋轉深度 (度)
  const [magneticPitchDeg, setMagneticPitchDeg] = useState<number>(65);
  // 顯示開關
  const [showEvpaVectors, setShowEvpaVectors] = useState<boolean>(true);
  const [showJetOutflow, setShowJetOutflow] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 物理推導與觀測指標
  const metrics = useMemo(() => {
    // 視界半徑 r_H = M * (1 + sqrt(1 - a^2))
    const rH = 1 + Math.sqrt(Math.max(0, 1 - spinA * spinA));
    // 視界角速度 Omega_H = a / (2 * r_H)
    const omegaH = spinA / (2 * rH);
    // 無量綱無規磁通量 phi_BH
    const phiBH = diskAccretionState === 'MAD' ? 52 : 15;
    // 布蘭福德-茲納傑克 (Blandford-Znajek) 噴流功率 P_BZ propto Omega_H^2 * phi_BH^2
    const jetPowerRelative = Math.pow(omegaH, 2) * Math.pow(phiBH / 30, 2) * 100;
    // EHT 實測整體線偏振度 (Net Linear Polarization Fraction)
    const netPolFraction = diskAccretionState === 'MAD' ? (12 + (magneticPitchDeg / 90) * 8) : 4.5;

    return {
      rH_Rg: rH,
      omegaH_c_over_Rg: omegaH,
      jetPower: Math.max(0.1, jetPowerRelative),
      netPol: netPolFraction.toFixed(1),
      stateDesc:
        diskAccretionState === 'MAD'
          ? '磁阻滯盤 (MAD)：強極向磁場積聚在視界邊緣，提供強大的磁壓力足以阻滯吸積流並高效噴發相對論性噴流。'
          : '標準演化盤 (SANE)：環向磁場為主，磁通量不足以對抗重力，噴流效率較低。',
    };
  }, [spinA, diskAccretionState, magneticPitchDeg]);

  // 繪製黑洞陰影、偏振光度發射環與 EVPA 向量刻度
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 深空黑色背景
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    const centerX = w * 0.42;
    const centerY = h / 2;
    const rgPixels = 24; // 1 重力半徑 R_g 對應像素

    // 1. 噴流軸線與相對論電漿漏斗 (Jet Funnel)
    if (showJetOutflow && metrics.jetPower > 1) {
      const jetGradTop = ctx.createRadialGradient(centerX, centerY - 60, 10, centerX, centerY - 140, 120);
      jetGradTop.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      jetGradTop.addColorStop(0.6, 'rgba(14, 165, 233, 0.12)');
      jetGradTop.addColorStop(1, 'rgba(14, 165, 233, 0)');

      ctx.fillStyle = jetGradTop;
      ctx.beginPath();
      ctx.moveTo(centerX - 15, centerY);
      ctx.lineTo(centerX - 70, 0);
      ctx.lineTo(centerX + 70, 0);
      ctx.lineTo(centerX + 15, centerY);
      ctx.closePath();
      ctx.fill();

      // 下噴流 (遠離觀測者，微弱)
      const jetGradBottom = ctx.createRadialGradient(centerX, centerY + 60, 10, centerX, centerY + 140, 120);
      jetGradBottom.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
      jetGradBottom.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = jetGradBottom;
      ctx.beginPath();
      ctx.moveTo(centerX - 12, centerY);
      ctx.lineTo(centerX - 50, h);
      ctx.lineTo(centerX + 50, h);
      ctx.lineTo(centerX + 12, centerY);
      ctx.closePath();
      ctx.fill();
    }

    // 2. 吸積盤非對稱同步輻射輝光 (都卜勒藍移聚束)
    const shadowRadius = 2.6 * rgPixels; // 黑洞陰影臨界半徑 ~ 5.2 R_g 直徑
    const diskOuterRadius = 5.8 * rgPixels;

    for (let r = diskOuterRadius; r >= shadowRadius * 0.85; r -= 1.5) {
      for (let angle = 0; angle < Math.PI * 2; angle += 0.08) {
        // 都卜勒增強因子：靠近觀測者一側 (角度在 -0.5pi ~ 0.5pi 之間) 強度激增
        const dopplerBoost = Math.pow(Math.max(0.05, 1 + 0.65 * Math.sin(angle) * (spinA >= 0 ? 1 : -1)), 3.5);
        // 徑向衰減
        const radialFalloff = Math.exp(-Math.pow((r - shadowRadius * 1.35) / (rgPixels * 1.2), 2));
        const intensity = Math.min(1.0, dopplerBoost * radialFalloff * 1.2);

        if (intensity > 0.03) {
          const px = centerX + Math.cos(angle) * r;
          const py = centerY + Math.sin(angle) * r * 0.72; // 傾角投影橢圓

          ctx.fillStyle = `rgba(245, 158, 11, ${intensity * 0.4})`;
          ctx.beginPath();
          ctx.arc(px, py, 2.8, 0, Math.PI * 2);
          ctx.fill();

          if (intensity > 0.5) {
            ctx.fillStyle = `rgba(254, 240, 138, ${intensity * 0.6})`;
            ctx.beginPath();
            ctx.arc(px, py, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // 3. 黑洞陰影內部 (真正的事件視界與光子捕獲區)
    const shadowGrad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, shadowRadius);
    shadowGrad.addColorStop(0, '#000000');
    shadowGrad.addColorStop(0.85, '#000000');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');

    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, shadowRadius, shadowRadius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 4. 線偏振電向量位置角 (EVPA, \chi) 刻度線覆蓋 (EHT 標誌性螺旋圖紋)
    if (showEvpaVectors) {
      const ringSampleR = shadowRadius * 1.28;
      const numVectors = 28;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;

      for (let i = 0; i < numVectors; i++) {
        const phi = (i / numVectors) * Math.PI * 2;
        const px = centerX + Math.cos(phi) * ringSampleR;
        const py = centerY + Math.sin(phi) * ringSampleR * 0.72;

        // 都卜勒強弱加權刻度長度
        const dopplerWeight = 1 + 0.4 * Math.sin(phi);

        // EVPA 角度 chi：由盤面磁場螺旋角 (magneticPitchDeg) 與視線投影決定
        // MAD 狀態下展現高度有序的方位角螺旋結構
        const pitchRad = (magneticPitchDeg * Math.PI) / 180;
        const evpaAngle = phi + Math.PI / 2 - (diskAccretionState === 'MAD' ? pitchRad * 0.45 : Math.PI / 2 * 0.85);

        const tickLen = 9 * dopplerWeight;
        const dx = Math.cos(evpaAngle) * tickLen;
        const dy = Math.sin(evpaAngle) * tickLen;

        ctx.beginPath();
        ctx.moveTo(px - dx, py - dy);
        ctx.lineTo(px + dx, py + dy);
        ctx.stroke();

        // 刻度線末端小端點 (偏振方向指示)
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(px + dx, py + dy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. 右側：偏振統計與斯托克斯參量剖面 (Stokes Q/U & Total I)
    const chartLeft = w * 0.74;
    const chartWidth = w * 0.22;
    const chartTop = 35;
    const chartBottom = h - 35;
    const chartHeight = chartBottom - chartTop;

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(chartLeft, chartTop, chartWidth, chartHeight);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(chartLeft, chartTop, chartWidth, chartHeight);

    // 標題
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('偏振方位角輪廓 (m_net)', chartLeft + 10, chartTop + 18);

    // 斯托克斯線偏振強度輪廓曲線 m_net(phi)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let py = chartTop + 30; py <= chartBottom - 15; py++) {
      const normY = (py - (chartTop + 30)) / (chartHeight - 45);
      const angle = normY * Math.PI * 2;
      const polVal = (parseFloat(metrics.netPol) / 25) * (0.8 + 0.3 * Math.cos(angle * 2));
      const curX = chartLeft + 20 + polVal * (chartWidth - 40);

      if (py === chartTop + 30) ctx.moveTo(curX, py);
      else ctx.lineTo(curX, py);
    }
    ctx.stroke();

    // 標籤
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`淨偏振度: ${metrics.netPol}%`, chartLeft + 15, chartBottom - 25);
    ctx.fillText(`噴流功率: ${metrics.jetPower.toFixed(1)}`, chartLeft + 15, chartBottom - 10);

    // 光子環指引註記
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('⚡ 光子環發射月牙 (Doppler Crescent)', centerX - 85, h - 14);

  }, [spinA, diskAccretionState, magneticPitchDeg, showEvpaVectors, showJetOutflow, metrics]);

  return (
    <div className="my-8 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-md">
      {/* 標題與簡介 */}
      <div className="flex flex-col gap-2 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-lg font-bold tracking-wide text-slate-100">
              事件視界望遠鏡（EHT）黑洞偏振成像與相對論噴流模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            解算同步輻射線偏振電向量角（EVPA）、磁阻滯吸積盤（MAD）與布蘭福德-茲納傑克磁層發動機
          </p>
        </div>

        {/* 模式切換 */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 p-1">
          <button
            onClick={() => setDiskAccretionState('MAD')}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
              diskAccretionState === 'MAD'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            磁阻滯盤 (MAD)
          </button>
          <button
            onClick={() => setDiskAccretionState('SANE')}
            className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
              diskAccretionState === 'SANE'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            標準弱磁盤 (SANE)
          </button>
        </div>
      </div>

      {/* 主畫布區 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
        <canvas
          ref={canvasRef}
          width={760}
          height={320}
          className="h-64 w-full object-contain sm:h-72"
        />
      </div>

      {/* 關鍵指標 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">🌀 克爾自旋 \(a_*\)</div>
          <div className="mt-1 font-mono text-lg font-bold text-sky-400">
            {spinA.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500">
            視界角速度 \(\Omega_H \approx {metrics.omegaH_c_over_Rg.toFixed(3)}\)
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">🧲 磁吸積狀態</div>
          <div className="mt-1 font-mono text-lg font-bold text-amber-400">
            {diskAccretionState}
          </div>
          <div className="text-[10px] text-slate-500">
            {diskAccretionState === 'MAD' ? '強極向磁通阻滯' : '環向弱磁場佔優'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">🧭 淨線偏振度 m_net</div>
          <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
            {metrics.netPol}%
          </div>
          <div className="text-[10px] text-slate-500">
            EHT 2021/2024 實測 ~15%
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">🚀 噴流抽取功率 P_BZ</div>
          <div className="mt-1 font-mono text-lg font-bold text-purple-400">
            {metrics.jetPower.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-500">
            正比於 Ω_H² Φ_BH² 磁能抽取
          </div>
        </div>
      </div>

      {/* 滑桿控制盤 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* 自旋控制 */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">無量綱自旋參數 \(a_*\)</span>
            <span className="font-mono font-bold text-sky-400">{spinA.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={-0.99}
            max={0.99}
            step={0.01}
            value={spinA}
            onChange={(e) => setSpinA(parseFloat(e.target.value))}
            className="mt-2 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>-0.99 (逆行自旋)</span>
            <span>0.0 (史瓦西無旋)</span>
            <span>+0.99 (極端順行自旋)</span>
          </div>
        </div>

        {/* 磁場螺旋傾角 */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">極向/環向磁場螺旋傾角</span>
            <span className="font-mono font-bold text-amber-400">{magneticPitchDeg}°</span>
          </div>
          <input
            type="range"
            min={10}
            max={85}
            step={1}
            value={magneticPitchDeg}
            onChange={(e) => setMagneticPitchDeg(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>10° (主要為環向場 B_phi)</span>
            <span>65° (EHT M87* 最佳擬合)</span>
            <span>85° (主要為極向場 B_p)</span>
          </div>
        </div>
      </div>

      {/* 視覺圖層切換 */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showEvpaVectors}
            onChange={(e) => setShowEvpaVectors(e.target.checked)}
            className="rounded accent-sky-500"
          />
          <span>顯示偏振電向量角刻度線 (EVPA Tick Marks)</span>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showJetOutflow}
            onChange={(e) => setShowJetOutflow(e.target.checked)}
            className="rounded accent-purple-500"
          />
          <span>顯示布蘭福德-茲納傑克相對論噴流 (Relativistic Jet)</span>
        </label>
      </div>

      {/* 機制說明 */}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400">
        <span className="mt-0.5 text-sky-400">ℹ️</span>
        <p className="leading-relaxed">
          <strong className="text-slate-200">看穿黑洞邊緣的磁力骨骼：</strong>
          高能電子在強磁場中以接近光速旋轉時，會發射垂直於局部磁力線的線性偏振同步輻射。事件視界望遠鏡（EHT）跨越全球毫米波基線干涉陣列，首次在 M87* 與 Sgr A* 的陰影光環上解析出高達 15% 的有序螺旋偏振圖紋。廣義相對論磁流體力學（GRMHD）數值模擬證實，只有當吸積流處於「磁阻滯盤（MAD）」極限時，強大的極向磁場才能緊緊扼住下落物質，並透過時空拖曳（Frame Dragging）將黑洞的自旋旋轉能轉化為橫跨數千光年的相對論巨型噴流。
        </p>
      </div>
    </div>
  );
};
