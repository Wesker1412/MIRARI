import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const CS_KM_S = 3.5; // 地殼典型 S 波速 (km/s)
const CP_KM_S = 6.0; // 地殼典型 P 波速 (km/s)
const S_CRIT = 1.77; // 二維平面應變 Mode II Burridge-Andrews 臨界應力比

interface RuptureMetrics {
  isSupershear: boolean;
  vrOverCs: number;
  vrKmS: number;
  machAngleDeg: number | null;
  peakGroundVelCmS: number;
  daughterNucleationKm: number | null;
  regimeLabel: string;
}

function computeRuptureMetrics(sRatio: number, stationDistKm: number): RuptureMetrics {
  const isSupershear = sRatio < S_CRIT;
  let vrOverCs: number;
  let daughterNucleationKm: number | null = null;

  if (!isSupershear) {
    // 亞瑞利破裂：速度介於 0.72 cS ~ 0.90 cS，隨著 S 變小逼近 cR
    const t = Math.min(1, Math.max(0, (2.8 - sRatio) / (2.8 - S_CRIT)));
    vrOverCs = 0.72 + t * 0.18;
  } else {
    // 超剪切躍遷：越過 [cR, cS] 禁區，穩定於 sqrt(2)*cS ≈ 1.414 cS 並隨更低 S 逼近 1.65 cS
    const t = Math.min(1, Math.max(0, (S_CRIT - sRatio) / (S_CRIT - 0.6)));
    vrOverCs = 1.414 + t * 0.24; // 含 1.55 cS 土耳其分支斷層區間
    // 子裂紋成核距離隨應力比 S 增大而拉長
    daughterNucleationKm = 4.5 + Math.pow(sRatio / S_CRIT, 2) * 14;
  }

  const vrKmS = vrOverCs * CS_KM_S;
  const machAngleDeg = isSupershear
    ? (Math.asin(Math.min(1, 1 / vrOverCs)) * 180) / Math.PI
    : null;

  // 遠場峰值速度脈衝 (cm/s)：超剪切馬赫錐能量無典型幾何 1/r 快速衰減，呈現劇烈速度脈衝
  const peakGroundVelCmS = isSupershear
    ? (155 * (vrOverCs / 1.414)) / Math.pow(stationDistKm / 20, 0.32)
    : (48 * (vrOverCs / 0.85)) / Math.pow(stationDistKm / 20, 0.88);

  const regimeLabel = isSupershear
    ? `超剪切躍遷破裂（v_r ≈ ${vrOverCs.toFixed(2)} c_S，形成剪力馬赫錐）`
    : `亞瑞利破裂（v_r < c_R，無馬赫衝擊錐）`;

  return {
    isSupershear,
    vrOverCs,
    vrKmS,
    machAngleDeg,
    peakGroundVelCmS,
    daughterNucleationKm,
    regimeLabel,
  };
}

export const FaultRuptureSimulator: React.FC = () => {
  // 無因次應力比 S = (τ_u - τ_0) / (τ_0 - τ_r)
  const [stressRatioS, setStressRatioS] = useState<number>(1.20);
  // 測站垂直斷層距離 (km)
  const [stationDistKm, setStationDistKm] = useState<number>(25);
  // 動畫運行與推進時間 t (秒)
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simTimeSec, setSimTimeSec] = useState<number>(14.0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeRef = useRef<number>(14.0);
  const rafRef = useRef<number | null>(null);

  const metrics = useMemo(
    () => computeRuptureMetrics(stressRatioS, stationDistKm),
    [stressRatioS, stationDistKm]
  );

  const drawScene = useCallback(
    (tSec: number, m: RuptureMetrics, distKm: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, W, H);

      // ─── 左側：二維地殼斷層與波場馬赫錐模擬 ────────────────────
      const mapW = W * 0.62;
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(10, 10, mapW - 14, H - 20);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, mapW - 14, H - 20);

      const pxPerKm = 4.2; // 比例尺：1 km -> 4.2 px
      const epiX = 74;
      const faultY = H * 0.54;
      const faultEndX = mapW - 22;

      // 背景地殼網格
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
      ctx.lineWidth = 0.8;
      for (let gx = 30; gx < mapW - 12; gx += 42) {
        ctx.beginPath();
        ctx.moveTo(gx, 14);
        ctx.lineTo(gx, H - 14);
        ctx.stroke();
      }
      for (let gy = 26; gy < H - 14; gy += 42) {
        ctx.beginPath();
        ctx.moveTo(14, gy);
        ctx.lineTo(mapW - 10, gy);
        ctx.stroke();
      }

      // P 波波前圓 (虛線淺青色)
      const rP = tSec * CP_KM_S * pxPerKm;
      ctx.save();
      ctx.beginPath();
      ctx.rect(11, 11, mapW - 16, H - 22);
      ctx.clip();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(epiX, faultY, rP, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // S 波波前圓 (藍色實線)
      const rS = tSec * CS_KM_S * pxPerKm;
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.78)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(epiX, faultY, rS, 0, Math.PI * 2);
      ctx.stroke();

      // 斷層線 (未破裂段)
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(32, faultY);
      ctx.lineTo(faultEndX, faultY);
      ctx.stroke();

      // 破裂前緣位置計算 (含子裂紋成核與超剪切躍遷)
      let ruptureDistKm: number;
      let daughterActive = false;
      const tJump = m.daughterNucleationKm ? m.daughterNucleationKm / CS_KM_S : 999;

      if (!m.isSupershear || tSec < tJump) {
        ruptureDistKm = tSec * (m.isSupershear ? 0.88 * CS_KM_S : m.vrKmS);
      } else {
        // 躍遷時刻過後：前緣以超剪切速度超越 S 波前緣
        const distAtJump = tJump * 0.88 * CS_KM_S;
        ruptureDistKm = distAtJump + (tSec - tJump) * m.vrKmS;
        daughterActive = true;
      }

      const tipX = Math.min(faultEndX, epiX + ruptureDistKm * pxPerKm);

      // 已破裂滑移發光段
      ctx.strokeStyle = m.isSupershear && daughterActive ? '#f43f5e' : '#f59e0b';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(epiX, faultY);
      ctx.lineTo(tipX, faultY);
      ctx.stroke();

      // 若為超剪切狀態且已躍遷，繪製子波圓包絡與銳利 V 形剪力馬赫錐！
      if (m.isSupershear && daughterActive && m.machAngleDeg !== null) {
        const thetaRad = (m.machAngleDeg * Math.PI) / 180;
        const coneLen = 280;
        const dxCone = coneLen * Math.sin(thetaRad);
        const dyCone = coneLen * Math.cos(thetaRad);

        // 能量聚集亮帶
        const coneGrad = ctx.createLinearGradient(tipX, faultY, tipX - dxCone, faultY - dyCone);
        coneGrad.addColorStop(0, 'rgba(244, 63, 94, 0.55)');
        coneGrad.addColorStop(1, 'rgba(244, 63, 94, 0.05)');
        ctx.strokeStyle = coneGrad;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(tipX, faultY);
        ctx.lineTo(tipX - dxCone, faultY - dyCone);
        ctx.moveTo(tipX, faultY);
        ctx.lineTo(tipX - dxCone, faultY + dyCone);
        ctx.stroke();

        // 銳利馬赫錐波前邊界線
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(tipX, faultY);
        ctx.lineTo(tipX - dxCone, faultY - dyCone);
        ctx.moveTo(tipX, faultY);
        ctx.lineTo(tipX - dxCone, faultY + dyCone);
        ctx.stroke();

        // 標記子裂紋萌芽位置
        if (m.daughterNucleationKm) {
          const nucX = epiX + m.daughterNucleationKm * pxPerKm;
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(nucX, faultY, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = '9px sans-serif';
          ctx.fillText('子裂紋躍遷點', nucX - 24, faultY + 18);
        }
      }

      // 震央標記
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(epiX, faultY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '10px sans-serif';
      ctx.fillText('震央', epiX - 10, faultY + 18);

      // 破裂前緣標記
      ctx.fillStyle = m.isSupershear && daughterActive ? '#fb7185' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(tipX, faultY, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // 遠場測站位置
      const statX = epiX + 58 * pxPerKm;
      const statY = faultY - distKm * pxPerKm * 0.65;
      ctx.fillStyle = '#34d399';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(statX, statY - 7);
      ctx.lineTo(statX - 6, statY + 5);
      ctx.lineTo(statX + 6, statY + 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#6ee7b7';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`地震測站 (y = ${distKm} km)`, statX - 48, statY - 12);

      // 波前圖例
      ctx.fillStyle = '#7dd3fc';
      ctx.font = '10px sans-serif';
      ctx.fillText('--- P 波前 (6.0 km/s)', 22, 32);
      ctx.fillStyle = '#60a5fa';
      ctx.fillText('— S 波前 (3.5 km/s)', 142, 32);
      ctx.fillStyle = m.isSupershear ? '#fb7185' : '#fbbf24';
      ctx.fillText(
        m.isSupershear ? '▲ 剪力馬赫錐衝擊波' : '● 亞瑞利破裂前緣',
        262,
        32
      );

      ctx.restore();

      // ─── 右側：遠場地震儀速度波形 v(t) ──────────────────────────────
      const rx = W * 0.64;
      const rw = W - rx - 14;
      const ry = 42;
      const rh = H - 72;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('測站實測粒子速度波列 v(t)', rx + 8, ry - 12);

      // 中軸線
      const midY = ry + rh * 0.5;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.beginPath();
      ctx.moveTo(rx + 6, midY);
      ctx.lineTo(rx + rw - 6, midY);
      ctx.stroke();

      // 繪製合成地震波形 (0 ~ 24 s)
      const tMax = 24;
      const ampScale = (rh * 0.42) / 180; // 以 180 cm/s 為滿尺度
      const statXKm = 58;
      const pArrival = Math.hypot(statXKm, distKm) / CP_KM_S;
      const sArrival = Math.hypot(statXKm, distKm) / CS_KM_S;
      const machArrival =
        m.isSupershear && m.machAngleDeg
          ? statXKm / m.vrKmS + (distKm * Math.cos((m.machAngleDeg * Math.PI) / 180)) / CS_KM_S
          : sArrival + 1.5;

      ctx.strokeStyle = m.isSupershear ? '#fb7185' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 180; i++) {
        const tau = (i / 180) * tMax;
        let vel = 0;
        // 微小 P 波初至
        if (tau > pArrival) {
          const dp = tau - pArrival;
          vel += 12 * Math.exp(-dp * 0.8) * Math.sin(dp * 6.5);
        }
        // S 波或馬赫錐主脈衝
        if (m.isSupershear) {
          const dm = tau - machArrival;
          if (Math.abs(dm) < 3.5) {
            vel +=
              m.peakGroundVelCmS *
              Math.exp(-dm * dm * 1.9) *
              Math.cos(dm * 3.8);
          }
        } else if (tau > sArrival) {
          const ds = tau - sArrival;
          vel +=
            m.peakGroundVelCmS *
            Math.exp(-ds * 0.35) *
            Math.sin(ds * 2.8);
        }

        const px = rx + 8 + (tau / tMax) * (rw - 16);
        const py = midY - Math.max(-175, Math.min(175, vel)) * ampScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // 當前模擬時間指標線
      const curTX = rx + 8 + (Math.min(tMax, tSec) / tMax) * (rw - 16);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(curTX, ry + 6);
      ctx.lineTo(curTX, ry + rh - 6);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`t = ${tSec.toFixed(1)} s`, rx + 8, ry + rh + 16);
      ctx.fillStyle = m.isSupershear ? '#fda4af' : '#7dd3fc';
      ctx.fillText(`峰值 ${m.peakGroundVelCmS.toFixed(0)} cm/s`, rx + rw - 88, ry + rh + 16);
    },
    []
  );

  // 動畫與即時參數變更繪製
  useEffect(() => {
    drawScene(timeRef.current, metrics, stationDistKm);

    if (!isPlaying) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      timeRef.current += dt * 3.2;
      if (timeRef.current > 24.0) {
        timeRef.current = 0.5;
      }
      setSimTimeSec(timeRef.current);
      drawScene(timeRef.current, metrics, stationDistKm);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, metrics, stationDistKm, drawScene]);

  const triggerRupture = (targetS?: number) => {
    if (typeof targetS === 'number') setStressRatioS(targetS);
    timeRef.current = 0.5;
    setSimTimeSec(0.5);
    setIsPlaying(true);
  };

  return (
    <div className="my-8 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 sm:p-5 shadow-2xl overflow-hidden">
      {/* 標題與預設模式按鈕 */}
      <div className="flex flex-col gap-3 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-100">
              二維彈性動力學斷層破裂與馬赫錐模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            調整無因次斷層應力比 S，見證 S &lt; 1.77 時子裂紋越過 [c<sub>R</sub>, c<sub>S</sub>] 禁區並形成剪力馬赫錐
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => triggerRupture(1.05)}
            className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500"
          >
            ⚡ 2023 土耳其超剪切 (≈1.55 c<sub>S</sub>)
          </button>
          <button
            type="button"
            onClick={() => triggerRupture(2.20)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            🌊 傳統亞瑞利破裂
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
          >
            {isPlaying ? '⏸ 暫停' : '▶ 播放'}
          </button>
        </div>
      </div>

      {/* 模擬畫布 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          className="w-full h-auto block rounded-lg"
        />
      </div>

      {/* 四項核心指標 */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-w-0">
          <div className="text-xs text-slate-400">🚀 破裂速度比 v<sub>r</sub> / c<sub>S</sub></div>
          <div className={`mt-1 font-mono text-base sm:text-lg font-bold ${metrics.isSupershear ? 'text-rose-400' : 'text-sky-400'}`}>
            {metrics.vrOverCs.toFixed(2)} c<sub>S</sub>
          </div>
          <div className="text-[10px] text-slate-500">
            實測波速 {metrics.vrKmS.toFixed(2)} km/s（t = {simTimeSec.toFixed(1)} s）
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-w-0">
          <div className="text-xs text-slate-400">📐 馬赫半錐角 θ<sub>M</sub></div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-amber-400">
            {metrics.machAngleDeg !== null ? `${metrics.machAngleDeg.toFixed(1)}°` : '無馬赫錐'}
          </div>
          <div className="text-[10px] text-slate-500">
            {metrics.isSupershear ? 'sin(θ_M) = c_S / v_r' : '亞瑞利區間不滿足共鳴條件'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-w-0">
          <div className="text-xs text-slate-400">💥 測站峰值地動速度</div>
          <div className={`mt-1 font-mono text-base sm:text-lg font-bold ${metrics.isSupershear ? 'text-rose-300' : 'text-emerald-400'}`}>
            {metrics.peakGroundVelCmS.toFixed(0)} cm/s
          </div>
          <div className="text-[10px] text-slate-500">
            {metrics.isSupershear ? '馬赫衝擊波低衰減遠距直擊' : '球面波幾何快速衰減'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-w-0">
          <div className="text-xs text-slate-400">🧭 破裂動力學狀態</div>
          <div className={`mt-1 text-xs font-bold leading-snug ${metrics.isSupershear ? 'text-rose-400' : 'text-sky-300'}`}>
            {metrics.regimeLabel}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Andrews 臨界門檻 S<sub>c</sub> = 1.77
          </div>
        </div>
      </div>

      {/* 互動控制滑桿 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-semibold text-slate-300">無因次應力比 S = (τ<sub>u</sub> − τ<sub>0</sub>)/(τ<sub>0</sub> − τ<sub>r</sub>)</span>
            <span className={`font-mono font-bold ${metrics.isSupershear ? 'text-rose-400' : 'text-sky-400'}`}>
              S = {stressRatioS.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0.60}
            max={2.80}
            step={0.05}
            value={stressRatioS}
            onChange={(e) => setStressRatioS(parseFloat(e.target.value))}
            className="mt-2 w-full accent-rose-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.60 (高預應力極速躍遷)</span>
            <span className="text-amber-400 font-semibold">S = 1.77 (臨界分界)</span>
            <span>2.80 (高強度亞瑞利)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-semibold text-slate-300">遠場地震測站垂直斷層距離 y</span>
            <span className="font-mono font-bold text-emerald-400">{stationDistKm} km</span>
          </div>
          <input
            type="range"
            min={10}
            max={60}
            step={1}
            value={stationDistKm}
            onChange={(e) => setStationDistKm(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>10 km (近斷層帶)</span>
            <span>25 km</span>
            <span>60 km (遠離震央城市)</span>
          </div>
        </div>
      </div>

      {/* 機制說明 */}
      <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400 leading-relaxed">
        <strong className="text-slate-200">物理提示：</strong>
        在傳統認知中，平面內剪力破裂前緣的穩定極限是瑞利波速 c<sub>R</sub> ≈ 0.92 c<sub>S</sub>；但當斷層初始剪應力接近岩石強度、使 S &lt; 1.77 時，奔跑在主裂紋前方的 S 波剪應力尖峰會直接激發「子裂紋」成核，讓破裂瞬間跳過 [c<sub>R</sub>, c<sub>S</sub>] 能量禁區並穩定於埃舍爾比速度 √2 c<sub>S</sub> 附近，匯聚出毀滅性的 V 形剪力馬赫錐。
      </div>
    </div>
  );
};
