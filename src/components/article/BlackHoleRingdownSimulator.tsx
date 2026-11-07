import React, { useState, useEffect, useRef } from 'react';

export const BlackHoleRingdownSimulator: React.FC = () => {
  const [remnantMass, setRemnantMass] = useState<number>(65); // Solar masses M_sun (30 to 120)
  const [dimensionlessSpin, setDimensionlessSpin] = useState<number>(0.68); // chi = a / M (0.0 to 0.95)
  const [includeOvertone, setIncludeOvertone] = useState<boolean>(true); // n=1 overtone

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Gravitational Wave Quasi-Normal Mode (QNM) calculations for Kerr black hole
  // Fundamental mode (l=2, m=2, n=0):
  // Frequency f_220 ~ (c^3 / (2*pi*G*M)) * [1.5251 - 1.1568 * (1 - a)^0.1292]
  // In Hz: f_220 ~ (32.26 kHz / M_solar) * [1.5251 - 1.1568 * (1 - chi)^0.1292]
  const factorOmega = 1.5251 - 1.1568 * Math.pow(Math.max(0.01, 1 - dimensionlessSpin), 0.1292);
  const freq220Hz = Math.round((32260 / remnantMass) * factorOmega);

  // Damping time tau_220 ~ (2 * G * M / c^3) * [0.7 - 1.4187 * (1 - a)^-0.4990]^-1
  // In ms: tau_220 ~ 0.055 * M_solar * (1 - chi)^(-0.45)
  const tau220Ms = parseFloat(
    (0.055 * remnantMass * Math.pow(Math.max(0.01, 1 - dimensionlessSpin), -0.45)).toFixed(2)
  );

  // Quality factor Q = pi * f * tau
  const qualityFactor = parseFloat((Math.PI * freq220Hz * (tau220Ms / 1000)).toFixed(1));

  // First Overtone (l=2, m=2, n=1): higher frequency and ~3x faster damping
  const freq221Hz = Math.round(freq220Hz * 0.96);
  const tau221Ms = parseFloat((tau220Ms / 3.1).toFixed(2));

  // Render Live Ringdown Oscilloscope
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    const padLeft = 50;
    const padRight = 20;
    const padTop = 30;
    const padBottom = 35;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const midY = padTop + plotH / 2;

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    [-1, 0, 1].forEach((level) => {
      const y = midY - level * (plotH * 0.42);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(level === 0 ? '0' : level > 0 ? '+h_max' : '-h_max', padLeft - 8, y + 3);
    });

    // Time window: 0 to 45 ms
    const maxTimeMs = 45;

    // Draw Exponential Damping Envelope (dashed amber)
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= plotW; x++) {
      const t = (x / plotW) * maxTimeMs;
      const env = Math.exp(-t / tau220Ms);
      const yUpper = midY - env * (plotH * 0.4);
      if (x === 0) ctx.moveTo(padLeft + x, yUpper);
      else ctx.lineTo(padLeft + x, yUpper);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let x = 0; x <= plotW; x++) {
      const t = (x / plotW) * maxTimeMs;
      const env = Math.exp(-t / tau220Ms);
      const yLower = midY + env * (plotH * 0.4);
      if (x === 0) ctx.moveTo(padLeft + x, yLower);
      else ctx.lineTo(padLeft + x, yLower);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Ringdown Strain Waveform h(t)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const omega0 = 2 * Math.PI * (freq220Hz / 1000);
    const omega1 = 2 * Math.PI * (freq221Hz / 1000);

    for (let x = 0; x <= plotW; x++) {
      const t = (x / plotW) * maxTimeMs; // in ms
      // Fundamental mode
      let h = 0.85 * Math.exp(-t / tau220Ms) * Math.cos(omega0 * t);
      // Optional overtone
      if (includeOvertone) {
        h += 0.55 * Math.exp(-t / tau221Ms) * Math.cos(omega1 * t + 0.8);
      }

      const y = midY - h * (plotH * 0.4);
      if (x === 0) ctx.moveTo(padLeft + x, y);
      else ctx.lineTo(padLeft + x, y);
    }
    ctx.stroke();

    // Event Horizon Inset Diagram
    const horizonR = 18 + dimensionlessSpin * 8;
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width - 55, padTop + 45, horizonR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#c084fc';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('克爾事件視界', width - 55, padTop + 85);
    ctx.fillText(`r_+ = ${(1 + Math.sqrt(Math.max(0, 1 - dimensionlessSpin * dimensionlessSpin))).toFixed(2)} M`, width - 55, padTop + 97);

    // X-axis label
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('合併後時間 t (毫秒 ms, 0 - 45 ms)', padLeft + plotW / 2, height - 8);
  }, [remnantMass, dimensionlessSpin, includeOvertone, freq220Hz, tau220Ms, freq221Hz, tau221Ms]);

  return (
    <div className="my-8 rounded-xl border border-slate-700 bg-slate-900/95 p-5 text-slate-100 shadow-2xl backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-wide text-purple-400">
            克爾黑洞無毛定理與重力波鈴宕譜學模擬器
          </h3>
          <p className="text-xs text-slate-400">
            GW150914 殘餘黑洞質量與自旋 → 準簡正模複數頻率 (ω, τ) → 無毛定理獨立驗證
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIncludeOvertone(!includeOvertone)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              includeOvertone
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {includeOvertone ? '包含 n=1 泛音 (高信噪比)' : '僅基模 n=0'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
        <canvas
          ref={canvasRef}
          width={480}
          height={280}
          className="h-68 w-full rounded border border-slate-800 bg-slate-950"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">鈴宕基模頻率 (f₂₂₀)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-cyan-400">
            {freq220Hz} <span className="text-xs font-normal text-slate-400">Hz</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            宇宙時空共振主頻
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">阻尼衰減時間 (τ₂₂₀)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-amber-400">
            {tau220Ms} <span className="text-xs font-normal text-slate-400">ms</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            視界能量吸積耗散
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">振盪品質因子 (Q)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-emerald-400">
            {qualityFactor}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Q = π · f₂₂₀ · τ₂₂₀
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">無毛定理檢驗依據</div>
          <div className="mt-1 text-lg font-bold text-purple-300">
            僅由 (M, a) 決定
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            無任何額外純量毛
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>殘餘黑洞質量 (M):</span>
            <span className="font-mono text-cyan-400 font-bold">{remnantMass} M☉ (太陽質量)</span>
          </div>
          <input
            type="range"
            min={30}
            max={120}
            step={5}
            value={remnantMass}
            onChange={(e) => setRemnantMass(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            質量越大，黑洞時空幾何尺度越大，共振頻率越低
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>無因次旋轉自旋參數 (a/M):</span>
            <span className="font-mono text-purple-400 font-bold">{dimensionlessSpin.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={0.92}
            step={0.02}
            value={dimensionlessSpin}
            onChange={(e) => setDimensionlessSpin(parseFloat(e.target.value))}
            className="mt-2 w-full accent-purple-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            克爾極限為 1.0；自旋越高，能層拖拽越強，阻尼時間 τ 顯著延長
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">無毛定理檢驗哲學：</span>
        根據愛因斯坦廣義相對論，一個孤立靜止的克爾黑洞完全由質量 $M$ 與自旋角動量 $J$ 唯二物理量完全表徵（無毛定理）。
        當兩個黑洞劇烈碰撞合併時，非對稱的時空凹凸以重力波的形式瘋狂向外輻射（鈴宕，Ringdown）。
        只要觀測到至少兩個獨立的準簡正模（基模 $\omega_{220}$ 與泛音 $\omega_{221}$），便能**同時反解出質量與自旋並檢驗彼此是否相容**，
        完成了人類在強重力場極限對愛因斯坦理論的終審拷問。
      </div>
    </div>
  );
};
