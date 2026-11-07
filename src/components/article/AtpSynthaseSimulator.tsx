import React, { useState, useEffect, useRef } from 'react';

export const AtpSynthaseSimulator: React.FC = () => {
  const [deltaPh, setDeltaPh] = useState<number>(1.2); // pH gradient 0.2 to 2.5
  const [deltaPsi, setDeltaPsi] = useState<number>(140); // mV membrane potential 50 to 220 mV
  const [atpConcentration, setAtpConcentration] = useState<number>(2.5); // mM ATP product inhibition

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const angleRef = useRef<number>(0);
  const atpCountRef = useRef<number>(0);
  const [rpmDisplay, setRpmDisplay] = useState<number>(0);
  const [totalAtp, setTotalAtp] = useState<number>(0);

  // Proton Motive Force calculation: pmf = Delta_Psi - (2.303 * R * T / F) * Delta_pH
  // At 37 C (310 K), 2.303 * R * T / F ~ 61.5 mV
  const pmf = deltaPsi + 61.5 * deltaPh; // in mV

  // Rotation speed prop to PMF
  const targetRpm = Math.max(0, Math.round((pmf - 80) * 1.8 - atpConcentration * 15));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    let lastTime = performance.now();

    // Proton particles crossing membrane
    const protons: { x: number; y: number; progress: number; channel: number }[] = [];
    for (let i = 0; i < 20; i++) {
      protons.push({
        x: Math.random() * 400 + 40,
        y: Math.random() * 40 + 20,
        progress: Math.random(),
        channel: Math.floor(Math.random() * 8),
      });
    }

    const render = (now: number) => {
      if (!isRunning) return;
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Angular step in rad: rpm -> rad/s
      const radPerSec = (targetRpm * 2 * Math.PI) / 60;
      const prevAngle = angleRef.current;
      angleRef.current = (angleRef.current + radPerSec * dt) % (2 * Math.PI);

      // Check for 120-degree step completions (each 120 deg = 1 ATP synthesized)
      const prevStep = Math.floor((prevAngle / (2 * Math.PI)) * 3);
      const curStep = Math.floor((angleRef.current / (2 * Math.PI)) * 3);
      if (prevStep !== curStep && targetRpm > 0) {
        atpCountRef.current += 1;
        setTotalAtp(atpCountRef.current);
      }

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, 480, 320);

      const cx = 240;

      // 1. Draw Mitochondrial Membrane (bilayer strip)
      const memTop = 85;
      const memBottom = 155;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, memTop, 480, memBottom - memTop);

      // Lipid heads
      ctx.fillStyle = '#475569';
      for (let x = 10; x < 480; x += 15) {
        ctx.beginPath();
        ctx.arc(x, memTop, 3, 0, Math.PI * 2);
        ctx.arc(x, memBottom, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Region Labels
      ctx.font = '10px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('膜間隙 (高質子濃度, 低 pH)', 15, memTop - 12);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('粒線體基質 (高 pH, ATP 合成端)', 15, memBottom + 20);

      // 2. Draw F0 c-ring rotor in membrane
      const cRingRadius = 40;
      const cRingCy = (memTop + memBottom) / 2;
      ctx.save();
      ctx.translate(cx, cRingCy);
      ctx.rotate(angleRef.current);

      // Rotor body
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(0, 0, cRingRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // c-subunits (8 c-ring proton binding sites)
      for (let s = 0; s < 8; s++) {
        const theta = (s * 2 * Math.PI) / 8;
        const sx = Math.cos(theta) * (cRingRadius - 7);
        const sy = Math.sin(theta) * (cRingRadius - 7);
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0369a1';
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('H⁺', sx, sy + 2.5);
      }
      ctx.restore();

      // 3. Central stalk (gamma subunit)
      ctx.save();
      ctx.translate(cx, cRingCy);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 70);
      ctx.stroke();
      ctx.restore();

      // 4. F1 Catalytic Head (3 alpha-beta dimers)
      const f1Cy = cRingCy + 85;
      const f1Radius = 45;
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath();
      ctx.arc(cx, f1Cy, f1Radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 3 Catalytic conformational states (Open, Loose, Tight)
      const states = ['Open (O)', 'Loose (L)', 'Tight (T)'];
      for (let i = 0; i < 3; i++) {
        const segAngle = angleRef.current + (i * 2 * Math.PI) / 3;
        const hx = cx + Math.cos(segAngle) * 26;
        const hy = f1Cy + Math.sin(segAngle) * 26;
        ctx.fillStyle = '#f1f5f9';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(states[i], hx, hy + 3);
      }

      // 5. Flowing Protons
      protons.forEach((p) => {
        p.y += 1.5;
        if (p.y > memBottom + 25) {
          p.y = memTop - 25;
          p.x = cx - 55 + Math.random() * 30;
        }

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Product animation text near F1
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('ADP + Pi → ATP', cx + 65, f1Cy);

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      isRunning = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [deltaPh, deltaPsi, atpConcentration, targetRpm]);

  // Update RPM display periodically
  useEffect(() => {
    const timer = setInterval(() => {
      setRpmDisplay(targetRpm);
    }, 200);
    return () => clearInterval(timer);
  }, [targetRpm]);

  return (
    <div className="my-8 rounded-xl border border-slate-700 bg-slate-900/95 p-5 text-slate-100 shadow-2xl backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-wide text-emerald-400">
            ATP 合成酶化學滲透與旋轉催化模擬器
          </h3>
          <p className="text-xs text-slate-400">
            質子動勢能 Δp = ΔΨ - 60ΔpH → F₀ 質子渦輪旋轉 → F₁ 催化頭構象交替合成 ATP
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-300">
            旋轉轉速: <strong className="text-emerald-300 font-bold">{rpmDisplay}</strong> RPM
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
        <canvas
          ref={canvasRef}
          width={480}
          height={320}
          className="h-72 w-full rounded border border-slate-800 bg-slate-950"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">質子動力勢 (PMF Δp)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-cyan-400">
            {pmf.toFixed(0)} <span className="text-xs font-normal text-slate-400">mV</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            跨膜電位 + 化學梯度
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">每秒 ATP 合成產量</div>
          <div className="mt-1 text-2xl font-mono font-bold text-emerald-400">
            {Math.round((rpmDisplay * 3) / 60)} <span className="text-xs font-normal text-slate-400">分子/秒</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            每轉一圈合成 3 個 ATP
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">能量轉換熱力學效率</div>
          <div className="mt-1 text-2xl font-mono font-bold text-amber-400">
            ~85%
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            遠超人造熱機極限
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">已累積合成 ATP 總量</div>
          <div className="mt-1 text-2xl font-mono font-bold text-purple-400">
            {totalAtp} <span className="text-xs font-normal text-slate-400">分子</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-3">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>跨膜電位差 (ΔΨ):</span>
            <span className="font-mono text-cyan-400 font-bold">{deltaPsi} mV</span>
          </div>
          <input
            type="range"
            min={60}
            max={200}
            step={10}
            value={deltaPsi}
            onChange={(e) => setDeltaPsi(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            呼吸鏈泵出的正電荷在膜外堆積形成的主導電勢差
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>pH 濃度差 (ΔpH):</span>
            <span className="font-mono text-emerald-400 font-bold">{deltaPh.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={2.0}
            step={0.1}
            value={deltaPh}
            onChange={(e) => setDeltaPh(parseFloat(e.target.value))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            化學濃度梯度貢獻 ~60 mV/pH 單位
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>產物 ATP 抑制濃度:</span>
            <span className="font-mono text-amber-400 font-bold">{atpConcentration.toFixed(1)} mM</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={6.0}
            step={0.5}
            value={atpConcentration}
            onChange={(e) => setAtpConcentration(parseFloat(e.target.value))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            逆反應熱力學背壓，ATP 飽和時降低合成淨速率
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">旋轉催化核心機制：</span>
        質子在 F₀ 的 a 亞基與 c 環介面順著電化學勢進入半通道，質子化中和天冬胺酸（Asp61）帶負電羧基，使 c 環在疏水雙分子層中自發旋轉 $360^\circ$ 後從基質側釋出。
        c 環旋轉牽動非對稱的 γ 軸在 F₁ 內部如同凸輪般偏心轉動，依次強迫三個催化位點經歷
        <strong className="text-emerald-300">開放態（釋放 ATP）→ 鬆弛態（結合 ADP+Pi）→ 緊密態（縮合脫水合成 ATP）</strong>，
        完成大自然最極致的奈米機械能至化學能轉換。
      </div>
    </div>
  );
};
