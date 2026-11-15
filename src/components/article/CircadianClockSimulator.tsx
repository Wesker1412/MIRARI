import React, { useState, useEffect, useRef, useMemo } from 'react';

type ClockMode = 'kaiabc' | 'goodwin';

interface TimePoint {
  t: number;
  a: number; // KaiABC: T-KaiC | Goodwin: mRNA X
  b: number; // KaiABC: ST-KaiC | Goodwin: Cytoplasmic Y
  c: number; // KaiABC: S-KaiC | Goodwin: Nuclear Repressor Z
  refA: number; // 未受光脈衝干擾之對照組主波形
}

const DT = 0.05;
const TOTAL_HOURS = 72;
const STEPS = Math.round(TOTAL_HOURS / DT);

function integrateTrajectory(
  mode: ClockMode,
  hillN: number,
  rateScale: number,
  pulseTime: number | null
): {
  points: TimePoint[];
  periodHours: number;
  amplitude: number;
  phaseShiftHours: number;
  isOscillating: boolean;
} {
  // 預熱 96 小時消除初始暫態
  const warmupSteps = Math.round(96 / DT);

  const deriv = (s0: number, s1: number, s2: number, pulseActive: boolean): [number, number, number] => {
    if (mode === 'kaiabc') {
      const T = Math.max(0, s0);
      const D = Math.max(0, s1); // ST
      const S = Math.max(0, s2);
      const U = Math.max(0, 1 - T - D - S);
      // 游離 KaiA 分率受 S-KaiC (經由 KaiB) 螯合抑制
      const A = 1 / (1 + Math.pow(S / 0.25, hillN));
      const pulseBoost = pulseActive ? 1.65 : 1.0;

      const kUT = rateScale * 0.84 * 0.45 * A * pulseBoost;
      const kTD = rateScale * 0.84 * 0.35 * A * pulseBoost;
      const kTU = rateScale * 0.84 * 0.15 * (1 - A);
      const kDT = rateScale * 0.84 * 0.05 * A;
      const kDS = rateScale * 0.84 * 0.35 * (1 - 0.8 * A);
      const kSD = rateScale * 0.84 * 0.05 * A;
      const kSU = rateScale * 0.84 * 0.12;

      const dT = kUT * U - kTU * T - kTD * T + kDT * D;
      const dD = kTD * T - kDT * D - kDS * D + kSD * S;
      const dS = kDS * D - kSD * S - kSU * S;
      return [dT, dD, dS];
    } else {
      // 古德溫三元延遲負回饋模型 (X: mRNA, Y: 胞質蛋白, Z: 核內抑制複合體)
      const x = Math.max(0, s0);
      const y = Math.max(0, s1);
      const z = Math.max(0, s2);
      const s = rateScale * 1.29;
      const pulseIn = pulseActive ? 0.55 : 0.0;
      const dx = s * (1 / (1 + Math.pow(z, hillN)) - 0.12 * x + pulseIn);
      const dy = s * (0.12 * x - 0.12 * y);
      const dz = s * (0.12 * y - 0.12 * z);
      return [dx, dy, dz];
    }
  };

  const rk4Step = (state: [number, number, number], pulseActive: boolean): [number, number, number] => {
    const [k10, k11, k12] = deriv(state[0], state[1], state[2], pulseActive);
    const [k20, k21, k22] = deriv(
      state[0] + 0.5 * DT * k10,
      state[1] + 0.5 * DT * k11,
      state[2] + 0.5 * DT * k12,
      pulseActive
    );
    const [k30, k31, k32] = deriv(
      state[0] + 0.5 * DT * k20,
      state[1] + 0.5 * DT * k21,
      state[2] + 0.5 * DT * k22,
      pulseActive
    );
    const [k40, k41, k42] = deriv(
      state[0] + DT * k30,
      state[1] + DT * k31,
      state[2] + DT * k32,
      pulseActive
    );
    return [
      state[0] + (DT / 6) * (k10 + 2 * k20 + 2 * k30 + k40),
      state[1] + (DT / 6) * (k11 + 2 * k21 + 2 * k31 + k41),
      state[2] + (DT / 6) * (k12 + 2 * k22 + 2 * k32 + k42),
    ];
  };

  let refState: [number, number, number] = mode === 'kaiabc' ? [0.35, 0.15, 0.15] : [0.3, 0.2, 0.8];
  for (let i = 0; i < warmupSteps; i++) {
    refState = rk4Step(refState, false);
  }
  let pertState: [number, number, number] = [...refState];

  const points: TimePoint[] = [];
  const refPeaks: number[] = [];
  const pertPeaks: number[] = [];

  let prevRefA = refState[0];
  let prevPrevRefA = refState[0];
  let prevPertA = pertState[0];
  let prevPrevPertA = pertState[0];

  let minA = Infinity;
  let maxA = -Infinity;

  for (let i = 0; i <= STEPS; i++) {
    const t = i * DT;
    const isPulseOn = pulseTime !== null && t >= pulseTime && t <= pulseTime + 2.5;

    if (i > 0) {
      refState = rk4Step(refState, false);
      pertState = rk4Step(pertState, isPulseOn);
    }

    if (i % 2 === 0) {
      points.push({
        t,
        a: pertState[0],
        b: pertState[1],
        c: pertState[2],
        refA: refState[0],
      });
    }

    if (t > 12) {
      if (refState[0] < minA) minA = refState[0];
      if (refState[0] > maxA) maxA = refState[0];
    }

    if (i >= 2) {
      if (prevRefA > prevPrevRefA && prevRefA > refState[0]) {
        refPeaks.push((i - 1) * DT);
      }
      if (prevPertA > prevPrevPertA && prevPertA > pertState[0]) {
        pertPeaks.push((i - 1) * DT);
      }
    }
    prevPrevRefA = prevRefA;
    prevRefA = refState[0];
    prevPrevPertA = prevPertA;
    prevPertA = pertState[0];
  }

  const amplitude = Math.max(0, maxA - minA);
  const isOscillating = amplitude > (mode === 'kaiabc' ? 0.015 : 0.08);
  const periodHours =
    isOscillating && refPeaks.length >= 2 ? refPeaks[refPeaks.length - 1] - refPeaks[refPeaks.length - 2] : 0;

  let phaseShiftHours = 0;
  if (pulseTime !== null && isOscillating && refPeaks.length >= 1 && pertPeaks.length >= 1) {
    const lastRef = refPeaks[refPeaks.length - 1];
    // 尋找與最後一個對照峰最接近的擾動峰
    let bestDiff = 0;
    let bestAbs = Infinity;
    for (const pp of pertPeaks) {
      const diff = lastRef - pp; // 正值代表峰值提早出現（相位超前）
      if (Math.abs(diff) < bestAbs && Math.abs(diff) < periodHours * 0.48) {
        bestAbs = Math.abs(diff);
        bestDiff = diff;
      }
    }
    phaseShiftHours = bestDiff;
  }

  return { points, periodHours, amplitude, phaseShiftHours, isOscillating };
}

export const CircadianClockSimulator: React.FC = () => {
  const [mode, setMode] = useState<ClockMode>('kaiabc');
  const [temperatureC, setTemperatureC] = useState<number>(25);
  const [isCompensated, setIsCompensated] = useState<boolean>(true);
  const [hillN, setHillN] = useState<number>(10.0);
  const [pulseTime, setPulseTime] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const q10Value = isCompensated ? 1.02 : 2.05;
  const rateScale = useMemo(() => {
    return Math.pow(q10Value, (temperatureC - 25) / 10);
  }, [q10Value, temperatureC]);

  const sim = useMemo(() => {
    return integrateTrajectory(mode, hillN, rateScale, pulseTime);
  }, [mode, hillN, rateScale, pulseTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, W, H);

    // ─── 左側：72 小時振盪波形圖 (x: 42..488) ───────────────────────
    const wx = 44;
    const wy = 40;
    const ww = 444;
    const wh = 270;

    ctx.fillStyle = '#0c1322';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(wx, wy, ww, wh);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(
      mode === 'kaiabc'
        ? 'KaiABC 離體蛋白磷酸化週期波形 (72 小時)'
        : 'TTFL 古德溫轉錄負回饋波形 (72 小時)',
      wx,
      24
    );

    // 時間格線 (每 12 小時一條)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    for (let h = 0; h <= TOTAL_HOURS; h += 12) {
      const gx = wx + (h / TOTAL_HOURS) * ww;
      ctx.beginPath();
      ctx.moveTo(gx, wy);
      ctx.lineTo(gx, wy + wh);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(`${h}h`, gx - 8, wy + wh + 16);
    }

    // 標記光脈衝區間
    if (pulseTime !== null) {
      const px1 = wx + (pulseTime / TOTAL_HOURS) * ww;
      const px2 = wx + ((pulseTime + 2.5) / TOTAL_HOURS) * ww;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
      ctx.fillRect(px1, wy, Math.max(4, px2 - px1), wh);
      ctx.fillStyle = '#fde047';
      ctx.font = '10px sans-serif';
      ctx.fillText('⚡ 光脈衝', px1 - 12, wy + 14);
    }

    // 決定垂直縮放上限
    let maxVal = mode === 'kaiabc' ? 0.58 : 1.0;
    if (mode === 'goodwin') {
      for (const p of sim.points) {
        maxVal = Math.max(maxVal, p.a, p.b, p.c, p.refA);
      }
      maxVal *= 1.12;
    }

    const xOf = (t: number) => wx + (t / TOTAL_HOURS) * ww;
    const yOf = (v: number) => wy + wh - 10 - (v / maxVal) * (wh - 22);

    // 若有光脈衝，繪製對照組虛線波形
    if (pulseTime !== null) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      sim.points.forEach((p, idx) => {
        const px = xOf(p.t);
        const py = yOf(p.refA);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const drawSeries = (getter: (p: TimePoint) => number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      sim.points.forEach((p, idx) => {
        const px = xOf(p.t);
        const py = yOf(getter(p));
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    };

    drawSeries((p) => p.a, '#38bdf8');
    drawSeries((p) => p.b, '#f59e0b');
    drawSeries((p) => p.c, '#34d399');

    // 左側圖例
    ctx.font = '10px sans-serif';
    if (mode === 'kaiabc') {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('— T-KaiC', wx + 6, wy + wh + 32);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('— ST-KaiC', wx + 76, wy + wh + 32);
      ctx.fillStyle = '#34d399';
      ctx.fillText('— S-KaiC (抑制 KaiA)', wx + 150, wy + wh + 32);
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('— mRNA (X)', wx + 6, wy + wh + 32);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('— 胞質蛋白 (Y)', wx + 86, wy + wh + 32);
      ctx.fillStyle = '#34d399';
      ctx.fillText('— 核內抑制複合體 (Z)', wx + 186, wy + wh + 32);
    }

    // ─── 右側：二維相平面極限環 (x: 516..776) ─────────────────────
    const px0 = 516;
    const py0 = 40;
    const pw = 260;
    const ph = 270;

    ctx.fillStyle = '#0c1322';
    ctx.fillRect(px0, py0, pw, ph);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(px0, py0, pw, ph);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('相平面吸引子軌道 (極限環 vs 穩態)', px0, 24);

    // 取相平面橫縱軸範圍
    let maxHoriz = mode === 'kaiabc' ? 0.55 : 1.0;
    let maxVert = mode === 'kaiabc' ? 0.45 : 1.0;
    if (mode === 'goodwin') {
      for (const p of sim.points) {
        maxHoriz = Math.max(maxHoriz, p.a * 1.15);
        maxVert = Math.max(maxVert, p.c * 1.15);
      }
    }

    const phaseX = (p: TimePoint) => px0 + 18 + (p.a / maxHoriz) * (pw - 36);
    const phaseY = (p: TimePoint) => py0 + ph - 18 - (p.c / maxVert) * (ph - 36);

    // 漸層軌道
    ctx.strokeStyle = sim.isOscillating ? '#a78bfa' : '#fb7185';
    ctx.lineWidth = 2;
    ctx.beginPath();
    sim.points.forEach((p, idx) => {
      const x = phaseX(p);
      const y = phaseY(p);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const endPt = sim.points[sim.points.length - 1];
    ctx.fillStyle = sim.isOscillating ? '#22d3ee' : '#fb7185';
    ctx.beginPath();
    ctx.arc(phaseX(endPt), phaseY(endPt), 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText(mode === 'kaiabc' ? '橫軸: T-KaiC 分率' : '橫軸: mRNA (X)', px0 + 10, py0 + ph + 16);
    ctx.fillText(mode === 'kaiabc' ? '縱軸: S-KaiC 分率' : '縱軸: 核內抑制子 (Z)', px0 + 135, py0 + ph + 16);
  }, [mode, pulseTime, sim]);

  const triggerLightPulse = () => {
    // 在 26h（主觀初夜，相位延遲）與 36h（主觀深夜，相位提前）之間輪流測試
    setPulseTime((prev) => (prev === 26 ? 36 : 26));
  };

  return (
    <div className="my-8 w-full max-w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 sm:p-5 text-slate-100 shadow-2xl">
      <div className="flex flex-col gap-3 border-b border-slate-700/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-bold tracking-wide text-amber-300">
            生理時鐘極限環與 KaiABC 離體振盪 ODE 求解器
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            即時四階龍格-庫塔數值積分：驗證希爾非線性門檻、溫度補償 Q<sub>10</sub> 與光脈衝時差相位偏移
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={triggerLightPulse}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            ⚡ 注入光脈衝 ({pulseTime === 26 ? '改試 36h 深夜' : '26h 初夜'})
          </button>
          {pulseTime !== null && (
            <button
              type="button"
              onClick={() => setPulseTime(null)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
            >
              清除脈衝
            </button>
          )}
        </div>
      </div>

      {/* Canvas 主視窗 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          className="block w-full h-auto rounded-lg"
        />
      </div>

      {/* 即時指標讀數 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">實測振盪週期</div>
          <div className="mt-1 font-mono text-base font-bold text-sky-300">
            {sim.isOscillating ? `${sim.periodHours.toFixed(2)} 小時` : '阻尼停止振盪'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">動力學狀態與溫度</div>
          <div className={`mt-1 text-xs sm:text-sm font-bold ${sim.isOscillating ? 'text-emerald-400' : 'text-rose-400'}`}>
            {sim.isOscillating ? '穩定極限環' : '收斂至不動點'} ({temperatureC}°C)
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">溫度補償係數 Q<sub>10</sub></div>
          <div className={`mt-1 font-mono text-sm sm:text-base font-bold ${isCompensated ? 'text-emerald-300' : 'text-rose-300'}`}>
            Q<sub>10</sub> = {q10Value.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">光脈衝相位偏移 Δφ</div>
          <div className="mt-1 font-mono text-base font-bold text-amber-300">
            {pulseTime === null
              ? '無干擾 (0.0 h)'
              : `${sim.phaseShiftHours >= 0 ? '+' : ''}${sim.phaseShiftHours.toFixed(2)} h`}
          </div>
        </div>
      </div>

      {/* 控制面板 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-300">分子擺輪模型架構</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode('kaiabc')}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  mode === 'kaiabc'
                    ? 'bg-sky-600 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                KaiABC 離體磷酸化鐘
              </button>
              <button
                type="button"
                onClick={() => setMode('goodwin')}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  mode === 'goodwin'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                TTFL 古德溫負回饋
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-300">溫度補償機制切換</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsCompensated(true)}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  isCompensated
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                啟用溫度補償 (Q<sub>10</sub> ≈ 1.02)
              </button>
              <button
                type="button"
                onClick={() => setIsCompensated(false)}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  !isCompensated
                    ? 'bg-rose-600 text-white'
                    : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                普通化學反應 (Q<sub>10</sub> = 2.05)
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">環境培養溫度 Θ</span>
              <span className="font-mono font-bold text-amber-300">{temperatureC} °C</span>
            </div>
            <input
              type="range"
              min={18}
              max={38}
              step={1}
              value={temperatureC}
              onChange={(e) => setTemperatureC(parseFloat(e.target.value))}
              className="mt-1.5 w-full accent-amber-500"
            />
            <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
              <span>18 °C</span>
              <span>25 °C (基準)</span>
              <span>38 °C</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">非線性協同希爾係數 n</span>
              <span className="font-mono font-bold text-sky-300">n = {hillN.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={5.0}
              max={12.0}
              step={0.5}
              value={hillN}
              onChange={(e) => setHillN(parseFloat(e.target.value))}
              className="mt-1.5 w-full accent-sky-500"
            />
            <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
              <span>n = 5.0 (過弱阻尼消退)</span>
              <span>n = 8.0+ (霍普夫極限環)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <strong className="text-slate-200">實驗指引：</strong>
        試著將希爾係數 n 調低至 6.0 以下，可親眼見證右側相平面極限環崩塌收縮成不動點；若切換為「普通化學反應 (Q<sub>10</sub> = 2.05)」並提高溫度至 35 °C，振盪週期將嚴重縮水至 12 小時以下，對比出溫度補償平衡對生物計時的決定性意義。
      </div>
    </div>
  );
};
