import React, { useState, useEffect, useRef } from 'react';

/**
 * ChandrasekharLimitSimulator - 錢德拉塞卡極限與白矮星簡併壓崩塌模擬器
 * 
 * 物理原理：
 * 1. 非相對論性電子簡併壓：P ∝ ρ^(5/3)，恆星半徑與質量成反比 R ∝ M^(-1/3)。質量越大的白矮星，半徑反而越小。
 * 2. 極端相對論性轉折：當中心密度 ρ_c > 10^6 g/cm^3 時，費米動量 p_F 逼近 mc，狀態方程軟化為 P ∝ ρ^(4/3)。
 * 3. 錢德拉塞卡極限 (M_Ch ≈ 1.44 M_sun)：相對論簡併壓的幾何縮放恰與重力完全相同，若質量超越臨界值，半徑 R 趨向於零，引發必然塌縮。
 */
export const ChandrasekharLimitSimulator: React.FC = () => {
  const [massRatio, setMassRatio] = useState<number>(0.8); // 0.2 ~ 1.43 M_sun
  const [muE, setMuE] = useState<number>(2.0); // 碳氧白矮星 μ_e = 2.0; 鐵核 μ_e ≈ 2.15
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 錢德拉塞卡極限計算：M_Ch = 5.83 / μ_e^2 M_sun
  const mCh = 5.83 / (muE * muE);

  // 萊恩-埃姆登解算：簡化白矮星半徑估算 (單位：地球半徑 R_earth ≈ 6371 km)
  // 當 M << M_Ch 時，R ∝ M^(-1/3)
  // 當 M -> M_Ch 時，R -> R0 * (1 - (M/M_Ch)^(4/3))^(1/2)
  const normalizedMass = Math.min(massRatio / mCh, 0.999);
  const radiusInEarthUnits = Math.max(
    0.05,
    1.8 * Math.pow(massRatio, -1 / 3) * Math.sqrt(Math.max(0, 1 - Math.pow(normalizedMass, 4 / 3)))
  );

  // 中心費米相對論參數 x_F = p_F / (m_e c)
  const centralRelativityParam = Math.pow(massRatio / (0.3 + 0.1 * (1 - normalizedMass)), 1.2) * 1.5;

  // 繪製恆星截面與 M-R 演化曲線
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // 分為左右兩區：左側為恆星幾何視圖，右側為 M-R 理論曲線圖
    const leftWidth = width * 0.45;

    // ─────────────────────── 左側：白矮星截面視圖 ───────────────────────
    const centerX = leftWidth / 2;
    const centerY = height / 2;

    // 依計算出的半徑映射到畫布像素
    const visualRadius = Math.max(8, radiusInEarthUnits * 32);

    // 外圍引力場虛線環
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 白矮星本體漸層：隨密度增加從天藍轉為刺目亮白/高能紫
    const starGrad = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      visualRadius
    );

    if (normalizedMass > 0.9) {
      starGrad.addColorStop(0, '#ffffff');
      starGrad.addColorStop(0.3, '#f43f5e'); // 瀕臨崩塌高能熱輻射
      starGrad.addColorStop(0.8, '#881337');
      starGrad.addColorStop(1, 'rgba(136, 19, 55, 0)');
    } else {
      starGrad.addColorStop(0, '#ffffff');
      starGrad.addColorStop(0.4, '#38bdf8'); // 典型白矮星電子簡併冷光
      starGrad.addColorStop(0.8, '#1e3a8a');
      starGrad.addColorStop(1, 'rgba(30, 58, 138, 0)');
    }

    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, visualRadius, 0, Math.PI * 2);
    ctx.fill();

    // 內部重力壓縮向量箭頭
    if (visualRadius > 20) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
        const outerX = centerX + Math.cos(angle) * (visualRadius * 0.85);
        const outerY = centerY + Math.sin(angle) * (visualRadius * 0.85);
        const innerX = centerX + Math.cos(angle) * (visualRadius * 0.4);
        const innerY = centerY + Math.sin(angle) * (visualRadius * 0.4);

        ctx.beginPath();
        ctx.moveTo(outerX, outerY);
        ctx.lineTo(innerX, innerY);
        ctx.stroke();
      }
    }

    // 標籤
    ctx.fillStyle = '#1e293b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `半徑 R ≈ ${radiusInEarthUnits.toFixed(2)} R⊕`,
      centerX,
      height - 18
    );
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.fillText(
      normalizedMass > 0.95 ? '⚠️ 逼近極限：極端相對論軟化' : '穩定態：非相對論簡併壓支撐',
      centerX,
      height - 32
    );

    // ─────────────────────── 右側：質量-半徑 (M-R) 曲線 ───────────────────────
    const graphLeft = leftWidth + 40;
    const graphRight = width - 25;
    const graphTop = 30;
    const graphBottom = height - 40;
    const graphW = graphRight - graphLeft;
    const graphH = graphBottom - graphTop;

    // 座標軸
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(graphLeft, graphTop);
    ctx.lineTo(graphLeft, graphBottom);
    ctx.lineTo(graphRight, graphBottom);
    ctx.stroke();

    // 座標網格與刻度
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0', graphLeft, graphBottom + 14);
    ctx.fillText('0.5', graphLeft + graphW * (0.5 / 1.6), graphBottom + 14);
    ctx.fillText('1.0', graphLeft + graphW * (1.0 / 1.6), graphBottom + 14);
    ctx.fillText(`M_Ch ≈ ${mCh.toFixed(2)} M☉`, graphLeft + graphW * (mCh / 1.6), graphBottom + 14);

    ctx.textAlign = 'right';
    ctx.fillText('半徑 R', graphLeft - 6, graphTop + 8);
    ctx.fillText('質量 M (M☉)', graphRight, graphBottom + 25);

    // 畫出錢德拉塞卡垂直漸近極限線
    const chX = graphLeft + graphW * (mCh / 1.6);
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(chX, graphTop);
    ctx.lineTo(chX, graphBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // 繪製理論 M-R 曲線
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let m = 0.1; m <= mCh * 0.995; m += 0.02) {
      const normM = m / mCh;
      const rVal = Math.max(
        0,
        1.8 * Math.pow(m, -1 / 3) * Math.sqrt(Math.max(0, 1 - Math.pow(normM, 4 / 3)))
      );
      const px = graphLeft + graphW * (m / 1.6);
      const py = graphBottom - (rVal / 3.0) * graphH;

      if (m === 0.1) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // 標記當前選取點 (Mass, Radius)
    const currentPx = graphLeft + graphW * (massRatio / 1.6);
    const currentPy = graphBottom - (radiusInEarthUnits / 3.0) * graphH;

    ctx.fillStyle = normalizedMass > 0.9 ? '#ef4444' : '#2563eb';
    ctx.beginPath();
    ctx.arc(currentPx, currentPy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
  }, [massRatio, muE, mCh, radiusInEarthUnits, normalizedMass]);

  return (
    <div className="my-8 rounded-xl border border-mirari-line bg-mirari-paper p-5 sm:p-6 text-mirari-ink font-sans shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-mirari-line gap-3">
        <div>
          <span className="text-xs uppercase tracking-widest text-mirari-dim font-mono">
            INTERACTIVE EXPERIMENT
          </span>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-mirari-ink">
            錢德拉塞卡極限與白矮星質量-半徑演化模擬器
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono bg-blue-100 text-blue-800">
            萊恩-埃姆登相對論多方球數值解
          </span>
        </div>
      </div>

      {/* 畫布 */}
      <div className="mt-4 relative bg-white/70 rounded-lg border border-mirari-line/60 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={680}
          height={260}
          className="w-full h-auto block"
        />
      </div>

      {/* 控制滑桿 */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
        {/* 控制項 1: 恆星質量 */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-xs text-mirari-dim">
            <span>白矮星質量 M</span>
            <span className="font-bold text-mirari-ink">{massRatio.toFixed(2)} M☉ ({((massRatio / mCh) * 100).toFixed(0)}% M_Ch)</span>
          </div>
          <input
            type="range"
            min="0.2"
            max={mCh * 0.99}
            step="0.01"
            value={massRatio}
            onChange={(e) => setMassRatio(parseFloat(e.target.value))}
            className="w-full accent-blue-600"
          />
          <p className="text-[11px] text-mirari-dim leading-snug">
            觀察經典量子力學奇蹟：質量越大，為抵抗重力，電子費米球被迫擴大，體積反而收縮！
          </p>
        </div>

        {/* 控制項 2: 每電子平均分子量 μ_e */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-xs text-mirari-dim">
            <span>組成核素 (每電子平均分子量 μ_e)</span>
            <span className="font-bold text-mirari-ink">{muE === 2.0 ? '碳氧核心 (μ_e = 2.0)' : '鐵核心 (μ_e = 2.15)'}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMuE(2.0)}
              className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${
                muE === 2.0
                  ? 'bg-blue-600 text-white border-blue-600 font-bold'
                  : 'bg-white text-mirari-ink border-mirari-line hover:bg-gray-50'
              }`}
            >
              典型碳-氧 (1.44 M☉)
            </button>
            <button
              onClick={() => setMuE(2.15)}
              className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${
                muE === 2.15
                  ? 'bg-blue-600 text-white border-blue-600 font-bold'
                  : 'bg-white text-mirari-ink border-mirari-line hover:bg-gray-50'
              }`}
            >
              演化晚期鐵核 (1.26 M☉)
            </button>
          </div>
          <p className="text-[11px] text-mirari-dim leading-snug">
            化學元素中質子與中子比值直接決定自由電子密度，改變理論質量上限。
          </p>
        </div>
      </div>

      {/* 狀態數值面板 */}
      <div className="mt-5 p-4 rounded-lg bg-mirari-paper-dark border border-mirari-line grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div>
          <div className="text-[11px] text-mirari-dim font-mono">天體半徑 R</div>
          <div className="text-lg font-bold text-blue-700 font-mono">
            {(radiusInEarthUnits * 6371).toFixed(0)} km
          </div>
          <div className="text-[10px] text-mirari-dim">約 {radiusInEarthUnits.toFixed(2)} 倍地球半徑</div>
        </div>
        <div>
          <div className="text-[11px] text-mirari-dim font-mono">相對論參數 x_F</div>
          <div className="text-lg font-bold text-indigo-700 font-mono">
            {centralRelativityParam.toFixed(2)}
          </div>
          <div className="text-[10px] text-mirari-dim">{centralRelativityParam > 1.0 ? '超相對論狀態' : '非相對論狀態'}</div>
        </div>
        <div>
          <div className="text-[11px] text-mirari-dim font-mono">狀態方程多方指數</div>
          <div className="text-lg font-bold text-amber-700 font-mono">
            {normalizedMass > 0.85 ? 'γ → 4/3' : 'γ ≈ 5/3'}
          </div>
          <div className="text-[10px] text-mirari-dim">4/3 意味著力學失穩</div>
        </div>
        <div>
          <div className="text-[11px] text-mirari-dim font-mono">錢氏質量極限 M_Ch</div>
          <div className="text-lg font-bold text-rose-700 font-mono">
            {mCh.toFixed(2)} M☉
          </div>
          <div className="text-[10px] text-mirari-dim">不可逾越的引力終點</div>
        </div>
      </div>

      {/* 邊界提示 */}
      <div className="mt-3 text-[11px] text-mirari-dim leading-relaxed border-t border-mirari-line/50 pt-2">
        <span className="font-semibold text-mirari-ink">物理邊界說明：</span> 本模擬基於零溫理想簡併費米氣體及球對稱萊恩-埃姆登方程（Lane-Emden Equation，多方指數從 n=1.5 漸變至 n=3）。真實天體若存在高速自轉，離心力可將極限質量略微推升至約 1.48–1.5 M☉；而若質量超越此界，天體將引發失控核燃燒（Ia 型超新星）或直接坍縮為中子星與黑洞。
      </div>
    </div>
  );
};
