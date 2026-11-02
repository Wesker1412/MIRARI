import React, { useState, useEffect, useRef, useMemo } from 'react';

type LensingScenario = 'massive_cluster' | 'cosmic_filament' | 'baryon_only';

interface BackgroundGalaxy {
  id: number;
  x: number; // 0 to 640
  y: number; // 0 to 260
  intrinsicE1: number; // intrinsic shape noise ~0.25
  intrinsicE2: number;
  baseRadius: number;
  redshift: number;
  color: string;
}

export const WeakLensingShearSimulator: React.FC = () => {
  const [scenario, setScenario] = useState<LensingScenario>('massive_cluster');
  const [darkMatterMass, setDarkMatterMass] = useState<number>(8.5); // 10^14 M_sun (1.0 to 25.0)
  const [showMassMap, setShowMassMap] = useState<boolean>(true); // Kaiser-Squires reconstruction overlay
  const [showShearSticks, setShowShearSticks] = useState<boolean>(true); // Draw tangential shear vectors
  const [sourceRedshift, setSourceRedshift] = useState<number>(2.2); // z_s: 1.0 to 3.5

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pre-generate a static field of background galaxies with random positions and intrinsic shapes
  const galaxiesRef = useRef<BackgroundGalaxy[]>([]);

  useEffect(() => {
    const list: BackgroundGalaxy[] = [];
    const count = 180;
    const colors = ['#e2e8f0', '#93c5fd', '#fde047', '#fed7aa', '#f472b6'];

    for (let i = 0; i < count; i++) {
      // Intrinsic ellipticities distributed with standard deviation sigma_e ~ 0.25
      const u1 = Math.random() || 1e-4;
      const u2 = Math.random() || 1e-4;
      const r = 0.22 * Math.sqrt(-2 * Math.log(u1));
      const theta = 2 * Math.PI * u2;

      list.push({
        id: i,
        x: Math.random() * 640,
        y: Math.random() * 260,
        intrinsicE1: r * Math.cos(theta),
        intrinsicE2: r * Math.sin(theta),
        baseRadius: Math.random() * 4.5 + 3.0,
        redshift: 1.2 + Math.random() * 2.0,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    galaxiesRef.current = list;
  }, []);

  // Dark matter potential centers depending on scenario
  const halos = useMemo(() => {
    if (scenario === 'baryon_only') {
      // Weak baryon gas only, mass down by 85%
      return [{ x: 320, y: 130, mass: darkMatterMass * 0.15, rScale: 35 }];
    }
    if (scenario === 'cosmic_filament') {
      // Two massive nodes connected by a bridge
      return [
        { x: 200, y: 120, mass: darkMatterMass * 0.6, rScale: 40 },
        { x: 440, y: 140, mass: darkMatterMass * 0.55, rScale: 42 },
        { x: 320, y: 130, mass: darkMatterMass * 0.35, rScale: 65 }, // filament bridge
      ];
    }
    // Default: Massive Cluster Core
    return [{ x: 320, y: 130, mass: darkMatterMass, rScale: 45 }];
  }, [scenario, darkMatterMass]);

  // Handle scenario switch
  const handleScenarioChange = (newScen: LensingScenario) => {
    setScenario(newScen);
    if (newScen === 'baryon_only') {
      setDarkMatterMass(2.0);
    } else if (newScen === 'cosmic_filament') {
      setDarkMatterMass(12.0);
    } else {
      setDarkMatterMass(8.5);
    }
  };

  // ─── Canvas Render Loop ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Deep space black viewport
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, w, h);

    // ─── 1. Optional: Render Kaiser-Squires Reconstructed Mass Map ──
    if (showMassMap) {
      // Reconstructed 2D dark matter density surface brightness
      halos.forEach((halo) => {
        const grad = ctx.createRadialGradient(halo.x, halo.y, 2, halo.x, halo.y, halo.rScale * 3.5);
        const alphaPeak = scenario === 'baryon_only' ? 0.18 : 0.45;
        grad.addColorStop(0, `rgba(168, 85, 247, ${alphaPeak})`);
        grad.addColorStop(0.4, `rgba(59, 130, 246, ${alphaPeak * 0.6})`);
        grad.addColorStop(0.8, `rgba(6, 182, 212, ${alphaPeak * 0.2})`);
        grad.addColorStop(1, 'rgba(6, 9, 19, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(halo.x, halo.y, halo.rScale * 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Contour rings around main halos
      halos.forEach((halo) => {
        [0.8, 1.6, 2.5].forEach((mult) => {
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(halo.x, halo.y, halo.rScale * mult, 0, Math.PI * 2);
          ctx.stroke();
        });
      });
      ctx.setLineDash([]);
    }

    // ─── 2. Calculate Weak Lensing Shear & Render Galaxies ─────────
    const galaxies = galaxiesRef.current;

    galaxies.forEach((gal) => {
      // Sum shear contribution from all halos
      let gamma1 = 0;
      let gamma2 = 0;
      let kappa = 0;

      halos.forEach((halo) => {
        const dx = gal.x - halo.x;
        const dy = gal.y - halo.y;
        const distSq = dx * dx + dy * dy;
        const r = Math.sqrt(distSq);

        if (r > 4) {
          // Singular Isothermal Sphere (SIS) / NFW weak shear approximation:
          // gamma_t(r) = (4 * pi * G * M / c^2) * (D_ds / D_s) / r
          const lensingStrength = (halo.mass * 2.8 * (sourceRedshift / 2.0)) / (r + halo.rScale * 0.6);
          const phi = Math.atan2(dy, dx);

          // Tangential shear components: gamma1 = -gamma_t * cos(2 phi), gamma2 = -gamma_t * sin(2 phi)
          gamma1 += -lensingStrength * Math.cos(2 * phi) * 0.08;
          gamma2 += -lensingStrength * Math.sin(2 * phi) * 0.08;
          kappa += lensingStrength * 0.06;
        }
      });

      // Observed complex ellipticity e_obs = (e_int + g) / (1 + g* * e_int) ≈ e_int + 2 * gamma
      const obsE1 = gal.intrinsicE1 + 2 * gamma1;
      const obsE2 = gal.intrinsicE2 + 2 * gamma2;

      // Net observed modulus |e| and position angle theta
      const obsMod = Math.min(0.85, Math.sqrt(obsE1 * obsE1 + obsE2 * obsE2));
      const obsTheta = 0.5 * Math.atan2(obsE2, obsE1);

      // Major and minor axes of the sheared ellipse
      const a = gal.baseRadius * (1 + kappa) * Math.sqrt((1 + obsMod) / (1 - obsMod || 0.1));
      const b = gal.baseRadius * (1 + kappa) * Math.sqrt((1 - obsMod) / (1 + obsMod));

      // Draw the distorted background galaxy
      ctx.save();
      ctx.translate(gal.x, gal.y);
      ctx.rotate(obsTheta);

      ctx.fillStyle = gal.color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(1.5, a), Math.max(1.0, b), 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // ─── 3. Optional: Shear Tangential Sticks ─────────────────────
      if (showShearSticks) {
        const shearMag = Math.sqrt(gamma1 * gamma1 + gamma2 * gamma2);
        if (shearMag > 0.015) {
          const shearTheta = 0.5 * Math.atan2(gamma2, gamma1) + Math.PI / 2; // tangential direction
          const stickLen = Math.min(22, shearMag * 120 + 5);

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(
            gal.x - Math.cos(shearTheta) * (stickLen / 2),
            gal.y - Math.sin(shearTheta) * (stickLen / 2)
          );
          ctx.lineTo(
            gal.x + Math.cos(shearTheta) * (stickLen / 2),
            gal.y + Math.sin(shearTheta) * (stickLen / 2)
          );
          ctx.stroke();
        }
      }
    });

    // ─── 4. Annotations & HUD ──────────────────────────────────────
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('JWST COSMOS-Web 巡天微弱重力透鏡場 (0.54 deg² 視場尺度)', 16, 20);

    if (showMassMap) {
      ctx.fillStyle = '#c084fc';
      ctx.fillText('● 凱瑟-斯奎爾斯 (Kaiser-Squires) 反演暗物質投影面密度 κ(θ)', 16, h - 12);
    }
  }, [scenario, darkMatterMass, showMassMap, showShearSticks, sourceRedshift, halos]);

  // Quantitative Metrics
  const peakConvergenceKappa = useMemo(() => {
    return (darkMatterMass * 0.042 * (sourceRedshift / 2.0)).toFixed(3);
  }, [darkMatterMass, sourceRedshift]);

  const meanShearPercent = useMemo(() => {
    return (darkMatterMass * 0.38).toFixed(1);
  }, [darkMatterMass]);

  return (
    <div className="my-8 rounded-2xl border border-mirari-line bg-white shadow-sm overflow-hidden font-sans">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 border-b border-mirari-line bg-mirari-surfaceAlt/30 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs uppercase tracking-wider font-semibold text-purple-700 font-mono">
              Nature Astronomy · 2026 前沿研究解讀模型
            </span>
          </div>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-mirari-ink mt-1">
            韋伯望遠鏡微弱重力透鏡：宇宙剪切形變與暗物質質量圖反演
          </h3>
          <p className="text-xs text-mirari-muted mt-0.5">
            從 80 萬個背景星系微小切向橢圓化（Cosmic Shear），數學反演宇宙無形骨骼與暗物質絲狀網
          </p>
        </div>

        {/* Scenario Switcher */}
        <div className="flex rounded-xl p-1 bg-mirari-paper border border-mirari-line text-xs font-medium">
          <button
            type="button"
            onClick={() => handleScenarioChange('massive_cluster')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              scenario === 'massive_cluster'
                ? 'bg-purple-600 text-white font-semibold shadow-xs'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            巨大星系團暈 (Cluster Core)
          </button>
          <button
            type="button"
            onClick={() => handleScenarioChange('cosmic_filament')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              scenario === 'cosmic_filament'
                ? 'bg-mirari-ink text-white font-semibold shadow-xs'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            宇宙網絲狀結構 (Filament & Void)
          </button>
          <button
            type="button"
            onClick={() => handleScenarioChange('baryon_only')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              scenario === 'baryon_only'
                ? 'bg-slate-700 text-white font-semibold shadow-xs'
                : 'text-mirari-muted hover:text-mirari-ink'
            }`}
          >
            純可見重子物質 (無暗物質對照)
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* ─── Main Viewport Canvas ───────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-mirari-ink">
              NIRCam 深空背景星系場、引力剪切向量與反演暗物質分佈
            </span>
            <span className="text-xs text-mirari-dim font-mono">
              紅移景深 z ≈ {sourceRedshift.toFixed(1)} | 覆蓋天區 ~0.54 deg²
            </span>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 shadow-inner bg-slate-950">
            <canvas ref={canvasRef} width={640} height={260} className="w-full h-[240px] block" />
          </div>
        </div>

        {/* ─── Control Knobs & Layer Toggles ──────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-mirari-line bg-mirari-paper/40">
          {/* Dark Matter Halo Mass */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">暗物質團總質量 (M_DM)</span>
              <span className="font-mono text-purple-700 font-bold">{darkMatterMass.toFixed(1)} × 10¹⁴ M☉</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="25.0"
              step="0.5"
              value={darkMatterMass}
              onChange={(e) => setDarkMatterMass(parseFloat(e.target.value))}
              className="w-full accent-purple-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>貧星系群暈</span>
              <span>富星系團超重暈</span>
            </div>
          </div>

          {/* Source Galaxies Redshift */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">背景星系平均紅移 (z_s)</span>
              <span className="font-mono text-blue-700 font-bold">z = {sourceRedshift.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="3.5"
              step="0.1"
              value={sourceRedshift}
              onChange={(e) => setSourceRedshift(parseFloat(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>近景背景 (z=1.0)</span>
              <span>深空宇宙邊緣 (z=3.5)</span>
            </div>
          </div>

          {/* Mass Map Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-mirari-ink block">Kaiser-Squires 反演熱圖</label>
            <button
              type="button"
              onClick={() => setShowMassMap((prev) => !prev)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                showMassMap
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white border border-mirari-line text-mirari-muted hover:text-mirari-ink'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showMassMap ? 'bg-white' : 'bg-slate-400'}`} />
              <span>{showMassMap ? '✓ 顯示暗物質反演層' : '隱藏質量反演圖'}</span>
            </button>
          </div>

          {/* Shear Vectors Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-mirari-ink block">切向剪切向量棒 (Shear Sticks)</label>
            <button
              type="button"
              onClick={() => setShowShearSticks((prev) => !prev)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                showShearSticks
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white border border-mirari-line text-mirari-muted hover:text-mirari-ink'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showShearSticks ? 'bg-white' : 'bg-slate-400'}`} />
              <span>{showShearSticks ? '✓ 標註引力切向棒' : '僅觀測真實星系'}</span>
            </button>
          </div>
        </div>

        {/* ─── Astrometric Metrics Cards ──────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-mirari-line bg-mirari-paper/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-mirari-dim block">透鏡中心峰值會聚度 (Convergence κ)</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-mono text-2xl font-bold text-purple-700">
                {peakConvergenceKappa}
              </span>
            </div>
            <span className="text-[11px] text-mirari-muted block leading-tight font-mono">
              κ = Σ / Σ_crit · 投影面密度與宇宙臨界重力密度之比
            </span>
          </div>

          <div className="p-4 rounded-xl border border-mirari-line bg-mirari-paper/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-mirari-dim block">平均引力切向剪切變形率 (γ_t)</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-mono text-2xl font-bold text-sky-700">
                {meanShearPercent}%
              </span>
            </div>
            <span className="text-[11px] text-mirari-muted block leading-tight font-mono">
              統計平均星系切向拉伸率（遠低於個體形狀固有噪聲 ~25%）
            </span>
          </div>

          <div className="p-4 rounded-xl border border-mirari-line bg-mirari-paper/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-mirari-dim block">冷暗物質 (ΛCDM) 宇宙學檢驗</span>
            <span className="text-xs font-bold text-emerald-700 block mt-1">
              ✓ 觀測星系團與暗物質幾何完全吻合
            </span>
            <span className="text-[11px] text-mirari-muted block leading-tight font-mono">
              宇宙骨骼：可見星系聚集於暗物質深勢阱底部
            </span>
          </div>
        </div>

        {/* ─── Scientific Caveat Box ──────────────────────────────── */}
        <div className="rounded-xl p-4 bg-purple-500/10 border border-purple-500/20 text-xs text-purple-900 space-y-1">
          <div className="flex items-center space-x-1.5 font-bold">
            <svg className="w-4 h-4 text-purple-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span>科學邊界與觀測原理說明：統計平均 vs 單一星系直接成像</span>
          </div>
          <p className="leading-relaxed text-purple-800">
            微弱重力透鏡（Weak Lensing）並不像強透鏡那樣能直接看見肉眼可辨的巨大愛因斯坦環；單一星系自身的固有橢圓率隨機噪聲（$\sigma_e \approx 0.25$）遠大於微弱引力剪切信號（通常僅 1% 至 3%）。天文學家必須在數十萬乃至數百萬個背景星系上進行精密角對稱統計平均，利用傅立葉空間凱瑟-斯奎爾斯反演，方能洗去形狀噪聲、精確還原暗物質在宇宙三維空間中的無形骨架。
          </p>
        </div>
      </div>
    </div>
  );
};
