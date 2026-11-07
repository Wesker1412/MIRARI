import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Hawk-Dove replicator dynamics.
 * Payoffs: E(H,H) = (V - C) / 2, E(H,D) = V, E(D,H) = 0, E(D,D) = V / 2.
 * With p = fraction of Hawks:
 *   f_H - f_D = (V - pC) / 2
 *   dp/dt = p (1 - p) (V - pC) / 2
 * Interior ESS p* = V / C when C > V, otherwise pure Hawk (p* = 1).
 * Integrated with classical 4th-order Runge-Kutta.
 */

const INITIAL_PS = [0.02, 0.15, 0.35, 0.55, 0.75, 0.9, 0.98];
const LINE_COLORS = ['#38bdf8', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#f43f5e', '#eab308'];
const T_MAX = 60;
const DT = 0.05;

const rhs = (p: number, V: number, C: number): number => 0.5 * p * (1 - p) * (V - p * C);

const integrate = (p0: number, V: number, C: number): number[] => {
  const out: number[] = [p0];
  let p = p0;
  const steps = Math.round(T_MAX / DT);
  for (let i = 0; i < steps; i++) {
    const k1 = rhs(p, V, C);
    const k2 = rhs(p + 0.5 * DT * k1, V, C);
    const k3 = rhs(p + 0.5 * DT * k2, V, C);
    const k4 = rhs(p + DT * k3, V, C);
    p = p + (DT / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    p = Math.min(1, Math.max(0, p));
    out.push(p);
  }
  return out;
};

export const HawkDoveReplicatorSimulator: React.FC = () => {
  const [V, setV] = useState<number>(2);
  const [C, setC] = useState<number>(6);
  const [progress, setProgress] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pStar = C > V ? V / C : 1;

  const trajectories = useMemo(() => INITIAL_PS.map((p0) => integrate(p0, V, C)), [V, C]);

  // Re-animate whenever parameters change
  useEffect(() => {
    setProgress(0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const f = Math.min(1, (now - start) / 1800);
      setProgress(f);
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [V, C]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const padL = 46;
    const padR = 70;
    const padT = 16;
    const padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Grid and axes
    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    for (let i = 0; i <= 4; i++) {
      const y = padT + plotH * (1 - i / 4);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillText((i / 4).toFixed(2), 8, y + 4);
    }
    for (let t = 0; t <= T_MAX; t += 10) {
      const x = padL + (t / T_MAX) * plotW;
      ctx.fillText(String(t), x - 6, H - 14);
    }
    ctx.fillText('時間（相對單位）', padL + plotW / 2 - 40, H - 2);

    // ESS line
    const yStar = padT + plotH * (1 - pStar);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(padL, yStar);
    ctx.lineTo(padL + plotW, yStar);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`p* = ${pStar.toFixed(3)}`, padL + plotW + 6, yStar + 4);

    // Trajectories
    const steps = trajectories[0].length;
    const shown = Math.max(2, Math.floor(steps * progress));
    trajectories.forEach((traj, idx) => {
      ctx.strokeStyle = LINE_COLORS[idx % LINE_COLORS.length];
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < shown; i++) {
        const x = padL + (i / (steps - 1)) * plotW;
        const y = padT + plotH * (1 - traj[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }, [trajectories, progress, pStar]);

  const avgFinal = trajectories.reduce((s, t) => s + t[t.length - 1], 0) / trajectories.length;
  const meanPayoffAtEss = C > V ? (V / 2) * (1 - V / C) : (V - C) / 2;

  return (
    <div className="w-full rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-200">
      <div className="mb-3">
        <h3 className="text-lg font-semibold">鷹鴿博弈的複製者動態</h3>
        <p className="text-sm text-slate-400">
          縱軸為族群中鷹派比例 p。七條曲線從不同初始比例出發，依 dp/dt = p(1-p)(V-pC)/2 演化。
        </p>
      </div>
      <canvas ref={canvasRef} width={720} height={320} className="w-full rounded-lg" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          資源價值 V = {V.toFixed(1)}
          <input type="range" min={0.5} max={10} step={0.1} value={V}
            onChange={(e) => setV(parseFloat(e.target.value))} className="w-full" />
        </label>
        <label className="text-sm">
          受傷代價 C = {C.toFixed(1)}
          <input type="range" min={0.5} max={20} step={0.1} value={C}
            onChange={(e) => setC(parseFloat(e.target.value))} className="w-full" />
        </label>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded bg-slate-800 p-2">理論穩定點 p* = {C > V ? 'V/C' : '1'} = {pStar.toFixed(3)}</div>
        <div className="rounded bg-slate-800 p-2">模擬終點平均 p = {avgFinal.toFixed(3)}</div>
        <div className="rounded bg-slate-800 p-2">穩定點族群平均收益 = {meanPayoffAtEss.toFixed(3)}</div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {C > V
          ? '受傷代價高於資源價值：鷹與鴿共存，任何初始比例都會被拉回 V/C。'
          : '資源價值不低於受傷代價：全員鷹派即為演化穩定策略，鴿派終將消失。'}
        {' '}若全員都當鴿派，平均收益可達 V/2，這個差距正是個體選擇與群體利益之間的張力。
      </p>
    </div>
  );
};

export default HawkDoveReplicatorSimulator;
