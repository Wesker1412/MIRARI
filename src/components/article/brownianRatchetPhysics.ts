const FRICTION = 0.05; // pN·s/nm
const MAX_FRAME_STEP = 0.04; // seconds; cap pauses without catching up in one frame
export const MAX_LANGEVIN_STEP = 0.0001; // seconds; resolve the steep 2 nm potential slope

export function ratchetTimeStep(previous: number | null, current: number): number {
  if (previous === null || !Number.isFinite(previous) || !Number.isFinite(current)) return 0;
  const elapsed = (current - previous) / 1000;
  return Number.isFinite(elapsed) && elapsed > 0 ? Math.min(MAX_FRAME_STEP, elapsed) : 0;
}

export function integrateRatchetStep(
  position: number,
  force: number,
  kBT: number,
  dt: number,
  gaussian: number,
): number | null {
  if (![position, force, kBT, dt, gaussian].every(Number.isFinite) || dt <= 0 || kBT < 0) return null;

  // Euler–Maruyama: deterministic drift plus a displacement with variance 2D·dt.
  // Sampling displacement directly avoids a noise force proportional to 1/sqrt(dt).
  const displacement = force * dt / FRICTION + Math.sqrt(2 * kBT * dt / FRICTION) * gaussian;
  const nextPosition = position + displacement;
  return Number.isFinite(nextPosition) && Math.abs(nextPosition) <= Number.MAX_SAFE_INTEGER
    ? nextPosition
    : null;
}

export function ratchetPowerZW(loadForce: number, velocity: number): number {
  // 1 pN · 1 nm/s = 10^-21 W = 1 zW. Display useful forward output only.
  const power = loadForce * velocity;
  return Number.isFinite(power) && loadForce > 0 && velocity > 0 ? power : 0;
}
