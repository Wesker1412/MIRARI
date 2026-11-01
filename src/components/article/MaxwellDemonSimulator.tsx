import React, { useState, useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export const MaxwellDemonSimulator: React.FC = () => {
  // Operational parameters
  const [autoDemon, setAutoDemon] = useState<boolean>(true);
  const [measurementError, setMeasurementError] = useState<number>(0.05); // 5% measurement noise
  const [thresholdVelocity, setThresholdVelocity] = useState<number>(2.2);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Thermodynamics & Information Metrics
  const [leftTemp, setLeftTemp] = useState<number>(300);
  const [rightTemp, setRightTemp] = useState<number>(300);
  const [leftCount, setLeftCount] = useState<number>(30);
  const [rightCount, setRightCount] = useState<number>(30);
  const [erasedBits, setErasedBits] = useState<number>(0);
  const [memoryBits, setMemoryBits] = useState<number>(0);
  const [isGateOpen, setIsGateOpen] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const gateOpenRef = useRef<boolean>(false);
  const memoryBitsRef = useRef<number>(0);
  const erasedBitsRef = useRef<number>(0);

  // Chamber geometry
  const width = 640;
  const height = 340;
  const barrierX = width / 2;
  const gateYTop = height * 0.35;
  const gateYBottom = height * 0.65;
  const memoryCapacity = 64; // bits before mandatory erasure

  // Initialize thermalized particles
  const initParticles = () => {
    const list: Particle[] = [];
    const count = 60;
    for (let i = 0; i < count; i++) {
      const isLeft = i < count / 2;
      const x = isLeft
        ? 20 + Math.random() * (barrierX - 40)
        : barrierX + 20 + Math.random() * (width - barrierX - 40);
      const y = 20 + Math.random() * (height - 40);

      // 2D Maxwell-Boltzmann-like velocity
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 2.5;

      list.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 4,
      });
    }
    particlesRef.current = list;
    memoryBitsRef.current = 0;
    erasedBitsRef.current = 0;
    setMemoryBits(0);
    setErasedBits(0);
  };

  useEffect(() => {
    initParticles();
  }, []);

  const handleEraseMemory = () => {
    erasedBitsRef.current += memoryBitsRef.current;
    memoryBitsRef.current = 0;
    setErasedBits(erasedBitsRef.current);
    setMemoryBits(0);
  };

  // Simulation & Animation loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const particles = particlesRef.current;

      if (isPlaying) {
        let shouldOpenGate = false;

        // Demon decision logic
        if (autoDemon) {
          for (const p of particles) {
            // Distance to gate
            const distToBarrier = Math.abs(p.x - barrierX);
            const inGateY = p.y >= gateYTop && p.y <= gateYBottom;

            if (distToBarrier < 25 && inGateY) {
              const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
              // Measurement with Gaussian noise/error
              const measuredSpeed = speed * (1 + (Math.random() - 0.5) * measurementError * 2);

              // Left to Right: allow if Fast
              if (p.x < barrierX && p.vx > 0 && measuredSpeed >= thresholdVelocity) {
                shouldOpenGate = true;
                memoryBitsRef.current++;
                break;
              }
              // Right to Left: allow if Slow
              if (p.x > barrierX && p.vx < 0 && measuredSpeed < thresholdVelocity) {
                shouldOpenGate = true;
                memoryBitsRef.current++;
                break;
              }
            }
          }

          // Auto-erase if memory overflows Landauer buffer
          if (memoryBitsRef.current >= memoryCapacity) {
            erasedBitsRef.current += memoryCapacity;
            memoryBitsRef.current = 0;
          }
        }

        gateOpenRef.current = autoDemon ? shouldOpenGate : isGateOpen;
        setIsGateOpen(gateOpenRef.current);
        setMemoryBits(memoryBitsRef.current);
        setErasedBits(erasedBitsRef.current);

        // Advance particles and bounce
        let lSpeedSqSum = 0;
        let rSpeedSqSum = 0;
        let lCount = 0;
        let rCount = 0;

        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;

          // Wall bounces
          if (p.x - p.radius < 0) {
            p.x = p.radius;
            p.vx = -p.vx;
          }
          if (p.x + p.radius > width) {
            p.x = width - p.radius;
            p.vx = -p.vx;
          }
          if (p.y - p.radius < 0) {
            p.y = p.radius;
            p.vy = -p.vy;
          }
          if (p.y + p.radius > height) {
            p.y = height - p.radius;
            p.vy = -p.vy;
          }

          // Central partition collision
          const isAtBarrierX = (p.x - p.radius <= barrierX && p.x + p.radius >= barrierX);
          if (isAtBarrierX) {
            const isThroughGate = gateOpenRef.current && (p.y >= gateYTop && p.y <= gateYBottom);
            if (!isThroughGate) {
              p.vx = -p.vx;
              p.x = p.x < barrierX ? barrierX - p.radius - 1 : barrierX + p.radius + 1;
            }
          }

          // Statistical accumulation
          const sSq = p.vx * p.vx + p.vy * p.vy;
          if (p.x < barrierX) {
            lSpeedSqSum += sSq;
            lCount++;
          } else {
            rSpeedSqSum += sSq;
            rCount++;
          }
        }

        setLeftCount(lCount);
        setRightCount(rCount);

        // Compute temperature proportional to kinetic energy T = (1/2) m <v^2>
        const tLeft = lCount > 0 ? Math.round((lSpeedSqSum / lCount) * 60) : 0;
        const tRight = rCount > 0 ? Math.round((rSpeedSqSum / rCount) * 60) : 0;
        setLeftTemp(tLeft);
        setRightTemp(tRight);
      }

      // Draw Chamber & Particles
      ctx.clearRect(0, 0, width, height);

      // Background Chambers (Left cool tint, Right warm tint)
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, barrierX, height);
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(barrierX, 0, width - barrierX, height);

      // Outer Border
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, width, height);

      // Central Partition Wall (Top and Bottom segments)
      ctx.fillStyle = '#475569';
      ctx.fillRect(barrierX - 3, 0, 6, gateYTop);
      ctx.fillRect(barrierX - 3, gateYBottom, 6, height - gateYBottom);

      // Trapdoor Gate
      if (gateOpenRef.current) {
        // Open Gate: faint dashed opening
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(barrierX - 8, gateYTop, 16, gateYBottom - gateYTop);
        ctx.setLineDash([]);
      } else {
        // Closed Gate (Solid barrier)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(barrierX - 4, gateYTop, 8, gateYBottom - gateYTop);
      }

      // Draw Particles (Color-coded by kinetic energy: Cold=Blue, Medium=Green, Fast/Hot=Red)
      for (const p of particles) {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        if (speed >= thresholdVelocity) {
          ctx.fillStyle = '#ef4444'; // Fast/Hot
        } else if (speed > 1.4) {
          ctx.fillStyle = '#10b981'; // Moderate
        } else {
          ctx.fillStyle = '#3b82f6'; // Cold
        }
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, autoDemon, measurementError, thresholdVelocity, isGateOpen]);

  // Landauer work calculation (W = N * k_B * T * ln(2)) in natural units
  const landauerWorkJoules = ((erasedBits * 0.693 * 1.38e-23 * 300) * 1e21).toFixed(2); // in zeptojoules (zJ)
  const deltaT = rightTemp - leftTemp;

  return (
    <div className="rounded-2xl border border-mirari-line bg-white p-4 sm:p-6 shadow-sm space-y-5 font-sans">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-mirari-line gap-2">
        <div>
          <span className="text-[11px] font-mono text-amber-700 uppercase tracking-wider font-semibold block">
            STATISTICAL MECHANICS · LANDAUER PRINCIPLE (1961)
          </span>
          <h4 className="font-serif text-lg font-bold text-mirari-ink">
            麥克斯韋妖與資訊熵熱力學極限模擬器
          </h4>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1.5 rounded-lg border border-mirari-line hover:bg-mirari-surfaceAlt text-mirari-muted transition font-medium"
          >
            {isPlaying ? '暫停模擬' : '繼續模擬'}
          </button>
          <button
            onClick={() => setAutoDemon(!autoDemon)}
            className={`px-3 py-1.5 rounded-lg border font-medium transition ${
              autoDemon
                ? 'bg-amber-600 border-amber-600 text-white'
                : 'border-mirari-line text-mirari-ink hover:bg-mirari-surfaceAlt'
            }`}
          >
            {autoDemon ? '自動麥克斯韋妖: 啟用中' : '切換為手動操作閘門'}
          </button>
          {!autoDemon && (
            <button
              onMouseDown={() => setIsGateOpen(true)}
              onMouseUp={() => setIsGateOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-mirari-ink text-white font-medium active:scale-95 transition"
            >
              按住打開閘門
            </button>
          )}
          <button
            onClick={initParticles}
            className="px-3 py-1.5 rounded-lg border border-mirari-line hover:bg-mirari-surfaceAlt text-mirari-muted transition"
          >
            重置熱平衡
          </button>
        </div>
      </div>

      {/* Simulator Chamber Canvas */}
      <div className="relative rounded-xl border border-mirari-line overflow-hidden shadow-inner flex justify-center bg-mirari-paper">
        <canvas ref={canvasRef} width={width} height={height} className="w-full max-w-[640px] h-[300px] sm:h-[340px]" />

        {/* Telemetry Dashboard: Left vs Right Chamber */}
        <div className="absolute top-3 left-4 bg-white/90 backdrop-blur-sm border border-mirari-line rounded-lg p-2.5 text-[11px] font-mono space-y-1 shadow-sm">
          <div className="font-bold text-blue-700">左腔室 (預期降溫)</div>
          <div>粒子數: {leftCount}</div>
          <div>等效溫度: <strong className="text-blue-900">{leftTemp} K</strong></div>
        </div>

        <div className="absolute top-3 right-4 bg-white/90 backdrop-blur-sm border border-mirari-line rounded-lg p-2.5 text-[11px] font-mono space-y-1 shadow-sm text-right">
          <div className="font-bold text-amber-700">右腔室 (預期升溫)</div>
          <div>粒子數: {rightCount}</div>
          <div>等效溫度: <strong className="text-amber-900">{rightTemp} K</strong></div>
        </div>

        {/* Gate Status Indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/85 backdrop-blur-sm border border-slate-700 text-slate-200 px-3 py-1 rounded-full text-[11px] font-mono">
          中央微觀閘門: {isGateOpen ? <span className="text-emerald-400 font-bold">開啟 (篩選中)</span> : <span>關閉</span>}
          {' · '}
          溫差 ΔT = <strong className={deltaT > 50 ? 'text-amber-400' : 'text-slate-300'}>{deltaT > 0 ? `+${deltaT}` : deltaT} K</strong>
        </div>
      </div>

      {/* Landauer Information Thermodynamics Metrics */}
      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs font-sans space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-amber-950 font-serif text-sm">
              蘭道爾原理 (Landauer Principle) 資訊代價即時核算
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-200/60 text-amber-900 font-mono">
              W ≥ k_B T ln(2)
            </span>
          </div>
          <button
            onClick={handleEraseMemory}
            className="px-2.5 py-1 rounded bg-amber-800 text-white text-[11px] hover:bg-amber-900 transition"
          >
            手動抹除記憶體 ({memoryBits} bits)
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px]">
          <div>
            <span className="text-amber-800 block text-[10px]">妖之記憶庫佔用:</span>
            <strong className="text-amber-950 text-sm">{memoryBits} / {memoryCapacity} bits</strong>
          </div>
          <div>
            <span className="text-amber-800 block text-[10px]">累計抹除資訊量:</span>
            <strong className="text-amber-950 text-sm">{erasedBits} bits</strong>
          </div>
          <div>
            <span className="text-amber-800 block text-[10px]">最小散熱耗功:</span>
            <strong className="text-amber-950 text-sm">{landauerWorkJoules} zJ</strong>
          </div>
          <div>
            <span className="text-amber-800 block text-[10px]">熱力學第二定律狀態:</span>
            <strong className="text-emerald-800 text-xs font-sans font-bold">✓ 嚴密守恆 (ΔS_總 ≥ 0)</strong>
          </div>
        </div>
      </div>

      {/* Control Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-sans pt-1">
        <div className="space-y-1.5">
          <div className="flex justify-between text-mirari-dim">
            <span>測量誤差率 (Noise Error)</span>
            <span className="font-mono text-mirari-ink font-semibold">{(measurementError * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={0.3}
            step={0.05}
            value={measurementError}
            onChange={(e) => setMeasurementError(Number(e.target.value))}
            className="w-full accent-amber-700 cursor-pointer"
          />
          <span className="text-[10px] text-mirari-dim block">
            誤差越高，妖的誤判越嚴重，溫差累積越慢
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-mirari-dim">
            <span>快慢粒子速度門檻</span>
            <span className="font-mono text-mirari-ink font-semibold">{thresholdVelocity.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={1.2}
            max={3.0}
            step={0.1}
            value={thresholdVelocity}
            onChange={(e) => setThresholdVelocity(Number(e.target.value))}
            className="w-full accent-amber-700 cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-mirari-dim block">物理精髓解析</span>
          <p className="text-[11px] text-mirari-muted leading-relaxed p-2 rounded bg-mirari-paper border border-mirari-line">
            妖獲取速度資訊時看似降低了氣體熵，但當其有限記憶體被抹除重置時，必然向環境散發至少 $k_B T \ln 2$ 的熱量，捍衛了第二定律。
          </p>
        </div>
      </div>
    </div>
  );
};
