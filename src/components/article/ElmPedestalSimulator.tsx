import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * ElmPedestalSimulator
 * 簡化的「台基（pedestal）循環」模型：
 *   dα/dt = P / τ_E − D_rmp · α          （加熱推高邊緣壓力梯度，RMP 擴散削減梯度）
 *   dj/dt = (C_bs(ν*) · α − j) / τ_j     （自舉電流隨壓力梯度弛豫增長，碰撞率越高越弱）
 * 當 (α, j) 越過剝離-氣球（peeling-ballooning）穩定邊界時觸發 ELM：
 *   α → α (1 − f)，j → j (1 − 0.8 f)，f 隨碰撞率降低而增大。
 * 所有量皆為歸一化無量綱單位，用於呈現定性行為，非定量預測。
 */

interface SimState {
  t: number;
  alpha: number;
  j: number;
}

interface ElmEvent {
  t: number;
  loss: number;
}

const DT = 0.002; // 歸一化時間步長
const STEPS_PER_FRAME = 10;
const HISTORY_SPAN = 6; // 時間軸顯示範圍（歸一化時間）
const TAU_J = 0.35;

// 剝離-氣球穩定邊界（歸一化）
const ballooningLimit = (j: number): number => 2.0 + 0.55 * j;
const peelingLimit = (alpha: number): number => 2.3 - 0.25 * alpha;

const isUnstable = (alpha: number, j: number): boolean =>
  alpha > ballooningLimit(j) || j > peelingLimit(alpha);

export const ElmPedestalSimulator: React.FC = () => {
  const [power, setPower] = useState<number>(1.0); // 歸一化加熱功率
  const [collisionality, setCollisionality] = useState<number>(0.3); // ν*
  const [rmp, setRmp] = useState<number>(0.0); // RMP 擴散強度
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [elmCount, setElmCount] = useState<number>(0);
  const [readout, setReadout] = useState({ alpha: 0, j: 0, freq: 0, meanLoss: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SimState>({ t: 0, alpha: 0.4, j: 0.2 });
  const historyRef = useRef<SimState[]>([]);
  const elmsRef = useRef<ElmEvent[]>([]);

  const reset = useCallback(() => {
    stateRef.current = { t: 0, alpha: 0.4, j: 0.2 };
    historyRef.current = [];
    elmsRef.current = [];
    setElmCount(0);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, W, H);

    const hist = historyRef.current;
    const now = stateRef.current.t;

    // 左：時間序列
    const lx = 50;
    const lw = W * 0.58 - lx;
    const ty = 20;
    const th = H - 55;
    const aMax = 3.5;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let k = 0; k <= 7; k++) {
      const y = ty + th * (1 - (k * 0.5) / aMax);
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(lx + lw, y);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText((k * 0.5).toFixed(1), lx - 6, y + 3);
    }
    const tStart = now - HISTORY_SPAN;
    const xOf = (t: number) => lx + ((t - tStart) / HISTORY_SPAN) * lw;
    const yOf = (v: number) => ty + th * (1 - Math.min(v, aMax) / aMax);

    // ELM 標記
    ctx.strokeStyle = 'rgba(244,63,94,0.35)';
    elmsRef.current.forEach((e) => {
      if (e.t < tStart) return;
      const x = xOf(e.t);
      ctx.beginPath();
      ctx.moveTo(x, ty);
      ctx.lineTo(x, ty + th);
      ctx.stroke();
    });

    const plotSeries = (sel: (s: SimState) => number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      let started = false;
      hist.forEach((s) => {
        if (s.t < tStart) return;
        const x = xOf(s.t);
        const y = yOf(sel(s));
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    plotSeries((s) => s.alpha, '#f59e0b');
    plotSeries((s) => s.j, '#38bdf8');

    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('邊緣壓力梯度 α', lx + 6, ty + 12);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('邊緣電流密度 j', lx + 120, ty + 12);
    ctx.fillStyle = '#f43f5e';
    ctx.fillText('紅線 = ELM 崩塌', lx + 230, ty + 12);
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText('時間（歸一化）', lx + lw / 2, H - 12);

    // 右：j-α 穩定圖
    const rx = W * 0.58 + 45;
    const rw = W - rx - 20;
    const jMax = 3.0;
    const pxA = (a: number) => rx + (a / aMax) * rw;
    const pyJ = (j: number) => ty + th * (1 - j / jMax);

    // 不穩定區著色
    const cells = 60;
    for (let ia = 0; ia < cells; ia++) {
      for (let ij = 0; ij < cells; ij++) {
        const a = ((ia + 0.5) / cells) * aMax;
        const jj = ((ij + 0.5) / cells) * jMax;
        if (isUnstable(a, jj)) {
          ctx.fillStyle = 'rgba(244,63,94,0.16)';
          ctx.fillRect(pxA(a) - rw / cells / 2, pyJ(jj) - th / cells / 2, rw / cells + 0.5, th / cells + 0.5);
        }
      }
    }
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(rx, ty, rw, th);

    // 邊界線
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k <= 50; k++) {
      const jj = (k / 50) * jMax;
      const a = ballooningLimit(jj);
      if (k === 0) ctx.moveTo(pxA(Math.min(a, aMax)), pyJ(jj));
      else ctx.lineTo(pxA(Math.min(a, aMax)), pyJ(jj));
    }
    ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k <= 50; k++) {
      const a = (k / 50) * aMax;
      const jj = peelingLimit(a);
      if (k === 0) ctx.moveTo(pxA(a), pyJ(jj));
      else ctx.lineTo(pxA(a), pyJ(jj));
    }
    ctx.stroke();

    // 軌跡
    ctx.strokeStyle = 'rgba(16,185,129,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let first = true;
    hist.forEach((s) => {
      if (s.t < now - 2) return;
      if (first) {
        ctx.moveTo(pxA(s.alpha), pyJ(s.j));
        first = false;
      } else ctx.lineTo(pxA(s.alpha), pyJ(s.j));
    });
    ctx.stroke();
    const cur = stateRef.current;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(pxA(Math.min(cur.alpha, aMax)), pyJ(Math.min(cur.j, jMax)), 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('氣球模邊界', rx + rw - 4, ty + th - 8);
    ctx.textAlign = 'left';
    ctx.fillText('剝離模邊界', rx + 4, pyJ(peelingLimit(0)) - 6);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.fillText('壓力梯度 α', rx + rw / 2, H - 12);
    ctx.save();
    ctx.translate(rx - 28, ty + th / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('邊緣電流 j', 0, 0);
    ctx.restore();
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (isRunning) {
        const cbs = 1.1 / (1 + 1.5 * collisionality); // 自舉電流係數
        const f = 0.08 + 0.3 / (1 + 2 * collisionality); // 每次 ELM 損失比例
        for (let n = 0; n < STEPS_PER_FRAME; n++) {
          const s = stateRef.current;
          const dAlpha = power - rmp * s.alpha;
          const dJ = (cbs * s.alpha - s.j) / TAU_J;
          let alpha = s.alpha + dAlpha * DT;
          let j = s.j + dJ * DT;
          const t = s.t + DT;
          if (isUnstable(alpha, j)) {
            const w0 = alpha;
            alpha *= 1 - f;
            j *= 1 - 0.8 * f;
            elmsRef.current.push({ t, loss: (w0 - alpha) / w0 });
            if (elmsRef.current.length > 400) elmsRef.current.shift();
            setElmCount((c) => c + 1);
          }
          stateRef.current = { t, alpha, j };
          historyRef.current.push(stateRef.current);
        }
        const cutoff = stateRef.current.t - HISTORY_SPAN - 0.1;
        while (historyRef.current.length && historyRef.current[0].t < cutoff) historyRef.current.shift();

        const recent = elmsRef.current.filter((e) => e.t > stateRef.current.t - 3);
        const freq = recent.length / Math.min(3, stateRef.current.t || 1);
        const meanLoss = recent.length ? recent.reduce((acc, e) => acc + e.loss, 0) / recent.length : 0;
        setReadout({ alpha: stateRef.current.alpha, j: stateRef.current.j, freq, meanLoss });
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isRunning, power, collisionality, rmp, draw]);

  const regime =
    readout.freq < 0.05
      ? 'ELM 受抑制（台基停在穩定邊界內）'
      : readout.meanLoss > 0.25
        ? '大型低頻 ELM（類 Type-I）'
        : '小型高頻 ELM（緩解狀態）';

  return (
    <div className="my-8 rounded-xl border border-slate-700 bg-slate-900/95 p-5 text-slate-100 shadow-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-wide text-amber-400">台基循環與剝離-氣球模穩定性模擬器</h3>
          <p className="text-xs text-slate-400">加熱推高邊緣梯度 → 自舉電流增長 → 越過穩定邊界 → ELM 崩塌 → 重新累積</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-300">
            ELM 次數: <strong className="text-rose-300">{elmCount}</strong>
          </span>
          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
          >
            {isRunning ? '暫停' : '繼續'}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-rose-950/60 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-900/80"
          >
            重置
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
        <canvas ref={canvasRef} width={860} height={320} className="h-72 w-full rounded bg-slate-950" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">當前 α / j</div>
          <div className="mt-1 font-mono text-lg font-bold text-amber-400">
            {readout.alpha.toFixed(2)} / {readout.j.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">ELM 頻率（每單位時間）</div>
          <div className="mt-1 font-mono text-lg font-bold text-rose-400">{readout.freq.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">單次 ELM 梯度損失</div>
          <div className="mt-1 font-mono text-lg font-bold text-cyan-400">{(readout.meanLoss * 100).toFixed(0)}%</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-[11px] text-slate-400">狀態判讀</div>
          <div className="mt-1 text-xs font-semibold text-emerald-300">{regime}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-3">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>加熱功率 P（歸一化）</span>
            <span className="font-mono font-bold text-amber-400">{power.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.3}
            max={3}
            step={0.05}
            value={power}
            onChange={(e) => setPower(parseFloat(e.target.value))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">功率越高，梯度回升越快，ELM 越頻繁</div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>台基碰撞率 ν*</span>
            <span className="font-mono font-bold text-cyan-400">{collisionality.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={3}
            step={0.05}
            value={collisionality}
            onChange={(e) => setCollisionality(parseFloat(e.target.value))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">低碰撞率下自舉電流強，單次崩塌更深</div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>共振磁擾動 RMP 強度</span>
            <span className="font-mono font-bold text-emerald-400">{rmp.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={rmp}
            onChange={(e) => setRmp(parseFloat(e.target.value))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 text-[11px] text-slate-400">額外邊緣輸運使梯度在邊界前達到平衡</div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">模型說明：</span>
        梯度方程 dα/dt = P − D·α 的穩態值為 P/D。當 RMP 讓 P/D 落在氣球模邊界之內，台基就不再撞上邊界，ELM 消失。
        本模擬採歸一化單位與示意性邊界，只用來呈現台基循環的定性行為，不對應任何特定裝置的數值。
      </div>
    </div>
  );
};
