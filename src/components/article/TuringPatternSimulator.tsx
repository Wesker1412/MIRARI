import React, { useState, useEffect, useRef, useCallback } from 'react';

const N = 128;
const DU = 0.16;
const DV = 0.08;
const DT = 1.0;

interface Preset {
  key: string;
  label: string;
  feed: number;
  kill: number;
}

const PRESETS: Preset[] = [
  { key: 'spots', label: '斑點（豹紋型）', feed: 0.035, kill: 0.065 },
  { key: 'stripes', label: '條紋（斑馬型）', feed: 0.022, kill: 0.051 },
  { key: 'mazes', label: '迷宮（指紋型）', feed: 0.029, kill: 0.057 },
];

export const TuringPatternSimulator: React.FC = () => {
  const [feed, setFeed] = useState<number>(PRESETS[0].feed);
  const [kill, setKill] = useState<number>(PRESETS[0].kill);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [stepsPerFrame, setStepsPerFrame] = useState<number>(8);
  const [iteration, setIteration] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uRef = useRef<Float32Array>(new Float32Array(N * N));
  const vRef = useRef<Float32Array>(new Float32Array(N * N));
  const u2Ref = useRef<Float32Array>(new Float32Array(N * N));
  const v2Ref = useRef<Float32Array>(new Float32Array(N * N));
  const paramsRef = useRef({ feed, kill, stepsPerFrame });
  const iterRef = useRef<number>(0);
  const imageRef = useRef<ImageData | null>(null);

  useEffect(() => {
    paramsRef.current = { feed, kill, stepsPerFrame };
  }, [feed, kill, stepsPerFrame]);

  const seed = useCallback(() => {
    const u = uRef.current;
    const v = vRef.current;
    u.fill(1);
    v.fill(0);
    for (let s = 0; s < 24; s++) {
      const cx = 8 + Math.floor(Math.random() * (N - 16));
      const cy = 8 + Math.floor(Math.random() * (N - 16));
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const idx = (cy + dy) * N + (cx + dx);
          u[idx] = 0.5 + Math.random() * 0.02;
          v[idx] = 0.25 + Math.random() * 0.02;
        }
      }
    }
    iterRef.current = 0;
    setIteration(0);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!imageRef.current) imageRef.current = ctx.createImageData(N, N);
    const data = imageRef.current.data;
    const v = vRef.current;
    for (let i = 0; i < N * N; i++) {
      const t = Math.min(1, v[i] * 3);
      const p = i * 4;
      data[p] = 15 + 230 * t;
      data[p + 1] = 23 + 160 * t;
      data[p + 2] = 42 + 30 * t;
      data[p + 3] = 255;
    }
    ctx.putImageData(imageRef.current, 0, 0);
  }, []);

  const step = useCallback(() => {
    const { feed: F, kill: K } = paramsRef.current;
    const u = uRef.current;
    const v = vRef.current;
    const nu = u2Ref.current;
    const nv = v2Ref.current;
    for (let y = 0; y < N; y++) {
      const ym = ((y - 1 + N) % N) * N;
      const yp = ((y + 1) % N) * N;
      const yc = y * N;
      for (let x = 0; x < N; x++) {
        const xm = (x - 1 + N) % N;
        const xp = (x + 1) % N;
        const i = yc + x;
        const uc = u[i];
        const vc = v[i];
        const lapU = u[yc + xm] + u[yc + xp] + u[ym + x] + u[yp + x] - 4 * uc;
        const lapV = v[yc + xm] + v[yc + xp] + v[ym + x] + v[yp + x] - 4 * vc;
        const uvv = uc * vc * vc;
        nu[i] = uc + DT * (DU * lapU - uvv + F * (1 - uc));
        nv[i] = vc + DT * (DV * lapV + uvv - (F + K) * vc);
      }
    }
    uRef.current = nu;
    vRef.current = nv;
    u2Ref.current = u;
    v2Ref.current = v;
  }, []);

  useEffect(() => {
    seed();
    draw();
  }, [seed, draw]);

  useEffect(() => {
    if (!isRunning) return;
    let frameId = 0;
    let frameCount = 0;
    const loop = () => {
      const n = paramsRef.current.stepsPerFrame;
      for (let k = 0; k < n; k++) step();
      iterRef.current += n;
      draw();
      frameCount++;
      if (frameCount % 15 === 0) setIteration(iterRef.current);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isRunning, step, draw]);

  const applyPreset = (p: Preset) => {
    setFeed(p.feed);
    setKill(p.kill);
    paramsRef.current = { ...paramsRef.current, feed: p.feed, kill: p.kill };
    seed();
    draw();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = Math.floor(((e.clientX - rect.left) / rect.width) * N);
    const cy = Math.floor(((e.clientY - rect.top) / rect.height) * N);
    const u = uRef.current;
    const v = vRef.current;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = (cx + dx + N) % N;
        const y = (cy + dy + N) % N;
        u[y * N + x] = 0.5;
        v[y * N + x] = 0.25;
      }
    }
    draw();
  };

  return (
    <div className="my-8 rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-200">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-amber-300">Gray-Scott 反應擴散實驗台</h3>
        <p className="text-sm text-slate-400">
          128 x 128 週期邊界網格。亮色代表活化物 V 的濃度；點擊畫布可注入新的擾動。
        </p>
      </div>
      <div className="flex flex-col gap-5 md:flex-row">
        <canvas
          ref={canvasRef}
          width={N}
          height={N}
          onClick={handleCanvasClick}
          className="w-full max-w-[384px] cursor-crosshair rounded border border-slate-600"
          style={{ imageRendering: 'pixelated', aspectRatio: '1 / 1' }}
        />
        <div className="flex flex-1 flex-col gap-4 text-sm">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p)}
                className={`rounded px-3 py-1.5 border ${
                  Math.abs(feed - p.feed) < 1e-6 && Math.abs(kill - p.kill) < 1e-6
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-slate-600 bg-slate-800 hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1">
            <span>補給率 F（feed）：{feed.toFixed(4)}</span>
            <input type="range" min={0.01} max={0.08} step={0.0005} value={feed}
              onChange={(e) => setFeed(parseFloat(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1">
            <span>移除率 k（kill）：{kill.toFixed(4)}</span>
            <input type="range" min={0.04} max={0.075} step={0.0005} value={kill}
              onChange={(e) => setKill(parseFloat(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1">
            <span>每幀積分步數：{stepsPerFrame}</span>
            <input type="range" min={1} max={20} step={1} value={stepsPerFrame}
              onChange={(e) => setStepsPerFrame(parseInt(e.target.value, 10))} />
          </label>
          <div className="flex gap-2">
            <button onClick={() => setIsRunning((r) => !r)}
              className="rounded bg-sky-600 px-4 py-1.5 font-medium hover:bg-sky-500">
              {isRunning ? '暫停' : '繼續'}
            </button>
            <button onClick={() => { seed(); draw(); }}
              className="rounded bg-slate-700 px-4 py-1.5 hover:bg-slate-600">
              重新播種
            </button>
          </div>
          <p className="text-slate-400">已積分步數：{iteration}</p>
          <p className="text-xs leading-relaxed text-slate-500">
            擴散係數 D_u = {DU}、D_v = {DV}（抑制性的基質擴散較快）。顯式歐拉法、五點拉普拉斯算子、時間步長 dt = {DT}。
            F 與 k 的微小變化即可讓系統在斑點、條紋、迷宮與均勻態之間切換。
          </p>
        </div>
      </div>
    </div>
  );
};
