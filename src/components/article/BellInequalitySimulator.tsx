import React, { useState, useEffect, useRef } from 'react';

export const BellInequalitySimulator: React.FC = () => {
  const [aliceAngle1, setAliceAngle1] = useState<number>(0); // a
  const [aliceAngle2, setAliceAngle2] = useState<number>(45); // a'
  const [bobAngle1, setBobAngle1] = useState<number>(22.5); // b
  const [bobAngle2, setBobAngle2] = useState<number>(67.5); // b'

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Quantum correlation function E(theta_A, theta_B) = -cos(2 * (theta_A - theta_B) * pi / 180)
  const calcCorr = (aDeg: number, bDeg: number) => {
    const diffRad = ((aDeg - bDeg) * Math.PI) / 180;
    return -Math.cos(2 * diffRad);
  };

  const E_ab = calcCorr(aliceAngle1, bobAngle1);
  const E_abPrime = calcCorr(aliceAngle1, bobAngle2);
  const E_aPrimeB = calcCorr(aliceAngle2, bobAngle1);
  const E_aPrimeBPrime = calcCorr(aliceAngle2, bobAngle2);

  // CHSH Parameter S = |E(a,b) - E(a,b') + E(a',b) + E(a',b')|
  const S_quantum = Math.abs(E_ab - E_abPrime + E_aPrimeB + E_aPrimeBPrime);

  // Canvas drawing: Entanglement source, dual detectors & CHSH correlation curve
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

    // Left diagram: Experimental setup (Source -> Alice & Bob polarizers)
    const setupW = 200;
    const srcX = setupW / 2;
    const srcY = 70;

    // Entangled photon source
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(srcX, srcY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BBO 晶體', srcX, srcY + 3);

    // Alice path (left)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(srcX - 12, srcY);
    ctx.lineTo(25, srcY);
    ctx.stroke();

    // Alice detector
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(15, srcY - 22, 10, 44);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '9px monospace';
    ctx.fillText(`Alice`, 20, srcY + 32);
    ctx.fillText(`a=${aliceAngle1}°`, 20, srcY + 44);

    // Bob path (right)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(srcX + 12, srcY);
    ctx.lineTo(setupW - 25, srcY);
    ctx.stroke();

    // Bob detector
    ctx.fillStyle = '#d97706';
    ctx.fillRect(setupW - 25, srcY - 22, 10, 44);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`Bob`, setupW - 20, srcY + 32);
    ctx.fillText(`b=${bobAngle1}°`, setupW - 20, srcY + 44);

    // Right diagram: CHSH Parameter Bar & Classical Bell Limit
    const barX = 230;
    const barW = width - barX - 30;
    const barY = 50;
    const barH = 140;

    // Draw Classical Boundary Line (S = 2.0)
    const normClassic = 2.0 / 3.0;
    const yClassic = barY + barH * (1 - normClassic);

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(barX, yClassic);
    ctx.lineTo(barX + barW, yClassic);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ef4444';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('局域實在論古典上限 S ≤ 2.0', barX + 6, yClassic - 4);

    // Draw Quantum Tsirelson bound (S = 2.828)
    const normTsirelson = 2.828 / 3.0;
    const yTsirelson = barY + barH * (1 - normTsirelson);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(barX, yTsirelson);
    ctx.lineTo(barX + barW, yTsirelson);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#c084fc';
    ctx.fillText('齊雷爾森量子極限 S = 2√2 ≈ 2.828', barX + 6, yTsirelson - 4);

    // Current Measured S Bar
    const sClamped = Math.min(3.0, S_quantum);
    const normS = sClamped / 3.0;
    const sBarHeight = barH * normS;

    const isViolated = S_quantum > 2.0;
    ctx.fillStyle = isViolated ? '#10b981' : '#64748b';
    ctx.fillRect(barX + barW / 2 - 25, barY + barH - sBarHeight, 50, sBarHeight);

    ctx.fillStyle = isViolated ? '#34d399' : '#94a3b8';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`S = ${S_quantum.toFixed(3)}`, barX + barW / 2, barY + barH - sBarHeight - 10);

    // Bell Test status message
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = isViolated ? '#34d399' : '#94a3b8';
    ctx.fillText(
      isViolated ? '違背貝爾不等式！局域實在論被決定性否定' : '未違背不等式 (處於古典相容區間)',
      width / 2,
      height - 18
    );
  }, [aliceAngle1, aliceAngle2, bobAngle1, bobAngle2, S_quantum]);

  return (
    <div className="my-8 rounded-xl border border-slate-700 bg-slate-900/95 p-5 text-slate-100 shadow-2xl backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-wide text-cyan-400">
            貝爾不等式與 CHSH 量子糾纏檢驗模擬器
          </h3>
          <p className="text-xs text-slate-400">
            偏振糾纏光子對 → 雙通道檢偏角關聯度 E(a,b) → 實測 CHSH 參數 S 突破古典極限 2.0
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAliceAngle1(0);
              setAliceAngle2(45);
              setBobAngle1(22.5);
              setBobAngle2(67.5);
            }}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-cyan-600/30 hover:bg-cyan-500"
          >
            設為最佳違背角 (齊雷爾森角)
          </button>
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
          <div className="text-[11px] text-slate-400">CHSH 參數 S</div>
          <div className="mt-1 text-2xl font-mono font-bold text-emerald-400">
            {S_quantum.toFixed(3)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            古典上限為 2.000
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">違背顯著度 (S - 2)</div>
          <div className="mt-1 text-2xl font-mono font-bold text-cyan-400">
            {S_quantum > 2 ? `+${(S_quantum - 2).toFixed(3)}` : '0.000 (無違背)'}
          </div>
          <div className="mt-1 text-[11px] text-emerald-500">
            {S_quantum > 2 ? '非局域量子關聯' : '古典相關'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">關聯度 E(a, b)</div>
          <div className="mt-1 text-xl font-mono font-bold text-amber-400">
            {E_ab.toFixed(3)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            -cos(2(a-b))
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">判決結論</div>
          <div className="mt-1 text-lg font-bold text-purple-300">
            {S_quantum > 2.0 ? '排除隱變數' : '相容區域'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            大自然拒絕局域實在論
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-4">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Alice 角度 a:</span>
            <span className="font-mono text-cyan-400 font-bold">{aliceAngle1}&deg;</span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={2.5}
            value={aliceAngle1}
            onChange={(e) => setAliceAngle1(parseFloat(e.target.value))}
            className="mt-2 w-full accent-cyan-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Alice 角度 a':</span>
            <span className="font-mono text-cyan-400 font-bold">{aliceAngle2}&deg;</span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={2.5}
            value={aliceAngle2}
            onChange={(e) => setAliceAngle2(parseFloat(e.target.value))}
            className="mt-2 w-full accent-cyan-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Bob 角度 b:</span>
            <span className="font-mono text-amber-400 font-bold">{bobAngle1}&deg;</span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={2.5}
            value={bobAngle1}
            onChange={(e) => setBobAngle1(parseFloat(e.target.value))}
            className="mt-2 w-full accent-amber-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Bob 角度 b':</span>
            <span className="font-mono text-amber-400 font-bold">{bobAngle2}&deg;</span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={2.5}
            value={bobAngle2}
            onChange={(e) => setBobAngle2(parseFloat(e.target.value))}
            className="mt-2 w-full accent-amber-500"
          />
        </div>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">貝爾定理之歷史意義：</span>
        如果微觀世界遵循愛因斯坦的「局域實在論」（即粒子在測量前已擁有客觀預設物理值，且沒有任何超光速幽靈作用），
        則四組測量關聯值組合而成的 CHSH 參數絕對不可突破 <strong className="text-rose-400 font-mono">S ≤ 2</strong>。
        然而，量子力學的糾纏態預言最高可達 <strong className="text-emerald-300 font-mono">S = 2√2 ≈ 2.828</strong>。
        1982 年阿斯佩（Alain Aspect）等人的精密光學實驗無可辯駁地證實了量子違背，榮獲 2022 年諾貝爾物理學獎，徹底埋葬了局域隱變數理論。
      </div>
    </div>
  );
};
