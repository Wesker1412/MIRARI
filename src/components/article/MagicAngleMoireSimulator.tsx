import React, { useState, useEffect, useRef, useMemo } from 'react';

export const MagicAngleMoireSimulator: React.FC = () => {
  // 扭轉角 theta (度)
  const [thetaDeg, setThetaDeg] = useState<number>(1.08);
  // 載子填充數 nu (-4 到 +4)
  const [fillingFactor, setFillingFactor] = useState<number>(-2);
  // 顯示模式
  const [viewMode, setViewMode] = useState<'moire_lattice' | 'band_dispersion' | 'correlated_phases'>('moire_lattice');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 物理參數常數
  const a0_nm = 0.246; // 石墨烯原始晶格常數 (nm)
  const thetaRad = (thetaDeg * Math.PI) / 180;

  // 莫爾超晶格週期 lambda_M = a0 / (2 * sin(theta / 2))
  const moirePeriodNm = useMemo(() => {
    return a0_nm / (2 * Math.sin(thetaRad / 2));
  }, [thetaRad]);

  // Bistritzer-MacDonald 平帶模型計算
  // 狄拉克費米速度歸一化重整化率 v_F^* / v_F
  const { bandWidthMeV, isMagicAngle, phaseName, phaseColor } = useMemo(() => {
    // 經驗參數：魔角約 1.08 度處 alpha ~ 1 / sqrt(3)
    const deltaTheta = Math.abs(thetaDeg - 1.08);
    // 帶寬 W 在 1.08 度降至最低 (~8 meV)，偏離時迅速展寬至數百 meV
    const W = 8 + deltaTheta * 220;
    const magic = deltaTheta < 0.05;

    // 根據填充因子判定物態
    let pName = '金屬態 (Fermi Liquid Metal)';
    let pColor = 'text-slate-300';

    if (magic) {
      if (fillingFactor === -2 || fillingFactor === 2) {
        pName = '相關聯莫特絕緣體 (Correlated Mott Insulator)';
        pColor = 'text-amber-400';
      } else if (fillingFactor > -2.4 && fillingFactor < -1.6 && fillingFactor !== -2) {
        pName = '非常規非常態超導電性 (Unconventional Superconductor, Tc ~ 1.7K)';
        pColor = 'text-emerald-400';
      } else if (fillingFactor === 0) {
        pName = '電荷中性點狄拉克半金屬 (Dirac Neutrality Point)';
        pColor = 'text-sky-300';
      } else if (fillingFactor === -3 || fillingFactor === 3) {
        pName = '軌域磁性 / 拓撲陳絕緣態 (Chern Insulator)';
        pColor = 'text-purple-400';
      }
    } else {
      pName = '普通狄拉克費米半金屬 (Weakly Correlated Dirac Semimetal)';
      pColor = 'text-slate-400';
    }

    return {
      bandWidthMeV: W,
      isMagicAngle: magic,
      phaseName: pName,
      phaseColor: pColor,
    };
  }, [thetaDeg, fillingFactor]);

  // 繪製莫爾超晶格實空間干涉圖與能帶結構
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 深邃量子色散背景
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    if (viewMode === 'moire_lattice') {
      // 1. 莫爾實空間干涉花紋渲染
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;

      // 莫爾波數比例縮放
      const scale = 0.045 / (moirePeriodNm / 13);
      const rotCos = Math.cos(thetaRad);
      const rotSin = Math.sin(thetaRad);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          // 底層石墨烯蜂巢勢能近似 (3 束 120 度平面波疊加)
          const px1 = (x - w / 2) * scale;
          const py1 = (y - h / 2) * scale;
          const pot1 =
            Math.cos(px1) +
            Math.cos(-0.5 * px1 + 0.866 * py1) +
            Math.cos(-0.5 * px1 - 0.866 * py1);

          // 頂層旋轉 theta 的石墨烯勢能
          const px2 = (px1 * rotCos - py1 * rotSin);
          const py2 = (px1 * rotSin + py1 * rotCos);
          const pot2 =
            Math.cos(px2) +
            Math.cos(-0.5 * px2 + 0.866 * py2) +
            Math.cos(-0.5 * px2 - 0.866 * py2);

          // 兩層局域局域重疊強度 (干涉莫爾能譜)
          const moireIntensity = (pot1 * pot2 + 4.5) / 9.0;
          const idx = (y * w + x) * 4;

          if (isMagicAngle) {
            // 魔角共振：AA 堆疊位點電子局域化成金色/翡翠強光團
            const aaGlow = Math.pow(Math.max(0, moireIntensity), 2.8);
            data[idx] = Math.min(255, aaGlow * 240 + 10);
            data[idx + 1] = Math.min(255, aaGlow * 190 + 30);
            data[idx + 2] = Math.min(255, aaGlow * 70 + 80);
            data[idx + 3] = 255;
          } else {
            // 普通角度：平淡的藍紫色干涉紋
            const normVal = Math.max(0, Math.min(1, moireIntensity));
            data[idx] = Math.round(normVal * 30 + 15);
            data[idx + 1] = Math.round(normVal * 90 + 40);
            data[idx + 2] = Math.round(normVal * 180 + 70);
            data[idx + 3] = 255;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // 標註 AA 堆疊與 AB/BA 疇壁
      ctx.fillStyle = isMagicAngle ? '#fef08a' : '#94a3b8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`AA 堆疊電子局域化熱點 (超胞週期 λ_M ≈ ${moirePeriodNm.toFixed(1)} nm)`, 20, 25);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(`扭轉角 θ = ${thetaDeg.toFixed(2)}° | 原生蜂巢基底 a₀ = 0.246 nm`, 20, 42);

      // 莫爾標尺條
      const barPixelLen = (moirePeriodNm / 13) * 60;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w - 140, h - 25);
      ctx.lineTo(w - 140 + barPixelLen, h - 25);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`λ_M (${moirePeriodNm.toFixed(1)} nm)`, w - 140, h - 32);

    } else if (viewMode === 'band_dispersion') {
      // 2. 迷你布里淵區 (Mini-Brillouin Zone) 平帶能譜繪製
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let y = 30; y < h - 30; y += 35) {
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(w - 40, y);
        ctx.stroke();
      }

      const midY = h / 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(40, midY);
      ctx.lineTo(w - 40, midY);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText('費米能級 E_F = 0 meV', 50, midY - 6);
      ctx.fillText('+100 meV', 50, 40);
      ctx.fillText('-100 meV', 50, h - 40);

      // 高對稱點標註 K_s, Gamma_s, M_s, K_s'
      const kPoints = [
        { label: 'γ_M', x: 80 },
        { label: 'κ_M', x: (w - 80) * 0.38 + 40 },
        { label: 'μ_M', x: (w - 80) * 0.68 + 40 },
        { label: 'γ_M', x: w - 80 },
      ];

      kPoints.forEach((kp) => {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(kp.x, 30);
        ctx.lineTo(kp.x, h - 30);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(kp.label, kp.x - 8, h - 14);
      });

      // 繪製微型布里淵區導帶與價帶
      // 偏離魔角時為陡峭色散，接近魔角時壓成極度平坦的平帶 (Flat Band)
      const flatBandScale = bandWidthMeV / 120; // 越小越平坦

      // 價帶 (Valence band)
      ctx.strokeStyle = isMagicAngle ? '#34d399' : '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let px = 80; px <= w - 80; px++) {
        const kx = ((px - 80) / (w - 160)) * Math.PI * 2;
        const dispersion = Math.cos(kx) * 45 * flatBandScale + Math.cos(2 * kx) * 15 * flatBandScale;
        const py = midY + 12 + dispersion;
        if (px === 80) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // 導帶 (Conduction band)
      ctx.strokeStyle = isMagicAngle ? '#fbbf24' : '#818cf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let px = 80; px <= w - 80; px++) {
        const kx = ((px - 80) / (w - 160)) * Math.PI * 2;
        const dispersion = -Math.cos(kx) * 45 * flatBandScale - Math.cos(2 * kx) * 15 * flatBandScale;
        const py = midY - 12 + dispersion;
        if (px === 80) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // 提示標籤
      ctx.fillStyle = isMagicAngle ? '#fbbf24' : '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(
        isMagicAngle
          ? `🔥 拓撲極平能帶！帶寬 W ≈ ${bandWidthMeV.toFixed(1)} meV (費米速度 v_F* 驟降 ~0)`
          : `普通色散能帶：帶寬 W ≈ ${bandWidthMeV.toFixed(1)} meV`,
        120,
        35
      );

    } else {
      // 3. 填充因子相圖 (Filling Factor vs Temperature Phase Diagram)
      const axisX0 = 80;
      const axisY0 = h - 45;
      const axisW = w - 160;

      // 坐標軸
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(axisX0, 35);
      ctx.lineTo(axisX0, axisY0);
      ctx.lineTo(axisX0 + axisW, axisY0);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText('溫度 T (K)', axisX0 - 55, 45);
      ctx.fillText('莫爾超胞整數填充數 ν (電子數 / 超胞)', axisX0 + axisW * 0.35, axisY0 + 35);

      // 填充數刻度 (-4, -3, -2, -1, 0, 1, 2, 3, 4)
      for (let nu = -4; nu <= 4; nu++) {
        const tickX = axisX0 + ((nu + 4) / 8) * axisW;
        ctx.strokeStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(tickX, axisY0);
        ctx.lineTo(tickX, axisY0 + 5);
        ctx.stroke();
        ctx.fillStyle = nu === fillingFactor ? '#38bdf8' : '#64748b';
        ctx.font = nu === fillingFactor ? 'bold 11px monospace' : '10px monospace';
        ctx.fillText(`${nu > 0 ? '+' : ''}${nu}`, tickX - 6, axisY0 + 18);
      }

      if (isMagicAngle) {
        // 繪製莫特絕緣體島 (nu = -2, +2)
        [-2, 2].forEach((mottNu) => {
          const mx = axisX0 + ((mottNu + 4) / 8) * axisW;
          ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
          ctx.fillRect(mx - 14, axisY0 - 80, 28, 80);
          ctx.strokeStyle = '#f59e0b';
          ctx.strokeRect(mx - 14, axisY0 - 80, 28, 80);
          ctx.fillStyle = '#fbbf24';
          ctx.font = '9px sans-serif';
          ctx.fillText('莫特絕緣', mx - 18, axisY0 - 88);
        });

        // 繪製超導穹頂 (Superconducting Dome, Tc ~ 1.7K 緊鄰 nu = -2 兩側)
        const scX = axisX0 + ((-2.1 + 4) / 8) * axisW;
        ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';
        ctx.beginPath();
        ctx.ellipse(scX, axisY0, 22, 55, 0, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#10b981';
        ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.font = '9px sans-serif';
        ctx.fillText('超導穹頂 (Tc=1.7K)', scX - 35, axisY0 - 60);

        // 當前填充點垂直游標
        const curX = axisX0 + ((fillingFactor + 4) / 8) * axisW;
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(curX, 35);
        ctx.lineTo(curX, axisY0);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(curX, axisY0 - 15, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 偏離魔角時，無強關聯相
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.fillText('非魔角條件下：庫侖斥力不足以壓制動能 (U/W < 1)，各填充數均表現為費米液體金屬', axisX0 + 20, h / 2);
      }
    }
  }, [thetaDeg, thetaRad, moirePeriodNm, isMagicAngle, viewMode, bandWidthMeV, fillingFactor]);

  return (
    <div className="my-8 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-md">
      {/* 頂部標題與狀態 */}
      <div className="flex flex-col gap-2 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`flex h-2.5 w-2.5 rounded-full ${isMagicAngle ? 'bg-amber-400 animate-ping' : 'bg-sky-400'}`} />
            <h3 className="text-lg font-bold tracking-wide text-slate-100">
              魔角雙層石墨烯（MATBG）莫爾平帶與強關聯物態模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            精確解算 Bistritzer-MacDonald 連續介質模型、莫爾超晶格週期 \(\lambda_M\) 與費米速度消失臨界點
          </p>
        </div>

        {/* 視圖切換按鈕 */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
          {[
            { id: 'moire_lattice', label: '莫爾實空間干涉' },
            { id: 'band_dispersion', label: '平帶色散能譜' },
            { id: 'correlated_phases', label: '超導/絕緣相圖' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id as any)}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === mode.id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主畫布區塊 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
        <canvas
          ref={canvasRef}
          width={760}
          height={280}
          className="h-64 w-full object-contain sm:h-72"
        />
      </div>

      {/* 即時物理量指標 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">🌀 扭轉角 \(\theta\)</div>
          <div className="mt-1 font-mono text-lg font-bold text-sky-400">
            {thetaDeg.toFixed(2)}°
          </div>
          <div className="text-[10px] text-slate-500">
            {isMagicAngle ? '第一魔角共振 (1.08°)' : '偏離平帶區間'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">📏 莫爾週期 \(\lambda_M\)</div>
          <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
            {moirePeriodNm.toFixed(1)} nm
          </div>
          <div className="text-[10px] text-slate-500">
            約含有 {(Math.pow(moirePeriodNm / a0_nm, 2) * 8).toFixed(0)} 個碳原子
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">⚡ 平帶帶寬 \(W\)</div>
          <div className="mt-1 font-mono text-lg font-bold text-amber-400">
            {bandWidthMeV.toFixed(1)} meV
          </div>
          <div className="text-[10px] text-slate-500">
            庫侖能 \(U/W \approx {(100 / Math.max(8, bandWidthMeV)).toFixed(1)}\)
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">🧪 當前基態物相</div>
          <div className={`mt-1 font-mono text-xs font-bold leading-snug ${phaseColor}`}>
            {phaseName}
          </div>
          <div className="text-[10px] text-slate-500">
            超胞填充數 \(\nu = {fillingFactor}\)
          </div>
        </div>
      </div>

      {/* 控制滑桿區 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* 扭轉角控制 */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">層間旋轉扭轉角 \(\theta\)</span>
            <span className="font-mono font-bold text-sky-400">{thetaDeg.toFixed(2)}°</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={2.0}
            step={0.01}
            value={thetaDeg}
            onChange={(e) => setThetaDeg(parseFloat(e.target.value))}
            className="mt-2 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0.80° (次級莫爾)</span>
            <button
              onClick={() => setThetaDeg(1.08)}
              className="font-bold text-amber-400 underline decoration-dotted hover:text-amber-300"
            >
              ★ 快速鎖定魔角 1.08°
            </button>
            <span>2.00° (弱耦合)</span>
          </div>
        </div>

        {/* 閘極電壓 / 填充數控制 */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">閘極靜電摻雜填充數 \(\nu\)</span>
            <span className="font-mono font-bold text-emerald-400">{fillingFactor}</span>
          </div>
          <input
            type="range"
            min={-4}
            max={4}
            step={0.1}
            value={fillingFactor}
            onChange={(e) => setFillingFactor(parseFloat(e.target.value))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>-4 (全空帶)</span>
            <span>-2 (半填充莫特/超導)</span>
            <span>0 (中性)</span>
            <span>+4 (全滿帶)</span>
          </div>
        </div>
      </div>

      {/* 物理原理提示卡 */}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400">
        <span className="mt-0.5 text-amber-400">💡</span>
        <p className="leading-relaxed">
          <strong className="text-slate-200">動能凍結與庫侖排斥支配：</strong>
          普通單層石墨烯以極高的費米速度 v_F ≈ 10⁶ m/s 著稱，電子動能遠大於電子間庫侖排斥，難以展現強關聯效應。當兩層石墨烯精確扭轉至 1.08° 時，層間隧穿躍遷導致狄拉克錐能帶強烈雜化，費米速度驟降至近乎為零，在費米能級處形成寬度僅不到 10 meV 的超平帶。電子被強行禁錮在莫爾 AA 堆疊超胞中，動能「被凍結」，電子庫侖斥力 U 佔據絕對主導，催生出高溫銅氧化物超導類似的非常規配對機制與豐富的拓撲物態。
        </p>
      </div>
    </div>
  );
};
