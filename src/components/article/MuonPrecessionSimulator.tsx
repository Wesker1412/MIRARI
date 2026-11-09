import React, { useState, useEffect, useRef, useMemo } from 'react';

export const MuonPrecessionSimulator: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [magneticFieldB, setMagneticFieldB] = useState<number>(1.45); // Tesla
  const [theoreticalModel, setTheoreticalModel] = useState<'experiment' | 'dispersive' | 'lattice_bmw'>('experiment');
  const [timeNs, setTimeNs] = useState<number>(0);
  const [decayEventsCount, setDecayEventsCount] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // 異常磁矩 a_mu = (g - 2) / 2 x 10^11
  // 實驗值 (Fermilab 2023): a_mu = 116592059 x 10^-11
  // 色散理論值 (White Paper 2020): a_mu = 116591810 x 10^-11 (差約 249 x 10^-11, ~5.1σ)
  // 格點 QCD (BMW 2021): a_mu = 116591954 x 10^-11 (差約 105 x 10^-11, 顯著縮小差異)
  const aMuValues = {
    experiment: 116592059,
    dispersive: 116591810,
    lattice_bmw: 116591954,
  };

  const selectedAmu = aMuValues[theoreticalModel];
  const deltaAmuPpm = ((selectedAmu - aMuValues.dispersive) / aMuValues.dispersive) * 1e6;

  // 進動差頻 omega_a = (e / m) * a_mu * B
  // 在 1.45 T 磁場下，omega_a 約為 1.43 MHz (週期約 4.37 微秒 = 4370 ns)
  const omegaA_MHz = (selectedAmu / 116592059) * (magneticFieldB / 1.45) * 1.437;
  const precessionPeriodNs = (1 / omegaA_MHz) * 1000;

  // 動態推進時間與粒子衰變
  useEffect(() => {
    if (!isPlaying) return;

    let lastTimestamp = performance.now();
    const updateLoop = (now: number) => {
      const deltaMs = now - lastTimestamp;
      lastTimestamp = now;

      setTimeNs((prev) => {
        const nextTime = (prev + deltaMs * 2.5) % 15000; // 0 ~ 15000 ns 循環
        return nextTime;
      });

      // 隨機累積正電子衰變探測事件
      if (Math.random() < 0.25) {
        setDecayEventsCount((c) => c + 1);
      }

      animFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animFrameRef.current = requestAnimationFrame(updateLoop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  // 繪製微觀進動環與正電子計數五參數調製波形
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // 1. 左側：儲存環切面與自旋向量進動示意 (X: 0 ~ width * 0.45)
    const ringCenterX = width * 0.22;
    const ringCenterY = height * 0.5;
    const ringRadius = Math.min(ringCenterX, ringCenterY) * 0.75;

    // 儲存環軌道背景
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(ringCenterX, ringCenterY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 磁場方向標示 (垂直紙面向內 ⊗)
    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    ctx.fillText('B 向量 (垂直紙面向內 ⊗)', ringCenterX - 70, ringCenterY - ringRadius - 15);

    // 迴旋運動相位與自旋相位
    const cyclotronFreq = 6.7; // MHz 軌道旋轉視覺頻率
    const orbitAngle = (timeNs / 1000) * cyclotronFreq * Math.PI * 2;
    const spinAngle = orbitAngle + ((timeNs / 1000) * omegaA_MHz * Math.PI * 2);

    const muonX = ringCenterX + Math.cos(orbitAngle) * ringRadius;
    const muonY = ringCenterY + Math.sin(orbitAngle) * ringRadius;

    // 繪製渺子 (μ+)
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(muonX, muonY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 渺子自旋箭頭 (Spin vector S)
    const arrowLength = 28;
    const spinEndX = muonX + Math.cos(spinAngle) * arrowLength;
    const spinEndY = muonY + Math.sin(spinAngle) * arrowLength;

    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(muonX, muonY);
    ctx.lineTo(spinEndX, spinEndY);
    ctx.stroke();

    // 箭頭頂端
    const headAngle = Math.atan2(spinEndY - muonY, spinEndX - muonX);
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(spinEndX, spinEndY);
    ctx.lineTo(
      spinEndX - 8 * Math.cos(headAngle - Math.PI / 6),
      spinEndY - 8 * Math.sin(headAngle - Math.PI / 6)
    );
    ctx.lineTo(
      spinEndX - 8 * Math.cos(headAngle + Math.PI / 6),
      spinEndY - 8 * Math.sin(headAngle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    // 標籤
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('自旋 S', spinEndX + 5, spinEndY + 5);

    // 2. 右側：五參數正電子計數探測調製譜 N(t) = N0 e^(-t/τ) [1 + A cos(ω_a t + φ)]
    const chartLeft = width * 0.48;
    const chartRight = width * 0.95;
    const chartTop = 35;
    const chartBottom = height - 40;
    const chartWidth = chartRight - chartLeft;
    const chartHeight = chartBottom - chartTop;

    // 坐標軸與網格
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = chartTop + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(chartLeft, chartTop);
    ctx.lineTo(chartLeft, chartBottom);
    ctx.lineTo(chartRight, chartBottom);
    ctx.stroke();

    // 坐標軸標籤
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText('探測正電子計數 N(t)', chartLeft - 5, chartTop - 12);
    ctx.fillText('時間 t (μs)', chartRight - 60, chartBottom + 25);
    ctx.fillText('0', chartLeft, chartBottom + 16);
    ctx.fillText('5', chartLeft + chartWidth / 3, chartBottom + 16);
    ctx.fillText('10', chartLeft + (chartWidth * 2) / 3, chartBottom + 16);
    ctx.fillText('15', chartRight - 10, chartBottom + 16);

    // 繪製調製曲線
    const tauMuonNs = 64400; // 渺子在 γ ≈ 29.3 下的擴張壽命 ~64.4 μs
    ctx.strokeStyle = theoreticalModel === 'experiment' ? '#38bdf8' : theoreticalModel === 'lattice_bmw' ? '#10b981' : '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const totalPlotNs = 15000;
    for (let xPix = 0; xPix <= chartWidth; xPix++) {
      const t = (xPix / chartWidth) * totalPlotNs;
      // 指數衰減包絡 * 調製振動
      const envelope = Math.exp(-t / tauMuonNs);
      const modulation = 1 + 0.38 * Math.cos((t / 1000) * omegaA_MHz * Math.PI * 2);
      const intensity = envelope * modulation;

      // 歸一化到圖表 Y 軸 (1.4 max, 0 min)
      const yPix = chartBottom - (intensity / 1.45) * chartHeight;
      if (xPix === 0) {
        ctx.moveTo(chartLeft + xPix, yPix);
      } else {
        ctx.lineTo(chartLeft + xPix, yPix);
      }
    }
    ctx.stroke();

    // 當前運行時間垂直指示游標
    const currentCursorX = chartLeft + (timeNs / totalPlotNs) * chartWidth;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(currentCursorX, chartTop);
    ctx.lineTo(currentCursorX, chartBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // 游標頂端當前計數點
    const curT = timeNs;
    const curEnv = Math.exp(-curT / tauMuonNs);
    const curMod = 1 + 0.38 * Math.cos((curT / 1000) * omegaA_MHz * Math.PI * 2);
    const curY = chartBottom - ((curEnv * curMod) / 1.45) * chartHeight;

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(currentCursorX, curY, 5, 0, Math.PI * 2);
    ctx.fill();

  }, [timeNs, omegaA_MHz, theoreticalModel]);

  const resetSimulation = () => {
    setTimeNs(0);
    setDecayEventsCount(0);
  };

  const modelLabels = useMemo(() => ({
    experiment: {
      name: 'Fermilab 實驗實測 (2023)',
      desc: 'FNAL 實測綜合值，精確度達 0.20 ppm，具備 5.1σ 顯著異常',
      color: 'text-sky-400 border-sky-500/50 bg-sky-950/20',
    },
    dispersive: {
      name: '色散理論預測 (WP 2020)',
      desc: '依賴 e+e- → 強子截面色散積分數據，預測值偏低，引發新物理猜想',
      color: 'text-amber-400 border-amber-500/50 bg-amber-950/20',
    },
    lattice_bmw: {
      name: '格點 QCD 理論 (BMW 2021/2024)',
      desc: '純超算第一性原理格點計算，HVP 強子真空極化偏大，大幅縮小理論偏差',
      color: 'text-emerald-400 border-emerald-500/50 bg-emerald-950/20',
    },
  }), []);

  return (
    <div className="my-8 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-md">
      {/* 標題與引導列 */}
      <div className="flex flex-col gap-2 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-sky-400 animate-pulse" />
            <h3 className="text-lg font-bold tracking-wide text-slate-100">
              Muon g-2 反常進動與量子真空虛粒子模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            即時解算狄拉克磁偶極矩異常 \(a_\mu = (g-2)/2\) 與反常進動頻率 \(\omega_a\)，對照實驗實測與格點 QCD
          </p>
        </div>

        {/* 控制按鈕 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500 active:scale-95"
            aria-label={isPlaying ? '暫停' : '播放'}
          >
            <span>{isPlaying ? '⏸ 暫停' : '▶ 繼續'}</span>
          </button>
          <button
            onClick={resetSimulation}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
            aria-label="重設"
          >
            <span>↺ 重設</span>
          </button>
        </div>
      </div>

      {/* 主畫布與動態可視化 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={320}
          className="h-64 w-full object-contain sm:h-72"
        />
      </div>

      {/* 核心實時參數指標 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>🧭 反常磁矩 \(a_\mu \times 10^{11}\)</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-sky-300">
            {selectedAmu.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500">
            {theoreticalModel === 'experiment' ? '實測精度 ±22 (0.2 ppm)' : theoreticalModel === 'lattice_bmw' ? '格點誤差 ±131' : '色散理論值'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>⚡ 進動差頻 \(\omega_a\)</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-emerald-300">
            {omegaA_MHz.toFixed(4)} MHz
          </div>
          <div className="text-[10px] text-slate-500">
            週期 \(T_a \approx {precessionPeriodNs.toFixed(0)}\) ns
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>🔬 相對色散理論偏離</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-amber-300">
            {deltaAmuPpm >= 0 ? `+${deltaAmuPpm.toFixed(2)}` : deltaAmuPpm.toFixed(2)} ppm
          </div>
          <div className="text-[10px] text-slate-500">
            {theoreticalModel === 'experiment' ? '5.1σ 統計顯著度' : theoreticalModel === 'lattice_bmw' ? '與實驗差異大幅緩解' : '基準模型 (0 ppm)'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>📊 累積衰變事件</span>
          </div>
          <div className="mt-1 font-mono text-base font-bold text-rose-300">
            {decayEventsCount.toLocaleString()} 次
          </div>
          <div className="text-[10px] text-slate-500">
            當前時間: {(timeNs / 1000).toFixed(2)} μs
          </div>
        </div>
      </div>

      {/* 理論模型切換 */}
      <div className="mt-4 space-y-2">
        <label className="text-xs font-semibold text-slate-300">
          選擇理論計算 / 實驗基準：
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['experiment', 'dispersive', 'lattice_bmw'] as const).map((m) => {
            const info = modelLabels[m];
            const isSelected = theoreticalModel === m;
            return (
              <button
                key={m}
                onClick={() => setTheoreticalModel(m)}
                className={`rounded-xl border p-2.5 text-left transition ${
                  isSelected
                    ? info.color
                    : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold">{info.name}</div>
                <div className="mt-1 text-[11px] leading-tight text-slate-400">{info.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 磁場強度滑桿 */}
      <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">環形偏轉超導磁場 \(B\)</span>
          <span className="font-mono font-bold text-sky-400">{magneticFieldB.toFixed(2)} Tesla</span>
        </div>
        <input
          type="range"
          min={1.0}
          max={2.0}
          step={0.05}
          value={magneticFieldB}
          onChange={(e) => setMagneticFieldB(parseFloat(e.target.value))}
          className="mt-2 w-full accent-sky-500"
        />
        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>1.0 T (低頻進動)</span>
          <span>1.45 T (Fermilab 實驗基準場強)</span>
          <span>2.0 T (高頻進動)</span>
        </div>
      </div>

      {/* 物理機制提示 */}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400">
        <span className="mt-0.5 text-sky-400">ℹ️</span>
        <p className="leading-relaxed">
          <strong className="text-slate-200">反常磁矩物理本質：</strong>
          狄拉克原本預言無自旋激發的理想輕子 \(g = 2\)。然而，量子場論中虛光子、虛輕子對以及強子真空極化（HVP）在真空中瞬間生成湮滅，構成了對磁偶極矩的微擾修正。Fermilab 透過觀測高能正電子沿自旋方向優先發射的弱作用宇稱不守恆特性，精確提取正弦調製頻率 \(\omega_a\)。若實測始終高於標準模型預測，暗示真空中潛藏著未知的超對稱粒子、暗光子或額外維度相互作用。
        </p>
      </div>
    </div>
  );
};
