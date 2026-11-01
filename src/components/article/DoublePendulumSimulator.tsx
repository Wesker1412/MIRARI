import React, { useState, useEffect, useRef } from 'react';

interface PendulumState {
  theta1: number;
  theta2: number;
  omega1: number;
  omega2: number;
}

export const DoublePendulumSimulator: React.FC = () => {
  // Physical parameters
  const [initialAngle1, setInitialAngle1] = useState<number>(90); // degrees
  const [initialAngle2, setInitialAngle2] = useState<number>(90); // degrees
  const [perturbation, setPerturbation] = useState<number>(0.001); // radians difference for shadow pendulum
  const [gravity, setGravity] = useState<number>(9.81);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [timeSpeed, setTimeSpeed] = useState<number>(1.0);
  const [showShadow, setShowShadow] = useState<boolean>(true);

  // Real-time divergence metrics
  const [currentDivergence, setCurrentDivergence] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulation physics states
  const p1Ref = useRef<PendulumState>({
    theta1: (90 * Math.PI) / 180,
    theta2: (90 * Math.PI) / 180,
    omega1: 0,
    omega2: 0,
  });

  const p2Ref = useRef<PendulumState>({
    theta1: (90 * Math.PI) / 180,
    theta2: (90 * Math.PI) / 180 + 0.001,
    omega1: 0,
    omega2: 0,
  });

  // History trails for rendering
  const trail1Ref = useRef<{ x: number; y: number }[]>([]);
  const trail2Ref = useRef<{ x: number; y: number }[]>([]);

  // Constant pendulum geometry
  const l1 = 110;
  const l2 = 100;
  const m1 = 1.0;
  const m2 = 1.0;

  // Exact Equations of Motion derivatives
  const getDerivatives = (state: PendulumState, gVal: number) => {
    const { theta1, theta2, omega1, omega2 } = state;
    const delta = theta1 - theta2;

    const den1 = l1 * (2 * m1 + m2 - m2 * Math.cos(2 * delta));
    const num1 =
      -gVal * (2 * m1 + m2) * Math.sin(theta1) -
      m2 * gVal * Math.sin(theta1 - 2 * theta2) -
      2 * Math.sin(delta) * m2 * (omega2 * omega2 * l2 + omega1 * omega1 * l1 * Math.cos(delta));
    const alpha1 = num1 / den1;

    const den2 = l2 * (2 * m1 + m2 - m2 * Math.cos(2 * delta));
    const num2 =
      2 *
      Math.sin(delta) *
      (omega1 * omega1 * l1 * (m1 + m2) +
        gVal * (m1 + m2) * Math.cos(theta1) +
        omega2 * omega2 * l2 * m2 * Math.cos(delta));
    const alpha2 = num2 / den2;

    return {
      dTheta1: omega1,
      dTheta2: omega2,
      dOmega1: alpha1,
      dOmega2: alpha2,
    };
  };

  // Runge-Kutta 4th Order (RK4) Integrator
  const rk4Step = (state: PendulumState, dt: number, gVal: number): PendulumState => {
    const k1 = getDerivatives(state, gVal);

    const s2: PendulumState = {
      theta1: state.theta1 + 0.5 * dt * k1.dTheta1,
      theta2: state.theta2 + 0.5 * dt * k1.dTheta2,
      omega1: state.omega1 + 0.5 * dt * k1.dOmega1,
      omega2: state.omega2 + 0.5 * dt * k1.dOmega2,
    };
    const k2 = getDerivatives(s2, gVal);

    const s3: PendulumState = {
      theta1: state.theta1 + 0.5 * dt * k2.dTheta1,
      theta2: state.theta2 + 0.5 * dt * k2.dTheta2,
      omega1: state.omega1 + 0.5 * dt * k2.dOmega1,
      omega2: state.omega2 + 0.5 * dt * k2.dOmega2,
    };
    const k3 = getDerivatives(s3, gVal);

    const s4: PendulumState = {
      theta1: state.theta1 + dt * k3.dTheta1,
      theta2: state.theta2 + dt * k3.dTheta2,
      omega1: state.omega1 + dt * k3.dOmega1,
      omega2: state.omega2 + dt * k3.dOmega2,
    };
    const k4 = getDerivatives(s4, gVal);

    return {
      theta1: state.theta1 + (dt / 6) * (k1.dTheta1 + 2 * k2.dTheta1 + 2 * k3.dTheta1 + k4.dTheta1),
      theta2: state.theta2 + (dt / 6) * (k1.dTheta2 + 2 * k2.dTheta2 + 2 * k3.dTheta2 + k4.dTheta2),
      omega1: state.omega1 + (dt / 6) * (k1.dOmega1 + 2 * k2.dOmega1 + 2 * k3.dOmega1 + k4.dOmega1),
      omega2: state.omega2 + (dt / 6) * (k1.dOmega2 + 2 * k2.dOmega2 + 2 * k3.dOmega2 + k4.dOmega2),
    };
  };

  const handleReset = () => {
    const t1 = (initialAngle1 * Math.PI) / 180;
    const t2 = (initialAngle2 * Math.PI) / 180;
    p1Ref.current = { theta1: t1, theta2: t2, omega1: 0, omega2: 0 };
    p2Ref.current = { theta1: t1, theta2: t2 + perturbation, omega1: 0, omega2: 0 };
    trail1Ref.current = [];
    trail2Ref.current = [];
    setElapsedTime(0);
    setCurrentDivergence(perturbation);
  };

  // Re-initialize when sliders change while paused
  useEffect(() => {
    handleReset();
  }, [initialAngle1, initialAngle2, perturbation]);

  // Animation Loop
  useEffect(() => {
    let animId: number;
    const dt = 0.02 * timeSpeed;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const originX = width / 2;
      const originY = height * 0.38;

      if (isPlaying) {
        // RK4 physics advancement (multiple small substeps for supreme stability)
        const subSteps = 4;
        const subDt = dt / subSteps;
        for (let i = 0; i < subSteps; i++) {
          p1Ref.current = rk4Step(p1Ref.current, subDt, gravity);
          if (showShadow) {
            p2Ref.current = rk4Step(p2Ref.current, subDt, gravity);
          }
        }

        setElapsedTime((prev) => prev + dt);

        // Calculate angular phase-space divergence
        const d1 = p1Ref.current.theta1 - p2Ref.current.theta1;
        const d2 = p1Ref.current.theta2 - p2Ref.current.theta2;
        const divDist = Math.sqrt(d1 * d1 + d2 * d2);
        setCurrentDivergence(divDist);
      }

      // Positions of Pendulum 1
      const x1 = originX + l1 * Math.sin(p1Ref.current.theta1);
      const y1 = originY + l1 * Math.cos(p1Ref.current.theta1);
      const x2 = x1 + l2 * Math.sin(p1Ref.current.theta2);
      const y2 = y1 + l2 * Math.cos(p1Ref.current.theta2);

      // Positions of Pendulum 2 (Shadow)
      const sx1 = originX + l1 * Math.sin(p2Ref.current.theta1);
      const sy1 = originY + l1 * Math.cos(p2Ref.current.theta1);
      const sx2 = sx1 + l2 * Math.sin(p2Ref.current.theta2);
      const sy2 = sy1 + l2 * Math.cos(p2Ref.current.theta2);

      // Update trails
      if (isPlaying) {
        trail1Ref.current.push({ x: x2, y: y2 });
        if (trail1Ref.current.length > 140) trail1Ref.current.shift();

        if (showShadow) {
          trail2Ref.current.push({ x: sx2, y: sy2 });
          if (trail2Ref.current.length > 140) trail2Ref.current.shift();
        }
      }

      // Clear frame
      ctx.clearRect(0, 0, width, height);

      // Background subtle grid
      ctx.strokeStyle = '#f0ece1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += 40) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += 40) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Draw Shadow Trail (Amber/Warm Red)
      if (showShadow && trail2Ref.current.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.moveTo(trail2Ref.current[0].x, trail2Ref.current[0].y);
        for (let i = 1; i < trail2Ref.current.length; i++) {
          ctx.lineTo(trail2Ref.current[i].x, trail2Ref.current[i].y);
        }
        ctx.stroke();
      }

      // Draw Primary Trail (Cobalt/Indigo)
      if (trail1Ref.current.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(30, 58, 138, 0.65)';
        ctx.lineWidth = 2.2;
        ctx.moveTo(trail1Ref.current[0].x, trail1Ref.current[0].y);
        for (let i = 1; i < trail1Ref.current.length; i++) {
          ctx.lineTo(trail1Ref.current[i].x, trail1Ref.current[i].y);
        }
        ctx.stroke();
      }

      // Draw Shadow Pendulum (Secondary perturbed trajectory)
      if (showShadow) {
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();

        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(sx1, sy1, 4, 0, Math.PI * 2);
        ctx.arc(sx2, sy2, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Primary Pendulum (Rods)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Pivot
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(originX, originY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Bob 1
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(x1, y1, 8, 0, Math.PI * 2);
      ctx.fill();

      // Bob 2
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.arc(x2, y2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, timeSpeed, gravity, showShadow]);

  // Divergence magnitude formatted
  const divergenceExp = currentDivergence > 0 ? (Math.log(currentDivergence) / Math.LN10).toFixed(2) : '-';

  return (
    <div className="rounded-2xl border border-mirari-line bg-white p-4 sm:p-6 shadow-sm space-y-5 font-sans">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-mirari-line gap-2">
        <div>
          <span className="text-[11px] font-mono text-mirari-cobalt uppercase tracking-wider font-semibold block">
            NONLINEAR DYNAMICS · RK4 NUMERICAL SOLVER
          </span>
          <h4 className="font-serif text-lg font-bold text-mirari-ink">
            雙擺運動與李雅普諾夫發散模擬器
          </h4>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1.5 rounded-lg bg-mirari-ink text-white hover:bg-black transition font-medium"
          >
            {isPlaying ? '暫停模擬' : '繼續運行'}
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg border border-mirari-line hover:bg-mirari-surfaceAlt text-mirari-muted transition"
          >
            重置初值
          </button>
        </div>
      </div>

      {/* Simulator Viewport */}
      <div className="relative rounded-xl border border-mirari-line bg-mirari-paper overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} width={640} height={380} className="w-full max-w-[640px] h-[320px] sm:h-[380px]" />

        {/* Real-time Telemetry Overlay */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm border border-mirari-line rounded-lg p-2.5 text-[11px] font-mono text-mirari-ink space-y-1 shadow-sm">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-700 inline-block" />
            <span>基準軌道 A</span>
            <span className="text-mirari-dim">|</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>微擾軌道 B (Δθ={perturbation} rad)</span>
          </div>
          <div className="text-mirari-muted pt-0.5">
            運動時間 t = {elapsedTime.toFixed(2)} s
          </div>
          <div className="flex items-center space-x-2 pt-0.5">
            <span className="text-mirari-dim">相空間歐氏發散量:</span>
            <span className={`font-bold ${currentDivergence > 0.5 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {currentDivergence.toFixed(4)} rad (10^{divergenceExp})
            </span>
          </div>
        </div>

        {/* Status Callout when diverged */}
        {currentDivergence > 1.0 && (
          <div className="absolute bottom-3 right-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-1 text-[11px] font-sans shadow-sm animate-fade-in">
            ⚠️ 軌道已全面進入非線性混沌分離（蝴蝶效應顯現）
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans pt-1">
        <div className="space-y-1.5">
          <div className="flex justify-between text-mirari-dim">
            <span>第一擺桿初始角 (θ₁)</span>
            <span className="font-mono text-mirari-ink font-semibold">{initialAngle1}°</span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            value={initialAngle1}
            onChange={(e) => setInitialAngle1(Number(e.target.value))}
            className="w-full accent-mirari-ink cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-mirari-dim">
            <span>第二擺桿初始角 (θ₂)</span>
            <span className="font-mono text-mirari-ink font-semibold">{initialAngle2}°</span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            value={initialAngle2}
            onChange={(e) => setInitialAngle2(Number(e.target.value))}
            className="w-full accent-mirari-ink cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-mirari-dim">
            <span>微擾差量 (Δθ₀)</span>
            <span className="font-mono text-mirari-amber font-semibold">{perturbation} rad</span>
          </div>
          <input
            type="range"
            min={0.0001}
            max={0.01}
            step={0.0005}
            value={perturbation}
            onChange={(e) => setPerturbation(Number(e.target.value))}
            className="w-full accent-mirari-amber cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-mirari-dim">
            <span>重力場環境</span>
            <span className="font-mono text-mirari-ink font-semibold">{gravity} m/s²</span>
          </div>
          <div className="flex items-center space-x-1">
            {[
              { label: '地球 (9.8)', g: 9.81 },
              { label: '月球 (1.6)', g: 1.62 },
              { label: '木星 (24.8)', g: 24.79 },
            ].map((env) => (
              <button
                key={env.label}
                onClick={() => setGravity(env.g)}
                className={`flex-1 py-1 rounded border text-[11px] font-mono ${
                  gravity === env.g
                    ? 'bg-mirari-ink text-white border-mirari-ink'
                    : 'border-mirari-line hover:bg-mirari-surfaceAlt text-mirari-muted'
                }`}
              >
                {env.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-mirari-dim">
            <span>時間流速與微擾對照</span>
            <span className="font-mono text-mirari-ink font-semibold">{timeSpeed}x</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowShadow(!showShadow)}
              className={`py-1 px-2 rounded border text-[11px] transition ${
                showShadow
                  ? 'bg-amber-100 border-amber-300 text-amber-900 font-medium'
                  : 'border-mirari-line text-mirari-dim'
              }`}
            >
              {showShadow ? '微擾軌道: 開' : '微擾軌道: 關'}
            </button>
            {[0.5, 1.0, 2.0].map((s) => (
              <button
                key={s}
                onClick={() => setTimeSpeed(s)}
                className={`flex-1 py-1 rounded border text-[11px] font-mono ${
                  timeSpeed === s
                    ? 'bg-mirari-ink text-white border-mirari-ink'
                    : 'border-mirari-line hover:bg-mirari-surfaceAlt text-mirari-muted'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
