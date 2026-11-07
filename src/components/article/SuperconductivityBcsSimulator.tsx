import React, { useState, useEffect, useRef } from 'react';

export const SuperconductivityBcsSimulator: React.FC = () => {
  const [tempRatio, setTempRatio] = useState<number>(0.35); // T / Tc (0.05 to 1.25)
  const [couplingStrength, setCouplingStrength] = useState<number>(0.3); // N(0)V weak coupling (0.15 to 0.45)
  const [externalFieldB, setExternalFieldB] = useState<number>(30); // mT external magnetic field

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // BCS Physical Calculations
  const isSuperconducting = tempRatio < 1.0;

  // BCS Energy Gap Delta(T) in units of meV (assuming Nb Tc = 9.25 K, Delta(0) ~ 1.45 meV)
  // Delta(0) = 1.764 * k_B * Tc
  // Near Tc: Delta(T) ~ 1.74 * Delta(0) * sqrt(1 - T/Tc)
  const delta0 = 1.45 * (couplingStrength / 0.3);
  const deltaT = isSuperconducting
    ? parseFloat((delta0 * Math.sqrt(Math.max(0, 1 - Math.pow(tempRatio, 3.2)))).toFixed(2))
    : 0.0;

  // London Penetration Depth lambda_L(T) = lambda_0 / sqrt(1 - (T/Tc)^4)
  // For Nb, lambda_0 ~ 39 nm
  const lambdaLNm = isSuperconducting
    ? Math.round(39 / Math.sqrt(Math.max(0.01, 1 - Math.pow(tempRatio, 4))))
    : 9999; // infinite penetration (normal state)

  // Critical Field Bc(T) = Bc(0) * (1 - (T/Tc)^2)
  const bc0 = 200; // mT
  const bcT = Math.round(bc0 * Math.max(0, 1 - tempRatio * tempRatio));

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

    // Left View: Fermi Sphere & Cooper Pair Energy Gap (width 220px)
    const leftCx = 110;
    const leftCy = 135;
    const fermiRadius = 65;

    // Fermi sea background
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(leftCx, leftCy, fermiRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Superconducting Energy Gap Shell around Fermi surface
    if (isSuperconducting) {
      const gapPixel = (deltaT / 1.5) * 16;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = Math.max(2, gapPixel);
      ctx.beginPath();
      ctx.arc(leftCx, leftCy, fermiRadius + gapPixel / 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`超導能隙 Δ(T) = ${deltaT} meV`, leftCx, leftCy - fermiRadius - 12);
    } else {
      ctx.fillStyle = '#f59e0b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('正常金屬態 (能隙 Δ=0)', leftCx, leftCy - fermiRadius - 12);
    }

    // Draw Cooper pair (k_up, -k_down)
    if (isSuperconducting) {
      const angle = 0.8;
      const x1 = leftCx + Math.cos(angle) * fermiRadius;
      const y1 = leftCy + Math.sin(angle) * fermiRadius;
      const x2 = leftCx - Math.cos(angle) * fermiRadius;
      const y2 = leftCy - Math.sin(angle) * fermiRadius;

      // Connecting phonon virtual attraction line
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Electrons
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(x1, y1, 5, 0, Math.PI * 2);
      ctx.arc(x2, y2, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '8px monospace';
      ctx.fillText('k↑', x1, y1 - 7);
      ctx.fillText('-k↓', x2, y2 + 13);
    }

    // Right View: Meissner Effect Magnetic Field Expulsion
    const slabX = 260;
    const slabW = 190;
    const slabY = 50;
    const slabH = 170;

    // Superconductor slab
    ctx.fillStyle = isSuperconducting ? '#1e293b' : '#334155';
    ctx.fillRect(slabX, slabY, slabW, slabH);
    ctx.strokeStyle = isSuperconducting ? '#10b981' : '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(slabX, slabY, slabW, slabH);

    ctx.fillStyle = isSuperconducting ? '#34d399' : '#94a3b8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isSuperconducting ? '邁斯納態 (完全抗磁 B=0)' : '正常態 (磁場自由穿透)', slabX + slabW / 2, slabY + 25);

    // Magnetic field lines
    const numLines = 7;
    for (let i = 0; i < numLines; i++) {
      const lineY = slabY + 35 + (i * (slabH - 50)) / (numLines - 1);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      if (isSuperconducting) {
        // Field line expels and curves around slab
        ctx.moveTo(slabX - 35, lineY);
        const curveOffset = lineY < slabY + slabH / 2 ? -28 : 28;
        ctx.bezierCurveTo(slabX + 15, lineY + curveOffset, slabX + slabW - 15, lineY + curveOffset, slabX + slabW + 35, lineY);
      } else {
        // Field lines pierce directly through
        ctx.moveTo(slabX - 35, lineY);
        ctx.lineTo(slabX + slabW + 35, lineY);
      }
      ctx.stroke();
    }

    // London penetration label
    if (isSuperconducting) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px monospace';
      ctx.fillText(`倫敦穿透深度 λ_L = ${lambdaLNm} nm`, slabX + slabW / 2, slabY + slabH - 12);
    }
  }, [tempRatio, couplingStrength, externalFieldB, deltaT, isSuperconducting, lambdaLNm]);

  return (
    <div className="my-8 rounded-xl border border-slate-700 bg-slate-900/95 p-5 text-slate-100 shadow-2xl backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-wide text-cyan-400">
            BCS 超導能隙與邁斯納完美抗磁模擬器
          </h3>
          <p className="text-xs text-slate-400">
            電子-聲子微弱吸引力 → 庫柏對 (k↑, -k↓) 形成 → 費米面能隙 Δ(T) 開啟與磁通排斥
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-300">
            物相狀態:{' '}
            <strong className={isSuperconducting ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {isSuperconducting ? '低溫超導態 (T < Tc)' : '正常金屬電阻態 (T ≥ Tc)'}
            </strong>
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
        <canvas
          ref={canvasRef}
          width={480}
          height={260}
          className="h-64 w-full rounded border border-slate-800 bg-slate-950"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">超導能隙 Δ(T)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-emerald-400">
            {deltaT} <span className="text-xs font-normal text-slate-400">meV</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            破壞庫柏對所需能量
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">倫敦穿透深度 (λ_L)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-cyan-400">
            {isSuperconducting ? `${lambdaLNm} nm` : '∞ (完全穿透)'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            表面屏蔽電流衰減厚度
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">臨界磁場 (B_c)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-amber-400">
            {bcT} <span className="text-xs font-normal text-slate-400">mT</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            外場超過此值破壞超導
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">BCS 普適常數比值</div>
          <div className="mt-1 text-2xl font-mono font-bold text-purple-400">
            1.764
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            2Δ(0) / (k_B · T_c)
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-3">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>溫度比例 (T / T_c):</span>
            <span className="font-mono text-cyan-400 font-bold">{tempRatio.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1.25}
            step={0.05}
            value={tempRatio}
            onChange={(e) => setTempRatio(parseFloat(e.target.value))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            當 T 跨過 1.0 Tc 時，熱起伏撕裂庫柏對，能隙瞬間閉合
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>電子-聲子耦合強度 N(0)V:</span>
            <span className="font-mono text-emerald-400 font-bold">{couplingStrength.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.15}
            max={0.45}
            step={0.05}
            value={couplingStrength}
            onChange={(e) => setCouplingStrength(parseFloat(e.target.value))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            弱耦合 BCS 適用於 N(0)V &lt; 0.5 的傳統低溫金屬超導體
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>外加磁場強度 (B):</span>
            <span className="font-mono text-amber-400 font-bold">{externalFieldB} mT</span>
          </div>
          <input
            type="range"
            min={10}
            max={150}
            step={10}
            value={externalFieldB}
            onChange={(e) => setExternalFieldB(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            在超導臨界磁場 Bc 內展示邁斯納效應
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">BCS 微觀機制本質：</span>
        帶負電的電子在晶格中穿行時，會吸引帶正電的晶格離子產生微小位移（聲子畸變），在身後留下局部的正電荷高密度軌跡。
        另一個動量與自旋相反的電子（-k↓）受到該正電荷軌跡吸引，克服了庫侖排斥力，結成束縛態「庫柏對」。
        作為整體自旋為 0 的複合玻色子，成千上萬的庫柏對集體凝聚到單一宏觀基態，
        <strong className="text-cyan-300">產生剛性宏觀量子波函數</strong>，微觀雜質散射完全無法單獨改變基態波函數，實現了零電阻與邁斯納完美抗磁。
      </div>
    </div>
  );
};
