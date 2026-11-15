import React, { useState, useEffect, useRef, useMemo } from 'react';

type SalinityMode = 'low' | 'physiological' | 'high';

interface SalinityProfile {
  label: string;
  concLabel: string;
  lpNm: number; // 駐留長度 Lp (nm)
  overstretchForcePN: number; // 過拉伸相變平台力 (pN)
  stretchModulusPN: number; // 彈性拉伸模量 K0 (pN)
}

const SALINITY_PROFILES: Record<SalinityMode, SalinityProfile> = {
  low: {
    label: '低鹽 10 mM Na⁺',
    concLabel: '10 mM NaCl（靜電排斥增強剛性）',
    lpNm: 62,
    overstretchForcePN: 59.0,
    stretchModulusPN: 1050,
  },
  physiological: {
    label: '生理鹽度 150 mM Na⁺',
    concLabel: '150 mM NaCl（標準 B-DNA 參數）',
    lpNm: 50,
    overstretchForcePN: 65.0,
    stretchModulusPN: 1150,
  },
  high: {
    label: '高鹽 500 mM Na⁺',
    concLabel: '500 mM NaCl（陽離子屏蔽穩定雙螺旋）',
    lpNm: 45,
    overstretchForcePN: 68.5,
    stretchModulusPN: 1200,
  },
};

const KBT_PN_NM = 4.114; // 室溫 298 K: k_B * T ≈ 4.114 pN·nm

/**
 * 計算可拉伸 WLC + 65 pN 合作過拉伸相變 (Overstretching Transition) 的力-伸長關係 F(x/L0)
 * @param extRatio x / L0 (0.05 ~ 1.82)
 */
function computeDnaForcePN(extRatio: number, profile: SalinityProfile): number {
  const { lpNm, overstretchForcePN, stretchModulusPN } = profile;

  // 合作過拉伸平台中心在 x/L0 ≈ 1.03 ~ 1.70 之間
  // 以平滑反函數將 B-form 與 S-form (或熔解態) 混合
  if (extRatio <= 0.92) {
    const r = Math.max(0.02, extRatio);
    const wlc =
      (KBT_PN_NM / lpNm) * (0.25 / Math.pow(1 - r, 2) - 0.25 + r);
    return Math.min(overstretchForcePN - 4, wlc);
  }

  // 高力漸近線：透過平滑過渡函數銜接熵彈性 -> 焓彈性 -> 65 pN 合作過拉伸平台 -> S-DNA 陡升
  // 在過拉伸前 (F < F_os)，彈性伸長 r = 1 - 0.5*sqrt(kBT/(F*Lp)) + F/K0
  // 反演平滑近似：
  if (extRatio < 1.035) {
    // 0.92 -> 1.035 之間從 ~5 pN 急劇攀升至 overstretchForcePN
    const t = (extRatio - 0.92) / (1.035 - 0.92);
    const fLow =
      (KBT_PN_NM / lpNm) * (0.25 / Math.pow(1 - 0.92, 2) - 0.25 + 0.92);
    const enthalpic = Math.max(0, (extRatio - 0.96) * stretchModulusPN * 0.45);
    const raw = fLow + t * (overstretchForcePN - fLow) * 0.65 + enthalpic;
    return Math.min(overstretchForcePN - 0.8, raw);
  }

  if (extRatio <= 1.70) {
    // 合作過拉伸平台 (約 1.035 到 1.70 倍原長，力僅微幅爬升 ~3 pN)
    const u = (extRatio - 1.035) / (1.70 - 1.035);
    // 合作轉換 Sigmoid 斜坡
    return overstretchForcePN - 0.8 + u * 3.6 + 0.6 * Math.sin((u - 0.5) * Math.PI);
  }

  // 過拉伸完成 (x/L0 > 1.70)：轉為高剛性 S-DNA / 雙股骨架張力陡升
  const excess = extRatio - 1.70;
  return overstretchForcePN + 3.4 + excess * 420;
}

export const OpticalTweezersSimulator: React.FC = () => {
  // 相對拉伸比 x / L0 (B-DNA 原長 L0 ≈ 16.4 μm for λ-DNA)
  const [extensionRatio, setExtensionRatio] = useState<number>(0.78);
  // 光學陷阱剛度 k_trap (pN/nm)
  const [trapStiffness, setTrapStiffness] = useState<number>(0.25);
  // 緩衝液鹽度條件
  const [salinity, setSalinity] = useState<SalinityMode>('physiological');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const profile = SALINITY_PROFILES[salinity];

  const metrics = useMemo(() => {
    const forcePN = computeDnaForcePN(extensionRatio, profile);
    const beadDisplacementNm = forcePN / trapStiffness;
    // 光阱諧振勢能 U = 0.5 * k * dx^2 (換算為 k_B T 單位)
    const trapEnergyKbt = (0.5 * trapStiffness * beadDisplacementNm * beadDisplacementNm) / KBT_PN_NM;

    let regimeLabel = '低力熵彈性區（WLC 捲曲展開）';
    let regimeColor = 'text-sky-400';
    if (extensionRatio >= 0.95 && extensionRatio < 1.035) {
      regimeLabel = '焓彈性區（B-DNA 骨架主鏈拉緊）';
      regimeColor = 'text-amber-300';
    } else if (extensionRatio >= 1.035 && extensionRatio <= 1.70) {
      regimeLabel = '65 pN 合作過拉伸相變平台（~1.7× 伸長）';
      regimeColor = 'text-rose-400';
    } else if (extensionRatio > 1.70) {
      regimeLabel = '後過拉伸高張力區（S-DNA 骨架極限）';
      regimeColor = 'text-purple-400';
    }

    return {
      forcePN,
      beadDisplacementNm,
      trapEnergyKbt,
      regimeLabel,
      regimeColor,
    };
  }, [extensionRatio, trapStiffness, profile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 深邃暗場顯微鏡背景
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, W, H);

    // ─── 左側：光鑷雷射光錐與 DNA 單分子拉伸示意 ───────────────────
    const leftW = W * 0.45;
    ctx.fillStyle = '#0a1120';
    ctx.fillRect(12, 12, leftW - 18, H - 24);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, leftW - 18, H - 24);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('光鑷梯度力陷阱與 λ-DNA 單分子機構', 24, 32);

    // 雷射焦點中心座標
    const trapFocusX = leftW * 0.68;
    const trapCenterY = H * 0.54;

    // 微球受拉力的偏移 dx (視覺限制於合理像素範圍)
    const visDeltaX = Math.min(24, metrics.beadDisplacementNm * 0.065);
    const beadX = trapFocusX - visDeltaX;
    const beadY = trapCenterY;
    const beadR = 21;

    // 高斯聚焦雷射束錐體 (垂直貫穿)
    const beamGrad = ctx.createLinearGradient(trapFocusX - 45, 0, trapFocusX + 45, 0);
    beamGrad.addColorStop(0, 'rgba(16, 185, 129, 0)');
    beamGrad.addColorStop(0.5, 'rgba(52, 211, 153, 0.34)');
    beamGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(trapFocusX - 58, 42);
    ctx.lineTo(trapFocusX + 58, 42);
    ctx.lineTo(trapFocusX + 9, trapCenterY);
    ctx.lineTo(trapFocusX + 58, H - 26);
    ctx.lineTo(trapFocusX - 58, H - 26);
    ctx.lineTo(trapFocusX - 9, trapCenterY);
    ctx.closePath();
    ctx.fill();

    // 雷射光束聚焦邊線
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(trapFocusX - 46, 42);
    ctx.lineTo(trapFocusX + 46, H - 26);
    ctx.moveTo(trapFocusX + 46, 42);
    ctx.lineTo(trapFocusX - 46, H - 26);
    ctx.stroke();

    // 左側固定微吸管/載玻片錨點 (隨伸長比移動呈現微動平台位移)
    const anchorX = Math.max(38, beadX - beadR - 30 - extensionRatio * 95);
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(anchorX, trapCenterY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.fillText('微動平台錨點', anchorX - 24, trapCenterY + 24);

    // 繪製繫留 DNA 分子 (在低伸長時彎曲起伏，高伸長時繃緊，過拉伸區呈現雙螺旋解旋/伸長亮紅)
    const dnaStartX = anchorX + 12;
    const dnaEndX = beadX - beadR;
    const dnaSpan = Math.max(12, dnaEndX - dnaStartX);

    const isOverstretched = extensionRatio >= 1.035;
    const slackAmp = Math.max(0.5, (1 - Math.min(1, extensionRatio)) * 22);

    // 雙螺旋雙股示意
    for (let strand = 0; strand < 2; strand++) {
      ctx.strokeStyle = isOverstretched
        ? strand === 0
          ? '#fb7185'
          : '#f43f5e'
        : strand === 0
        ? '#38bdf8'
        : '#818cf8';
      ctx.lineWidth = isOverstretched ? 1.8 : 2.1;
      ctx.beginPath();

      const steps = 64;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const px = dnaStartX + u * dnaSpan;
        // 隨機熱起伏包絡 + 雙螺旋週期
        const thermalWave =
          Math.sin(u * Math.PI * 5 + strand * 1.4) * slackAmp * Math.sin(u * Math.PI);
        const helixPitch = isOverstretched ? Math.PI * 6 : Math.PI * 18;
        const helixAmp = isOverstretched ? 2.2 : 4.2;
        const py =
          trapCenterY +
          thermalWave +
          Math.sin(u * helixPitch + strand * Math.PI) * helixAmp;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // 聚苯乙烯介電微球 (n ≈ 1.59)
    const sphereGrad = ctx.createRadialGradient(
      beadX - 6,
      beadY - 6,
      3,
      beadX,
      beadY,
      beadR
    );
    sphereGrad.addColorStop(0, '#f8fafc');
    sphereGrad.addColorStop(0.55, '#94a3b8');
    sphereGrad.addColorStop(1, '#334155');
    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(beadX, beadY, beadR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 繪製梯度回復力向量箭頭 (若微球偏離焦點)
    if (visDeltaX > 2) {
      ctx.strokeStyle = '#fbbf24';
      ctx.fillStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(beadX, beadY - 28);
      ctx.lineTo(beadX + Math.max(14, visDeltaX), beadY - 28);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(beadX + Math.max(14, visDeltaX) + 5, beadY - 28);
      ctx.lineTo(beadX + Math.max(14, visDeltaX) - 2, beadY - 32);
      ctx.lineTo(beadX + Math.max(14, visDeltaX) - 2, beadY - 24);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 10px monospace';
      ctx.fillText('F_grad = -k·Δx', beadX - 24, beadY - 36);
    }

    // 光束焦點標線
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.7)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(trapFocusX, trapCenterY - 34);
    ctx.lineTo(trapFocusX, trapCenterY + 34);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#6ee7b7';
    ctx.font = '10px sans-serif';
    ctx.fillText('雷射焦點 (高光強)', trapFocusX - 36, H - 18);

    // ─── 右側：單分子力-伸長譜儀 (Force–Extension Curve) ────────────
    const chartLeft = W * 0.51;
    const chartRight = W - 24;
    const chartTop = 44;
    const chartBottom = H - 46;
    const chartW = chartRight - chartLeft;
    const chartH = chartBottom - chartTop;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(chartLeft, chartTop, chartW, chartH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(chartLeft, chartTop, chartW, chartH);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('單分子力譜曲線 Force–Extension Curve', chartLeft + 6, chartTop - 12);

    const maxForcePlot = 100; // pN
    const maxRatioPlot = 1.85;
    const toPlotX = (r: number) => chartLeft + (r / maxRatioPlot) * chartW;
    const toPlotY = (f: number) =>
      chartBottom - Math.min(1, Math.max(0, f / maxForcePlot)) * chartH;

    // 水平格線 (20, 40, 60, 80 pN)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (let f = 20; f <= 80; f += 20) {
      const gy = toPlotY(f);
      ctx.beginPath();
      ctx.moveTo(chartLeft, gy);
      ctx.lineTo(chartRight, gy);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText(`${f}`, chartLeft - 19, gy + 3);
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('F (pN)', chartLeft - 32, chartTop + 10);

    // 垂直參考線: x/L0 = 1.0 與 1.7
    [1.0, 1.7].forEach((rxVal) => {
      const gx = toPlotX(rxVal);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(gx, chartTop);
      ctx.lineTo(gx, chartBottom);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // X 軸標籤
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.fillText('0', chartLeft, chartBottom + 14);
    ctx.fillText('0.5', toPlotX(0.5) - 8, chartBottom + 14);
    ctx.fillText('1.0 L₀', toPlotX(1.0) - 14, chartBottom + 14);
    ctx.fillText('1.7 L₀', toPlotX(1.7) - 14, chartBottom + 14);
    ctx.font = '10px sans-serif';
    ctx.fillText('相對伸長比 x / L₀', chartRight - 96, chartBottom + 28);

    // 65 pN 過拉伸相變平台標記帶
    const osY = toPlotY(profile.overstretchForcePN);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(chartLeft, osY);
    ctx.lineTo(chartRight, osY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fda4af';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(
      `過拉伸平台 ≈ ${profile.overstretchForcePN.toFixed(1)} pN`,
      chartLeft + 10,
      osY - 6
    );

    // 繪製純 Marko-Siggia WLC 理論虛線 (僅在 x/L0 < 0.99 有效)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    let wlcStarted = false;
    for (let r = 0.04; r <= 0.98; r += 0.01) {
      const fWlc =
        (KBT_PN_NM / profile.lpNm) * (0.25 / Math.pow(1 - r, 2) - 0.25 + r);
      if (fWlc > maxForcePlot) break;
      const px = toPlotX(r);
      const py = toPlotY(fWlc);
      if (!wlcStarted) {
        ctx.moveTo(px, py);
        wlcStarted = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 繪製完整實測 Force-Extension 曲線 (WLC + Overstretching)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let r = 0.04; r <= 1.82; r += 0.01) {
      const fVal = computeDnaForcePN(r, profile);
      const px = toPlotX(r);
      const py = toPlotY(fVal);
      if (r === 0.04) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 繪製當前操作游標點
    const curX = toPlotX(extensionRatio);
    const curY = toPlotY(metrics.forcePN);

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(curX, chartTop);
    ctx.lineTo(curX, chartBottom);
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [extensionRatio, trapStiffness, profile, metrics]);

  return (
    <div className="my-8 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 sm:p-5 shadow-2xl overflow-hidden">
      {/* 標題與鹽度切換 */}
      <div className="flex flex-col gap-3 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-100">
              光鑷單分子力譜與 DNA 雙螺旋過拉伸模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            探索雷射梯度力諧振勢阱、Marko–Siggia 蠕蟲鏈（WLC）熵彈性與 65 pN 合作相變平台
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {(['low', 'physiological', 'high'] as SalinityMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSalinity(mode)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                salinity === mode
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {SALINITY_PROFILES[mode].label}
            </button>
          ))}
        </div>
      </div>

      {/* 畫布視圖 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          className="w-full h-auto block rounded-lg"
        />
      </div>

      {/* 即時指標 */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-w-0">
          <div className="text-xs text-slate-400">⚖️ 實測分子拉力 F</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-amber-400">
            {metrics.forcePN.toFixed(2)} pN
          </div>
          <div className="text-[10px] text-slate-500">
            1 pN = 10<sup>-12</sup> N
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-w-0">
          <div className="text-xs text-slate-400">📍 微球偏離焦點 Δx</div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-emerald-400">
            {metrics.beadDisplacementNm.toFixed(1)} nm
          </div>
          <div className="text-[10px] text-slate-500">
            勢阱能 ≈ {metrics.trapEnergyKbt.toFixed(0)} k<sub>B</sub>T
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-w-0">
          <div className="text-xs text-slate-400">🧬 駐留長度 L<sub>p</sub></div>
          <div className="mt-1 font-mono text-base sm:text-lg font-bold text-sky-400">
            {profile.lpNm} nm
          </div>
          <div className="text-[10px] text-slate-500">
            約 {Math.round(profile.lpNm / 0.34)} 個鹼基對剛性尺度
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 min-w-0">
          <div className="text-xs text-slate-400">🔬 分子力學狀態</div>
          <div className={`mt-1 text-xs font-bold leading-snug ${metrics.regimeColor}`}>
            {metrics.regimeLabel}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {profile.concLabel}
          </div>
        </div>
      </div>

      {/* 滑桿控制 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-semibold text-slate-300">相對伸長比 x / L<sub>0</sub></span>
            <span className="font-mono font-bold text-sky-400">{extensionRatio.toFixed(2)} L<sub>0</sub></span>
          </div>
          <input
            type="range"
            min={0.10}
            max={1.80}
            step={0.01}
            value={extensionRatio}
            onChange={(e) => setExtensionRatio(parseFloat(e.target.value))}
            className="mt-2 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.10 (熱捲曲)</span>
            <span className="text-rose-400 font-semibold">1.03–1.70 (65 pN 相變平台)</span>
            <span>1.80 (過拉伸極限)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-semibold text-slate-300">光學陷阱剛度 k<sub>trap</sub></span>
            <span className="font-mono font-bold text-emerald-400">{trapStiffness.toFixed(2)} pN/nm</span>
          </div>
          <input
            type="range"
            min={0.10}
            max={0.60}
            step={0.01}
            value={trapStiffness}
            onChange={(e) => setTrapStiffness(parseFloat(e.target.value))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.10 (軟光阱)</span>
            <span>0.25 (標準實驗配置)</span>
            <span>0.60 (高功率緊束光阱)</span>
          </div>
        </div>
      </div>

      {/* 機制說明 */}
      <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400 leading-relaxed">
        <strong className="text-slate-200">物理提示：</strong>
        在低拉力區（x &lt; 0.95 L<sub>0</sub>），你拉直的並非共價鍵，而是熱運動造成的熵捲曲（WLC 模型）；當 x/L<sub>0</sub> 逼近 1.0 且張力跨越約 65 pN 時，雙股 B-DNA 會爆發合作過拉伸相變，在幾乎恆定的力下突然伸長約 1.7 倍，將螺旋結構重排為平直的 S-DNA 或局部鹼基解鏈。
      </div>
    </div>
  );
};
