import React, { useState, useEffect, useRef } from 'react';

export const CoriolisAtmosphereSimulator: React.FC = () => {
  const [latitude, setLatitude] = useState<number>(45); // -90 to 90 degrees
  const [pressureDiff, setPressureDiff] = useState<number>(20); // hPa gradient
  const [friction, setFriction] = useState<number>(0.1); // surface friction 0 to 0.5
  const [systemType, setSystemType] = useState<'low' | 'high'>('low');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Physical constants
  const omega = 7.2921e-5; // Earth rotation angular velocity rad/s
  const phiRad = (latitude * Math.PI) / 180;
  const fCoriolis = 2 * omega * Math.sin(phiRad); // Coriolis parameter f
  const fDisplay = (fCoriolis * 1e4).toFixed(3); // scaled for readability

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    // Air parcel particles
    const particles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 150 + 30;
      particles.push({
        x: 240 + Math.cos(angle) * r,
        y: 150 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        life: Math.random() * 100,
      });
    }

    const render = () => {
      if (!isRunning) return;
      timeRef.current += 0.03;

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, 480, 300);

      const cx = 240;
      const cy = 150;

      // Draw Isobars (concentric rings)
      for (let r = 35; r <= 155; r += 30) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Isobar label
        ctx.fillStyle = '#64748b';
        ctx.font = '9px monospace';
        const pLabel = systemType === 'low' ? 1000 + Math.round((r / 150) * pressureDiff) : 1020 - Math.round((r / 150) * pressureDiff);
        ctx.fillText(`${pLabel} hPa`, cx + r - 16, cy - 4);
      }

      // Center pressure label
      ctx.fillStyle = systemType === 'low' ? '#38bdf8' : '#f59e0b';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(systemType === 'low' ? 'L (低壓)' : 'H (高壓)', cx, cy + 5);

      // Physics integration for particles
      const signF = Math.sign(latitude) || 1;
      const absF = Math.abs(latitude) / 45; // effective Coriolis strength

      particles.forEach((p) => {
        p.life += 1;
        if (p.life > 180) {
          const angle = Math.random() * Math.PI * 2;
          const r = systemType === 'low' ? 150 : 25 + Math.random() * 20;
          p.x = cx + Math.cos(angle) * r;
          p.y = cy + Math.sin(angle) * r;
          p.vx = 0;
          p.vy = 0;
          p.life = 0;
        }

        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Pressure Gradient Force (directed inwards for Low, outwards for High)
        const pDir = systemType === 'low' ? 1 : -1;
        const pMag = (pressureDiff / 20) * 0.45;
        const fxP = pDir * (dx / dist) * pMag;
        const fyP = pDir * (dy / dist) * pMag;

        // Coriolis Force: perpendicular to velocity: (-f * vy, f * vx)
        const fxC = -signF * absF * p.vy * 0.45;
        const fyC = signF * absF * p.vx * 0.45;

        // Friction damping
        const fxFric = -p.vx * friction;
        const fyFric = -p.vy * friction;

        p.vx += fxP + fxC + fxFric;
        p.vy += fyP + fyC + fyFric;

        // Cap speed
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 4.5) {
          p.vx = (p.vx / speed) * 4.5;
          p.vy = (p.vy / speed) * 4.5;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Draw particle tail
        ctx.strokeStyle = systemType === 'low' ? 'rgba(56, 189, 248, 0.6)' : 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Sample Parcel Vector Diagram at (cx + 80, cy)
      const sampleX = cx + 80;
      const sampleY = cy;
      const sampDx = cx - sampleX;
      const sampDy = cy - sampleY;
      const sDist = Math.sqrt(sampDx * sampDx + sampDy * sampDy);

      // PGF vector (green)
      const pgfDir = systemType === 'low' ? 1 : -1;
      const pgfLen = 35;
      const pgfX = sampleX + pgfDir * (sampDx / sDist) * pgfLen;
      const pgfY = sampleY + pgfDir * (sampDy / sDist) * pgfLen;

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sampleX, sampleY);
      ctx.lineTo(pgfX, pgfY);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.font = '10px sans-serif';
      ctx.fillText('氣壓梯度力 F_p', pgfX, pgfY - 5);

      // Geostrophic wind vector (cyan)
      // Parallel to isobars: clockwise in N-high / CCW in N-low
      const geoSign = (systemType === 'low' ? -1 : 1) * signF;
      const geoLen = 35 * Math.min(1, absF + 0.2);
      const geoX = sampleX;
      const geoY = sampleY + geoSign * geoLen;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sampleX, sampleY);
      ctx.lineTo(geoX, geoY);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.fillText('地轉風 V_g', geoX + 6, geoY);

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      isRunning = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [latitude, pressureDiff, friction, systemType]);

  return (
    <div className="my-8 rounded-xl border border-slate-700 bg-slate-900/95 p-5 text-slate-100 shadow-2xl backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-wide text-cyan-400">
            科氏力與大氣地轉平衡模擬器
          </h3>
          <p className="text-xs text-slate-400">
            旋轉參考系科氏加速度 -2Ω×v → 氣壓梯度力與科氏力平衡 → 地轉風沿等壓線流動
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSystemType('low')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              systemType === 'low'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            低氣壓 (氣旋)
          </button>
          <button
            type="button"
            onClick={() => setSystemType('high')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              systemType === 'high'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            高氣壓 (反氣旋)
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
        <canvas
          ref={canvasRef}
          width={480}
          height={300}
          className="h-72 w-full rounded border border-slate-800 bg-slate-950"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">所在緯度 (φ)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-cyan-400">
            {latitude}&deg; {latitude >= 0 ? 'N (北半球)' : 'S (南半球)'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">科氏參數 f = 2Ω sinφ</div>
          <div className="mt-1 text-2xl font-mono font-bold text-emerald-400">
            {fDisplay} <span className="text-xs font-normal text-slate-400">10⁻⁴ s⁻¹</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">旋轉風向趨勢</div>
          <div className="mt-1 text-xl font-bold text-amber-400">
            {latitude > 0
              ? systemType === 'low'
                ? '逆時針輻合 (旋向中心)'
                : '順時針輻散'
              : latitude < 0
              ? systemType === 'low'
                ? '順時針輻合'
                : '逆時針輻散'
              : '無偏折 (赤道直接灌入)'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">地轉平衡狀態</div>
          <div className="mt-1 text-2xl font-mono font-bold text-purple-400">
            {friction < 0.05 ? '理想地轉風' : friction < 0.25 ? '近地層傾斜流' : '摩擦主導跨等壓線'}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-3">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>地球緯度 (φ):</span>
            <span className="font-mono text-cyan-400 font-bold">{latitude}&deg;</span>
          </div>
          <input
            type="range"
            min={-90}
            max={90}
            step={5}
            value={latitude}
            onChange={(e) => setLatitude(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            赤道 φ=0&deg; 時 f=0，完全失去科氏偏折；極地效應最強
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>氣壓差強度 (ΔP):</span>
            <span className="font-mono text-emerald-400 font-bold">{pressureDiff} hPa</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={pressureDiff}
            onChange={(e) => setPressureDiff(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            決定氣壓梯度力大小，氣壓差越大風速越高
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>地面摩擦力係數:</span>
            <span className="font-mono text-amber-400 font-bold">{friction.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={0.4}
            step={0.05}
            value={friction}
            onChange={(e) => setFriction(parseFloat(e.target.value))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            高空自由大氣無摩擦呈純地轉風；近地面摩擦使風斜切等壓線
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">科學核心機制：</span>
        當空氣最初在氣壓差推動下啟動時，它筆直朝向低壓中心；但一旦獲得速度，地球自轉引發的科氏力立即向右（北半球）推動氣塊。
        最終，<strong className="text-cyan-300">氣壓梯度力與科氏力精確相互抵消</strong>，風不再流向低壓中心，而是
        <strong className="text-amber-300">完全沿著等壓線平行呼嘯吹拂</strong>。這正是大氣與海洋環流最本質的動力平衡。
      </div>
    </div>
  );
};
