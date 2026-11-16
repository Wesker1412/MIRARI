import { useState, useEffect, useRef, useMemo } from 'react';
import type { FC } from 'react';

type FlightMode = 'steady' | 'unsteady' | 'clap_fling';
type RotationPreset = 'advanced' | 'symmetric' | 'delayed' | 'custom';

interface LiftBreakdown {
  total: number;
  trans: number;
  rot: number;
  wake: number;
  clap: number;
  steadyRef: number;
}

interface FlowParticle {
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

interface ShedVortex {
  x: number;
  y: number;
  gamma: number;
  age: number;
  radius: number;
}

const STEADY_MAX_CL = 1.05;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute LEV attachment stability factor S(Ro) in [0.42, 1.0] based on Rossby number Ro = R / c.
 * Low Ro (~3-4) maintains stable attached LEV via rotational accelerations (Lentink & Dickinson 2009);
 * high Ro (> 7) approaches 2D translation where LEV detaches mid-stroke.
 */
function computeLevStability(rossby: number, halfPhase: number): {
  stability: number;
  sheddingPhase: number;
  isShedding: boolean;
} {
  // Steady attachment capacity decreases smoothly above Ro ~ 4.5
  const baseCapacity = 1 / (1 + Math.exp((rossby - 6.2) / 1.15));
  const detachStrength = 1 - baseCapacity;

  // In a half-stroke (halfPhase in [0, 1]), detachment starts after ~2.5 chord lengths (halfPhase > 0.32)
  const travelDecay =
    detachStrength > 0.12 && halfPhase > 0.28
      ? Math.min(1, (halfPhase - 0.28) / 0.45) * detachStrength
      : 0;

  const ripple = travelDecay * 0.16 * Math.sin(halfPhase * Math.PI * 5.0);
  const stability = Math.max(0.38, Math.min(1.0, 1.0 - 0.52 * travelDecay + ripple));
  return {
    stability,
    sheddingPhase: travelDecay,
    isShedding: rossby >= 6.5,
  };
}

/**
 * Compute steady fixed-wing lift coefficient (pre-stall linear rise, stall at ~15 deg, separated wake above).
 */
function computeSteadyAirfoilCl(alphaDeg: number, timeSec: number): number {
  const alphaRad = alphaDeg * DEG_TO_RAD;
  if (alphaDeg <= 15) {
    // Thin airfoil slope modified for viscous low-Re effects, peaking near 1.05 at 15 deg
    return Math.min(STEADY_MAX_CL, 2 * Math.PI * Math.sin(alphaRad) * 0.65);
  }
  // Post-stall drop and bluff-body separated bluff wake
  const dropFactor = Math.exp(-(alphaDeg - 15) / 14);
  const bluffCl = 1.15 * Math.sin(alphaRad) * Math.cos(alphaRad) + 0.38;
  const basePostStall = STEADY_MAX_CL * 0.55 * dropFactor + bluffCl * (1 - dropFactor * 0.55);
  const vortexRipple = 0.08 * Math.sin(timeSec * 8.5) * Math.min(1, (alphaDeg - 15) / 12);
  return Math.max(0.35, basePostStall + vortexRipple);
}

/**
 * Evaluate instantaneous lift coefficient decomposition at normalized cycle phase u in [0, 1).
 * Half-stroke 1 (downstroke): u in [0, 0.5), Half-stroke 2 (upstroke): u in [0.5, 1.0).
 */
function evaluateCycleLift(
  u: number,
  mode: FlightMode,
  alphaDeg: number,
  rotPhaseShift: number,
  rossby: number
): LiftBreakdown {
  const alphaRad = alphaDeg * DEG_TO_RAD;
  const steadyRef = computeSteadyAirfoilCl(alphaDeg, u * 2.4);

  if (mode === 'steady') {
    return {
      total: steadyRef,
      trans: steadyRef,
      rot: 0,
      wake: 0,
      clap: 0,
      steadyRef,
    };
  }

  // Empirical translational lift envelope from Dickinson et al. (1999) Robofly:
  // C_L,trans(alpha) = 0.225 + 1.58 * sin(2.13 * alpha - 7.2 deg)
  const dickinsonArg = (2.13 * alphaDeg - 7.2) * DEG_TO_RAD;
  const clTransMax = Math.max(0.25, 0.225 + 1.58 * Math.sin(dickinsonArg));

  // Position within current half-stroke [0, 1)
  const halfPhase = (u * 2) % 1;
  // Smooth translational speed profile |U(t)/U_max| ~ sin(pi * halfPhase)^0.75 (flat-ish mid-stroke)
  const velNorm = Math.pow(Math.max(0, Math.sin(Math.PI * halfPhase)), 0.72);
  const { stability } = computeLevStability(rossby, halfPhase);

  const trans = clTransMax * velNorm * stability;

  // Rotational circulation (Kramer effect) centered around stroke reversals u = 0, 0.5, 1.0
  // rotPhaseShift < 0 => Advanced (occurs before reversal, positive lift boost)
  // rotPhaseShift = 0 => Symmetric (biphasic cancellation around reversal)
  // rotPhaseShift > 0 => Delayed (occurs after reversal, negative lift dip)
  const sigmaRot = 0.055;
  const revCenters = [0 + rotPhaseShift, 0.5 + rotPhaseShift, 1.0 + rotPhaseShift];
  let rot = 0;

  for (const rc of revCenters) {
    const du = u - rc;
    if (Math.abs(du) < 0.22) {
      // Translational direction sign flips across reversal (0 or 0.5 or 1.0)
      const nearestReversal = rc < 0.25 ? 0 : rc < 0.75 ? 0.5 : 1.0;
      const beforeReversal = u < nearestReversal ? 1 : -1;
      // Pitch angular speed envelope (Gaussian pulse)
      const omegaEnv = Math.exp(-(du * du) / (2 * sigmaRot * sigmaRot));
      // Coupling with residual translational velocity |U|
      const reversalDist = Math.abs(u - nearestReversal);
      const couplingVel = Math.min(1, 0.22 + 1.45 * Math.sin(Math.PI * Math.min(0.5, reversalDist * 2)));
      const rotAmp = 1.08 * (0.55 + 0.45 * Math.sin(alphaRad));
      rot += beforeReversal * rotAmp * omegaEnv * couplingVel;
    }
  }

  // Wake capture peak right after stroke reversal (halfPhase ~ 0.08)
  // Strongest when Advanced or Symmetric; suppressed when Delayed
  const wakePhaseCenter = 0.085;
  const wakeWidth = 0.052;
  const dWake = halfPhase - wakePhaseCenter;
  const advanceBoost = Math.max(0.2, 1.0 - rotPhaseShift * 6.5);
  const wakeAmp = 0.78 * advanceBoost * (0.4 + 0.6 * Math.sin(alphaRad)) * (0.65 + 0.35 * stability);
  const wake = wakeAmp * Math.exp(-(dWake * dWake) / (2 * wakeWidth * wakeWidth));

  // Clap-and-Fling (Weis-Fogh 1973): strong early-stroke circulation boost during fling peeling
  let clap = 0;
  if (mode === 'clap_fling') {
    const flingCenter = 0.065;
    const flingWidth = 0.068;
    const dFling = halfPhase - flingCenter;
    clap = 1.65 * (0.5 + 0.5 * Math.sin(alphaRad)) * Math.exp(-(dFling * dFling) / (2 * flingWidth * flingWidth));
  }

  const total = trans + rot + wake + clap;
  return {
    total,
    trans,
    rot,
    wake,
    clap,
    steadyRef,
  };
}

/**
 * Compute wing kinematics (center position x, y and chord pitch angle) for animation rendering.
 */
function getWingKinematics(
  u: number,
  mode: FlightMode,
  alphaDeg: number,
  rotPhaseShift: number
): {
  xNorm: number; // [-1, 1] stroke sweep
  pitchRad: number; // angle of chord relative to horizontal
  strokeDir: number; // +1 moving right (downstroke), -1 moving left (upstroke)
  omegaPitch: number; // angular velocity proxy for visual arrows
  flingGapRad: number; // opening angle for clap-and-fling
} {
  if (mode === 'steady') {
    return {
      xNorm: 0,
      // Freestream flows left-to-right (+x), so Leading Edge faces LEFT and is tilted UP:
      pitchRad: -Math.PI + alphaDeg * DEG_TO_RAD,
      strokeDir: -1,
      omegaPitch: 0,
      flingGapRad: 0,
    };
  }

  const xNorm = -Math.cos(2 * Math.PI * u);
  const strokeDir = Math.sin(2 * Math.PI * u) >= 0 ? 1 : -1;

  // Target pitch angle so wing meets airflow at angle of attack alphaDeg:
  // Moving right (+1): leading edge is RIGHT, tilted up -> chord tilt = -alphaDeg (if LE is right, LE higher than TE)
  // Moving left (-1): leading edge is LEFT, tilted up -> chord tilt = +alphaDeg
  // Actually let's represent wing with explicit Leading Edge (LE) and Trailing Edge (TE) by rotating an oriented vector:
  // Smooth tanh flipping across stroke reversals shifted by rotPhaseShift
  const uShifted = ((u - rotPhaseShift) % 1 + 1) % 1;
  // Flip smoothly at uShifted = 0 and uShifted = 0.5
  const flipWidth = 0.065;
  const distHalf = uShifted - 0.5;

  // Smooth orientation s in [-1, 1]: +1 during downstroke (moving right), -1 during upstroke (moving left)
  let sOrient: number;
  if (uShifted < 0.25) {
    sOrient = Math.tanh(uShifted / flipWidth);
  } else if (uShifted < 0.75) {
    sOrient = -Math.tanh(distHalf / flipWidth);
  } else {
    sOrient = -Math.tanh((1 - uShifted) / flipWidth);
  }

  // Numerical derivative proxy for rotational arrows
  const eps = 0.005;
  const nextU = (u + eps) % 1;
  const nextShift = ((nextU - rotPhaseShift) % 1 + 1) % 1;
  const nextOrient =
    nextShift < 0.25
      ? Math.tanh(nextShift / flipWidth)
      : nextShift < 0.75
        ? -Math.tanh((nextShift - 0.5) / flipWidth)
        : -Math.tanh((1 - nextShift) / flipWidth);
  const omegaPitch = (nextOrient - sOrient) / eps;

  // Effective chord angle for rendering:
  // When sOrient = +1 (downstroke moving right), LE is on the right & raised => angle from +x to LE is -(90 - alpha)?
  // Let's keep it crystal clear: angle `theta` of the wing chord vector pointing from Trailing Edge to Leading Edge.
  // Downstroke (+1, moving right): TE is left-lower, LE is right-upper => angle = -alphaRad
  // At flip (sOrient = 0): wing stands vertical (angle = -pi/2)
  // Upstroke (-1, moving left): TE is right-lower, LE is left-upper => angle = -pi + alphaRad
  const alphaRad = alphaDeg * DEG_TO_RAD;
  const thetaDown = -alphaRad;
  const thetaUp = -Math.PI + alphaRad;
  const thetaMid = -Math.PI / 2;
  const pitchRad = thetaMid + sOrient * (thetaMid - thetaDown) * -1;
  // Check: sOrient = +1 => -pi/2 - (-pi/2 + alpha) = -alphaRad (LE right-up!)
  // Wait: thetaMid - thetaDown = -pi/2 - (-alphaRad) = -pi/2 + alphaRad.
  // Let's compute directly: linear interpolation from thetaUp (s=-1) through thetaMid (s=0) to thetaDown (s=+1)
  const pitchExact = thetaMid + sOrient * (Math.PI / 2 - alphaRad);
  void pitchRad;
  void thetaUp;

  // Clap & Fling opening angle near start of half-stroke
  const halfPhase = (u * 2) % 1;
  const flingGapRad =
    mode === 'clap_fling' && halfPhase < 0.16 ? Math.sin((halfPhase / 0.16) * Math.PI) * 0.45 : 0;

  return {
    xNorm,
    pitchRad: pitchExact,
    strokeDir,
    omegaPitch,
    flingGapRad,
  };
}

export const InsectFlappingLevSimulator: FC = () => {
  const [mode, setMode] = useState<FlightMode>('unsteady');
  const [alphaDeg, setAlphaDeg] = useState<number>(40);
  const [rotPhaseShift, setRotPhaseShift] = useState<number>(-0.08);
  const [rossby, setRossby] = useState<number>(3.2);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const flowCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);

  const phaseRef = useRef<number>(0.18);
  const particlesRef = useRef<FlowParticle[]>([]);
  const shedVorticesRef = useRef<ShedVortex[]>([]);
  const lastHalfRef = useRef<number>(0);

  const [telemetry, setTelemetry] = useState<LiftBreakdown>(() =>
    evaluateCycleLift(0.18, 'unsteady', 40, -0.08, 3.2)
  );
  const [phaseDisplay, setPhaseDisplay] = useState<number>(0.18);

  const rotPreset: RotationPreset = useMemo(() => {
    if (Math.abs(rotPhaseShift + 0.08) < 0.011) return 'advanced';
    if (Math.abs(rotPhaseShift) < 0.011) return 'symmetric';
    if (Math.abs(rotPhaseShift - 0.08) < 0.011) return 'delayed';
    return 'custom';
  }, [rotPhaseShift]);

  // Cycle-averaged lift coefficient integrated numerically over 100 samples
  const cycleAvgCl = useMemo(() => {
    let sum = 0;
    const N = 100;
    for (let i = 0; i < N; i++) {
      sum += evaluateCycleLift(i / N, mode, alphaDeg, rotPhaseShift, rossby).total;
    }
    return sum / N;
  }, [mode, alphaDeg, rotPhaseShift, rossby]);

  const steadyBaselineCl = useMemo(() => computeSteadyAirfoilCl(alphaDeg, 0.5), [alphaDeg]);

  // Initialize flow tracer particles once
  useEffect(() => {
    const pts: FlowParticle[] = [];
    for (let i = 0; i < 135; i++) {
      pts.push({
        x: Math.random() * 560,
        y: 30 + Math.random() * 240,
        life: Math.random() * 90,
        maxLife: 70 + Math.random() * 50,
      });
    }
    particlesRef.current = pts;
  }, []);

  // Immediate telemetry sync when sliders/controls change (even if paused!)
  useEffect(() => {
    const u = phaseRef.current;
    setTelemetry(evaluateCycleLift(u, mode, alphaDeg, rotPhaseShift, rossby));
  }, [mode, alphaDeg, rotPhaseShift, rossby]);

  // Animation loop for both canvases
  useEffect(() => {
    let animId = 0;
    let lastTs = performance.now();
    let uiTick = 0;

    const renderFrame = (now: number) => {
      const dt = Math.min(0.04, (now - lastTs) / 1000);
      lastTs = now;

      if (!isPaused) {
        // 1 flapping cycle takes ~3.6 seconds so users can visually inspect LEV, flip & wake capture
        phaseRef.current = (phaseRef.current + dt / 3.6) % 1;
      }

      const u = phaseRef.current;
      const currentHalf = u < 0.5 ? 0 : 1;
      const halfPhase = (u * 2) % 1;
      const lift = evaluateCycleLift(u, mode, alphaDeg, rotPhaseShift, rossby);
      const kin = getWingKinematics(u, mode, alphaDeg, rotPhaseShift);
      const levInfo = computeLevStability(rossby, halfPhase);

      // Spawn shed vortices on stroke reversal or high-Ro detachment
      if (!isPaused) {
        if (currentHalf !== lastHalfRef.current) {
          lastHalfRef.current = currentHalf;
          if (mode !== 'steady') {
            const cw = 560;
            const wingCx = cw * 0.5 + kin.xNorm * (cw * 0.28);
            shedVorticesRef.current.push({
              x: wingCx,
              y: 162,
              gamma: (currentHalf === 0 ? -1 : 1) * 320,
              age: 0,
              radius: 22,
            });
          }
        }
        // Periodic shedding when steady stalled or high Rossby
        if (
          (mode === 'steady' && alphaDeg > 15 && Math.random() < 0.09) ||
          (mode !== 'steady' && levInfo.isShedding && halfPhase > 0.35 && Math.random() < 0.08)
        ) {
          const cw = 560;
          const wingCx = cw * 0.5 + kin.xNorm * (cw * 0.28);
          shedVorticesRef.current.push({
            x: wingCx - kin.strokeDir * 24,
            y: 145 + (Math.random() - 0.5) * 18,
            gamma: -kin.strokeDir * 220,
            age: 0,
            radius: 16,
          });
        }

        // Age & advect shed vortices
        shedVorticesRef.current = shedVorticesRef.current
          .map((v) => ({
            ...v,
            x: v.x + (mode === 'steady' ? 85 * dt : 0),
            y: v.y + 18 * dt, // gentle downwash
            age: v.age + dt,
            radius: v.radius + 7 * dt,
          }))
          .filter((v) => v.age < 2.1 && v.x < 600);
      }

      // ─── 1. Render Flow & Wing Cross-Section Canvas ───────────────────
      const fCanvas = flowCanvasRef.current;
      if (fCanvas) {
        const ctx = fCanvas.getContext('2d');
        if (ctx) {
          const W = 560;
          const H = 300;
          ctx.fillStyle = '#070b14';
          ctx.fillRect(0, 0, W, H);

          // Subtle background grid
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
          ctx.lineWidth = 1;
          for (let gx = 40; gx < W; gx += 40) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, H);
            ctx.stroke();
          }
          for (let gy = 40; gy < H; gy += 40) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(W, gy);
            ctx.stroke();
          }

          const chord = 72;
          const wingY = 152;
          const wingCx = W * 0.5 + kin.xNorm * (W * 0.28);

          // Leading edge coordinates and upper-surface normal
          const leX = wingCx + Math.cos(kin.pitchRad) * (chord * 0.5);
          const leY = wingY + Math.sin(kin.pitchRad) * (chord * 0.5);
          const upNormalY = -Math.abs(Math.cos(kin.pitchRad));
          const upNormalX = kin.strokeDir >= 0 ? -Math.abs(Math.sin(kin.pitchRad)) : Math.abs(Math.sin(kin.pitchRad));

          const levStrength =
            mode === 'steady'
              ? alphaDeg <= 15
                ? 0.25
                : 0.08
              : Math.max(0.15, levInfo.stability * (0.45 + 0.55 * Math.sin(Math.PI * halfPhase)));
          const levOffset = 14 + levInfo.sheddingPhase * 22;
          const levX = (leX * 0.65 + wingCx * 0.35) + upNormalX * levOffset;
          const levY = (leY * 0.65 + wingY * 0.35) + upNormalY * levOffset;
          const levGamma = -kin.strokeDir * 520 * levStrength * (alphaDeg / 40);

          // Advect fluid tracer particles using synthetic Biot-Savart vortex field
          const particles = particlesRef.current;
          const stepDt = isPaused ? 0 : dt;

          particles.forEach((p) => {
            if (!isPaused) {
              p.life += dt * 45;
              if (p.life > p.maxLife || p.x < -15 || p.x > W + 15 || p.y < 5 || p.y > H - 5) {
                if (mode === 'steady') {
                  p.x = 4 + Math.random() * 20;
                  p.y = 28 + Math.random() * (H - 56);
                } else {
                  p.x = 30 + Math.random() * (W - 60);
                  p.y = 35 + Math.random() * (H - 70);
                }
                p.life = 0;
              }
            }

            // Velocity at particle position
            let vx = mode === 'steady' ? 115 : 0;
            let vy = 0;

            // LEV vortex core influence (Lamb-Oseen regularized Biot-Savart)
            if (mode !== 'steady' || alphaDeg <= 15) {
              const dx = p.x - levX;
              const dy = p.y - levY;
              const r2 = dx * dx + dy * dy + 220;
              const swirl = levGamma / r2;
              vx += -dy * swirl;
              vy += dx * swirl;
            }

            // Shed vortices influence
            for (const sv of shedVorticesRef.current) {
              const dx = p.x - sv.x;
              const dy = p.y - sv.y;
              const r2 = dx * dx + dy * dy + sv.radius * sv.radius;
              const swirl = (sv.gamma * Math.exp(-sv.age * 0.8)) / r2;
              vx += -dy * swirl;
              vy += dx * swirl;
            }

            // Downwash behind wing proportional to lift
            const dwDx = p.x - wingCx;
            const dwDy = p.y - wingY;
            const dwDist2 = dwDx * dwDx + dwDy * dwDy;
            if (dwDist2 < 6400) {
              vy += lift.total * 16 * Math.exp(-dwDist2 / 2600);
            }

            if (stepDt > 0) {
              p.x += vx * stepDt;
              p.y += vy * stepDt;
            }

            // Draw particle streak
            const speed = Math.sqrt(vx * vx + vy * vy);
            const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.78;
            const isNearLev =
              mode !== 'steady' &&
              (p.x - levX) * (p.x - levX) + (p.y - levY) * (p.y - levY) < 1200;

            ctx.strokeStyle = isNearLev
              ? `rgba(56, 189, 248, ${Math.min(0.95, alpha + 0.15)})`
              : `rgba(148, 163, 184, ${alpha * 0.65})`;
            ctx.lineWidth = isNearLev ? 1.8 : 1.2;
            const len = Math.min(12, Math.max(2.5, speed * 0.085));
            const inv = speed > 1e-3 ? 1 / speed : 0;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - vx * inv * len, p.y - vy * inv * len);
            ctx.stroke();
          });

          // Draw Shed Wake Vortices
          shedVorticesRef.current.forEach((sv) => {
            const fade = Math.max(0, 1 - sv.age / 2.1);
            ctx.strokeStyle = `rgba(192, 132, 252, ${0.42 * fade})`;
            ctx.lineWidth = 1.4;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(sv.x, sv.y, sv.radius, 0, Math.PI * 1.65);
            ctx.stroke();
            ctx.setLineDash([]);
          });

          // Draw Attached Leading-Edge Vortex (LEV) Core & Low-Pressure Glow
          if (mode !== 'steady') {
            const coreR = 16 + 10 * levStrength;
            const grad = ctx.createRadialGradient(levX, levY, 2, levX, levY, coreR * 1.45);
            grad.addColorStop(0, levInfo.isShedding ? 'rgba(245, 158, 11, 0.55)' : 'rgba(56, 189, 248, 0.65)');
            grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(levX, levY, coreR * 1.45, 0, Math.PI * 2);
            ctx.fill();

            // Swirling LEV rings
            const spinOffset = (now * 0.005 * -kin.strokeDir) % (Math.PI * 2);
            ctx.strokeStyle = levInfo.isShedding ? '#fbbf24' : '#38bdf8';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(levX, levY, coreR * 0.68, spinOffset, spinOffset + Math.PI * 1.45);
            ctx.stroke();

            ctx.fillStyle = levInfo.isShedding ? '#fcd34d' : '#7dd3fc';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(
              levInfo.isShedding ? 'LEV 剝離失速' : 'LEV 低壓渦核',
              levX - 30,
              levY - coreR * 0.85 - 4
            );
          } else if (alphaDeg > 15) {
            // Steady stall separation bubble label
            ctx.fillStyle = '#fb7185';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('前緣氣流剝離（失速尾流）', wingCx - 45, wingY - 46);
          }

          // Helper to draw a wing chord cross-section
          const drawWingChord = (cx: number, cy: number, pRad: number, highlightFlip: boolean) => {
            const x1 = cx - Math.cos(pRad) * (chord * 0.5);
            const y1 = cy - Math.sin(pRad) * (chord * 0.5);
            const x2 = cx + Math.cos(pRad) * (chord * 0.5);
            const y2 = cy + Math.sin(pRad) * (chord * 0.5);

            // Wing body
            ctx.strokeStyle = highlightFlip ? '#f59e0b' : '#f8fafc';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Leading Edge Marker (bright amber dot)
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(x2, y2, 4.5, 0, Math.PI * 2);
            ctx.fill();

            // Trailing Edge Marker (cyan dot)
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(x1, y1, 3, 0, Math.PI * 2);
            ctx.fill();
          };

          // Draw primary wing (and symmetric mirror wing if in Clap & Fling mode during clap/fling phase)
          const isFlappingFlip = mode !== 'steady' && Math.abs(kin.omegaPitch) > 3.5;
          if (mode === 'clap_fling' && halfPhase < 0.22) {
            // Symmetric dorsal-to-dorsal V-peel around shared trailing-edge pivot
            const openAngle = Math.min(0.65, (halfPhase / 0.22) * (Math.PI / 2 - alphaDeg * DEG_TO_RAD));
            const leftPitch = -Math.PI / 2 - openAngle;
            const rightPitch = -Math.PI / 2 + openAngle;
            const pivotX = wingCx;
            const pivotY = wingY + chord * 0.4;
            const leftCx = pivotX + Math.cos(leftPitch) * (chord * 0.5);
            const leftCy = pivotY + Math.sin(leftPitch) * (chord * 0.5);
            const rightCx = pivotX + Math.cos(rightPitch) * (chord * 0.5);
            const rightCy = pivotY + Math.sin(rightPitch) * (chord * 0.5);
            drawWingChord(leftCx, leftCy, leftPitch, true);
            drawWingChord(rightCx, rightCy, rightPitch, true);

            // Fling intake arrow rushing into the opening V-gap
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(pivotX, wingY - 56);
            ctx.lineTo(pivotX, wingY - 14);
            ctx.stroke();
            ctx.fillStyle = '#34d399';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('Fling 吸入環流', pivotX - 36, wingY - 62);
          } else {
            drawWingChord(wingCx, wingY, kin.pitchRad, isFlappingFlip);
          }

          // Instantaneous Lift Vector Arrow on Wing
          const liftArrowLen = Math.min(72, Math.max(-24, lift.total * 24));
          ctx.strokeStyle = lift.total >= 0 ? '#10b981' : '#f43f5e';
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.moveTo(wingCx, wingY);
          ctx.lineTo(wingCx, wingY - liftArrowLen);
          ctx.stroke();
          // Arrowhead
          const dirA = liftArrowLen >= 0 ? -1 : 1;
          ctx.fillStyle = lift.total >= 0 ? '#10b981' : '#f43f5e';
          ctx.beginPath();
          ctx.moveTo(wingCx, wingY - liftArrowLen + dirA * 6);
          ctx.lineTo(wingCx - 4.5, wingY - liftArrowLen - dirA * 3);
          ctx.lineTo(wingCx + 4.5, wingY - liftArrowLen - dirA * 3);
          ctx.closePath();
          ctx.fill();

          // Rotational circulation indicator during pitch flip
          if (isFlappingFlip) {
            ctx.strokeStyle = lift.rot >= 0 ? '#f59e0b' : '#fb7185';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(wingCx, wingY, 26, -Math.PI * 0.75, Math.PI * 0.25);
            ctx.stroke();
            ctx.fillStyle = lift.rot >= 0 ? '#fbbf24' : '#fda4af';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(
              lift.rot >= 0 ? '翻轉正向環流 (+)' : '翻轉反向抵銷 (-)',
              Math.max(12, Math.min(W - 120, wingCx - 46)),
              wingY + 46
            );
          }

          // Top-left HUD annotations
          ctx.fillStyle = '#94a3b8';
          ctx.font = '10px monospace';
          const phaseLabel =
            mode === 'steady'
              ? '定常風洞來流 →'
              : u < 0.5
                ? '下拍行程 (Downstroke →)'
                : '上拍行程 (← Upstroke)';
          ctx.fillText(`${phaseLabel} | α = ${alphaDeg}° | Ro = ${rossby >= 11 ? '∞ (純平動)' : rossby.toFixed(1)}`, 12, 18);

          // Legend bottom
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(12, H - 18, 8, 8);
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '10px sans-serif';
          ctx.fillText('前緣 (LE)', 24, H - 10);

          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(80, H - 18, 8, 8);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText('後緣 / LEV 渦旋', 92, H - 10);

          ctx.fillStyle = '#10b981';
          ctx.fillRect(188, H - 18, 8, 8);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText('瞬時總升力向量', 200, H - 10);
        }
      }

      // ─── 2. Render Instantaneous C_L(t) Decomposition Chart ───────────
      const cCanvas = chartCanvasRef.current;
      if (cCanvas) {
        const cCtx = cCanvas.getContext('2d');
        if (cCtx) {
          const CW = 560;
          const CH = 300;
          const padL = 46;
          const padR = 16;
          const padT = 28;
          const padB = 34;
          const plotW = CW - padL - padR;
          const plotH = CH - padT - padB;

          cCtx.fillStyle = '#070b14';
          cCtx.fillRect(0, 0, CW, CH);

          // Y-axis range: C_L from -0.8 to 3.6
          const clMin = -0.8;
          const clMax = 3.6;
          const toX = (phaseVal: number) => padL + phaseVal * plotW;
          const toY = (clVal: number) => padT + ((clMax - clVal) / (clMax - clMin)) * plotH;

          // Stroke half-cycle shading
          cCtx.fillStyle = 'rgba(15, 23, 42, 0.7)';
          cCtx.fillRect(toX(0), padT, plotW * 0.5, plotH);
          cCtx.fillStyle = 'rgba(30, 41, 59, 0.35)';
          cCtx.fillRect(toX(0.5), padT, plotW * 0.5, plotH);

          // Horizontal grid lines (0, 1, 2, 3)
          cCtx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
          cCtx.lineWidth = 1;
          for (const val of [-0.5, 0, 1, 2, 3]) {
            const yy = toY(val);
            cCtx.beginPath();
            cCtx.moveTo(padL, yy);
            cCtx.lineTo(CW - padR, yy);
            cCtx.stroke();

            cCtx.fillStyle = '#64748b';
            cCtx.font = '10px monospace';
            cCtx.textAlign = 'right';
            cCtx.fillText(val.toFixed(1), padL - 6, yy + 3);
          }
          cCtx.textAlign = 'left';

          // Zero axis highlight
          cCtx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          cCtx.beginPath();
          cCtx.moveTo(padL, toY(0));
          cCtx.lineTo(CW - padR, toY(0));
          cCtx.stroke();

          // Steady fixed-wing maximum lift limit line (C_L ~ 1.05)
          const steadyLimitY = toY(STEADY_MAX_CL);
          cCtx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
          cCtx.lineWidth = 1.4;
          cCtx.setLineDash([5, 4]);
          cCtx.beginPath();
          cCtx.moveTo(padL, steadyLimitY);
          cCtx.lineTo(CW - padR, steadyLimitY);
          cCtx.stroke();
          cCtx.setLineDash([]);

          cCtx.fillStyle = '#fb7185';
          cCtx.font = '10px monospace';
          cCtx.fillText('極限固定翼升力線 C_L ≈ 1.05', padL + 6, steadyLimitY - 5);

          // Plot curves across 140 sample points
          const samples = 140;
          const drawSeries = (
            extractor: (b: LiftBreakdown) => number,
            color: string,
            lineWidth: number,
            dashed = false
          ) => {
            cCtx.strokeStyle = color;
            cCtx.lineWidth = lineWidth;
            if (dashed) cCtx.setLineDash([3, 3]);
            cCtx.beginPath();
            for (let i = 0; i <= samples; i++) {
              const sU = i / samples;
              const b = evaluateCycleLift(sU, mode, alphaDeg, rotPhaseShift, rossby);
              const px = toX(sU);
              const py = Math.max(padT, Math.min(CH - padB, toY(extractor(b))));
              if (i === 0) cCtx.moveTo(px, py);
              else cCtx.lineTo(px, py);
            }
            cCtx.stroke();
            if (dashed) cCtx.setLineDash([]);
          };

          if (mode === 'steady') {
            drawSeries((b) => b.total, '#fb7185', 2.4);
          } else {
            drawSeries((b) => b.trans, '#10b981', 1.6, true);
            drawSeries((b) => b.rot, '#f59e0b', 1.6);
            drawSeries((b) => b.wake + b.clap, '#c084fc', 1.6);
            drawSeries((b) => b.total, '#38bdf8', 2.6);
          }

          // Reversal vertical divider at t/T = 0.5
          cCtx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          cCtx.lineWidth = 1;
          cCtx.beginPath();
          cCtx.moveTo(toX(0.5), padT);
          cCtx.lineTo(toX(0.5), CH - padB);
          cCtx.stroke();

          // Live playback vertical cursor
          const cursorX = toX(u);
          const cursorY = Math.max(padT, Math.min(CH - padB, toY(lift.total)));
          cCtx.strokeStyle = 'rgba(248, 250, 252, 0.7)';
          cCtx.lineWidth = 1.2;
          cCtx.beginPath();
          cCtx.moveTo(cursorX, padT);
          cCtx.lineTo(cursorX, CH - padB);
          cCtx.stroke();

          cCtx.fillStyle = '#f8fafc';
          cCtx.beginPath();
          cCtx.arc(cursorX, cursorY, 4.5, 0, Math.PI * 2);
          cCtx.fill();

          // Labels
          cCtx.fillStyle = '#cbd5e1';
          cCtx.font = 'bold 10px monospace';
          cCtx.fillText('瞬時升力係數 C_L(t) 分解曲線', padL, 17);
          cCtx.fillStyle = '#94a3b8';
          cCtx.font = '10px monospace';
          cCtx.fillText('下拍 (0.0–0.5 T)', toX(0.14), CH - 12);
          cCtx.fillText('上拍 (0.5–1.0 T)', toX(0.64), CH - 12);
        }
      }

      uiTick++;
      if (!isPaused && uiTick % 4 === 0) {
        setTelemetry(lift);
        setPhaseDisplay(u);
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [mode, alphaDeg, rotPhaseShift, rossby, isPaused]);

  const currentLevStability = useMemo(() => {
    const halfPhase = (phaseDisplay * 2) % 1;
    return computeLevStability(rossby, halfPhase);
  }, [rossby, phaseDisplay]);

  const rotationEffectLabel = useMemo(() => {
    if (mode === 'steady') return '固定翼無振翅翻轉';
    if (rotPhaseShift < -0.015) return '提前翻轉：正向克勞默環流 (+)';
    if (rotPhaseShift > 0.015) return '延遲翻轉：負向抵銷峰值 (-)';
    return '對稱翻轉：正負脈衝互抵';
  }, [mode, rotPhaseShift]);

  return (
    <div className="my-8 w-full max-w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 text-slate-100 shadow-2xl sm:p-6">
      {/* Header & Mode Tabs */}
      <div className="flex flex-col gap-3 border-b border-slate-700/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-bold tracking-wide text-cyan-400 sm:text-lg">
            昆蟲振翅非定常氣動力與前緣渦流（LEV）實驗台
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            即時對比固定翼定常失速極限、旋轉翼延遲失速（LEV）、翻轉旋轉環流與拍合甩開機制
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode('steady')}
            className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              mode === 'steady'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            定常固定翼 (Steady Airfoil)
          </button>
          <button
            type="button"
            onClick={() => setMode('unsteady')}
            className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              mode === 'unsteady'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            非定常振翅 (LEV + 翻轉 + 尾流)
          </button>
          <button
            type="button"
            onClick={() => setMode('clap_fling')}
            className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              mode === 'clap_fling'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            拍合與甩開 (Clap &amp; Fling)
          </button>
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-mono text-slate-200 hover:bg-slate-700"
          >
            {isPaused ? '▶ 繼續' : '⏸ 暫停'}
          </button>
        </div>
      </div>

      {/* Dual Canvases */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold text-slate-200">流場剖面：翅膀運動、LEV 渦旋與尾流</span>
            <span className="font-mono text-cyan-400">相位 t/T = {phaseDisplay.toFixed(2)}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            <canvas
              ref={flowCanvasRef}
              width={560}
              height={300}
              className="block h-56 w-full sm:h-64"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold text-slate-200">瞬時升力係數 C_L(t) 分解對照</span>
            <span className="font-mono text-emerald-400">
              週期平均 C̄_L = {cycleAvgCl.toFixed(2)}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            <canvas
              ref={chartCanvasRef}
              width={560}
              height={300}
              className="block h-56 w-full sm:h-64"
            />
          </div>
          {mode !== 'steady' && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-xs bg-sky-400" /> 總升力 C_L(t)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-xs bg-emerald-400" /> 延遲失速 (LEV)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-xs bg-amber-400" /> 旋轉環流
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-xs bg-purple-400" />{' '}
                {mode === 'clap_fling' ? '尾流捕獲 + Fling 脈衝' : '尾流捕獲'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Telemetry Cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">週期平均升力 C̄_L</div>
          <div className="mt-1 font-mono text-xl font-bold text-cyan-400 sm:text-2xl">
            {cycleAvgCl.toFixed(2)}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-400">
            對照固定翼極限 1.05 ({((cycleAvgCl / STEADY_MAX_CL) * 100).toFixed(0)}%)
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">瞬時升力 C_L(t)</div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-400 sm:text-2xl">
            {telemetry.total.toFixed(2)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-slate-400">
            LEV {telemetry.trans.toFixed(2)} · 旋 {telemetry.rot >= 0 ? '+' : ''}
            {telemetry.rot.toFixed(2)} · 尾 {(telemetry.wake + telemetry.clap).toFixed(2)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">LEV 穩定狀態 (Ro = {rossby >= 11 ? '∞' : rossby.toFixed(1)})</div>
          <div
            className={`mt-1 text-xs font-bold leading-snug sm:text-sm ${
              mode === 'steady'
                ? alphaDeg > 15
                  ? 'text-rose-400'
                  : 'text-emerald-400'
                : currentLevStability.isShedding
                  ? 'text-amber-400'
                  : 'text-emerald-400'
            }`}
          >
            {mode === 'steady'
              ? alphaDeg > 15
                ? `固定翼失速 (C_L ≈ ${steadyBaselineCl.toFixed(2)})`
                : `未失速附著流 (α ≤ 15°)`
              : currentLevStability.isShedding
                ? `高 Ro 剝離失速 (${Math.round(currentLevStability.stability * 100)}%)`
                : `低 Ro 穩定附著 (${Math.round(currentLevStability.stability * 100)}%)`}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            {mode === 'steady' ? '無翼根旋轉，無法排泄渦量' : 'Ro = R/c 控制離心排泄穩定度'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">反轉旋轉相位效應</div>
          <div
            className={`mt-1 text-xs font-bold leading-snug sm:text-sm ${
              mode === 'steady'
                ? 'text-slate-400'
                : rotPhaseShift < -0.015
                  ? 'text-amber-300'
                  : rotPhaseShift > 0.015
                    ? 'text-rose-400'
                    : 'text-sky-300'
            }`}
          >
            {rotationEffectLabel}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-slate-500">
            Δφ = {rotPhaseShift >= 0 ? '+' : ''}
            {(rotPhaseShift * 100).toFixed(0)}% 週期
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Control 1: Angle of Attack (Always Enabled) */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">幾何攻角 α (Angle of Attack)</span>
            <span className="font-mono font-bold text-cyan-400">α = {alphaDeg}°</span>
          </div>
          <input
            type="range"
            min={10}
            max={55}
            step={1}
            value={alphaDeg}
            onChange={(e) => setAlphaDeg(parseInt(e.target.value, 10))}
            className="mt-2 w-full cursor-pointer accent-cyan-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>10° (低攻角)</span>
            <span>15° (機翼失速線)</span>
            <span>45° (LEV 峰值)</span>
          </div>
        </div>

        {/* Control 2: Rotation Timing Phase */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">翻轉時序相位 Δφ</span>
            <span className="font-mono font-bold text-amber-400">
              {rotPreset === 'advanced'
                ? '提前 (Advanced)'
                : rotPreset === 'symmetric'
                  ? '對稱 (Symmetric)'
                  : rotPreset === 'delayed'
                    ? '延遲 (Delayed)'
                    : `${(rotPhaseShift * 100).toFixed(0)}%`}
            </span>
          </div>
          <input
            type="range"
            min={-0.12}
            max={0.12}
            step={0.02}
            value={rotPhaseShift}
            onChange={(e) => setRotPhaseShift(parseFloat(e.target.value))}
            className="mt-2 w-full cursor-pointer accent-amber-500"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setRotPhaseShift(-0.08)}
              className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium ${
                rotPreset === 'advanced'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              提前 (-8%)
            </button>
            <button
              type="button"
              onClick={() => setRotPhaseShift(0)}
              className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium ${
                rotPreset === 'symmetric'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              對稱 (0%)
            </button>
            <button
              type="button"
              onClick={() => setRotPhaseShift(0.08)}
              className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium ${
                rotPreset === 'delayed'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              延遲 (+8%)
            </button>
          </div>
        </div>

        {/* Control 3: Rossby Number Ro */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">羅斯貝數 Ro = R / c</span>
            <span className="font-mono font-bold text-emerald-400">
              {rossby >= 11 ? 'Ro → ∞ (純平動)' : `Ro = ${rossby.toFixed(1)}`}
            </span>
          </div>
          <input
            type="range"
            min={2.4}
            max={12.0}
            step={0.4}
            value={rossby}
            onChange={(e) => setRossby(parseFloat(e.target.value))}
            className="mt-2 w-full cursor-pointer accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>2.4 (低 Ro 穩定)</span>
            <span>4.0 (昆蟲典型)</span>
            <span>12 (近似純平動失速)</span>
          </div>
        </div>
      </div>

      {/* Explicit Model Boundary Note */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-300">模型簡化與物理邊界說明：</span>
        本模擬器為基於準定常與非定常低階氣動力學耦合（納入 Dickinson et al. 1999 延遲失速經驗擬合、旋轉環流、尾流捕獲及 Lentink &amp; Dickinson 2009 羅斯貝數穩定度權重）之教學可視化模型，流場粒子由合成二維渦核速度場驅動，非完整三維 Navier–Stokes 計算流體力學（CFD）求解器。
      </div>
    </div>
  );
};
