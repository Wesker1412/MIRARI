import React, { useState, useEffect, useRef, useMemo } from 'react';

interface GasParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  species: 'CO2' | 'H2O' | 'N2';
  boundSite: number | null;
}

const AMINE_SITES = [
  { x: 75, y: 82 },
  { x: 145, y: 82 },
  { x: 215, y: 82 },
  { x: 285, y: 82 },
  { x: 110, y: 274 },
  { x: 180, y: 274 },
  { x: 250, y: 274 },
  { x: 320, y: 274 },
];

export const MofAdsorptionSimulator: React.FC = () => {
  const [temperatureC, setTemperatureC] = useState<number>(25); // 溫度 (°C): 20..85
  const [humidityPct, setHumidityPct] = useState<number>(50); // 相對濕度 (%): 0..80
  const [enthalpyAbs, setEnthalpyAbs] = useState<number>(62); // 結合焓 |ΔH| (kJ/mol): 45..85
  const [isAnimating, setIsAnimating] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<GasParticle[]>([]);

  // 競爭朗繆爾吸附與水氣協同熱力學計算 (對齊 COF-999 400 ppm 基準)
  const thermo = useMemo(() => {
    const R = 8.314e-3; // kJ/(mol·K)
    const T_K = temperatureC + 273.15;
    const T_ref = 298.15; // 25 °C
    const pCO2 = 0.0004; // 400 ppm ≈ 0.0004 bar

    // 參考結合焓 62 kJ/mol 下，25 °C 處具高親和力 K_ref * p ≈ 18
    // 依據凡特霍夫方程式 (van 't Hoff): K(T) = K_ref * exp[(|ΔH|/R) * (1/T - 1/T_ref)]
    const dH_eff = enthalpyAbs;
    const deltaS_term = Math.exp((dH_eff - 62) / (R * T_ref)); // 結合強度隨 |ΔH| 偏移
    const vanTHoff = Math.exp((dH_eff / R) * (1 / T_K - 1 / T_ref));
    const Kp_CO2 = 16.5 * deltaS_term * vanTHoff;

    // 競爭吸附中的 N2 (0.78 bar，純物理弱吸附 |ΔH_N2| ≈ 14 kJ/mol，K_N2 * p_N2 極小)
    const Kp_N2 = 0.025 * Math.exp((14 / R) * (1 / T_K - 1 / T_ref));

    // 在 COF-999 中，H2O 不僅競爭微弱物理位點，反而協同促進胺基甲酸酯轉為碳酸氫鹽路徑
    // 0% RH 化學計量上限 ~ 1.02 mmol/g (實測 0.96); 50% RH 提升至 ~ 2.18 mmol/g (實測 2.05)
    const rhFrac = humidityPct / 100;
    const waterSynergyFactor = 1.0 + 1.14 * (1 - Math.exp(-3.4 * rhFrac));
    const qMaxDry = 1.02; // mmol/g
    const qMaxEffective = qMaxDry * waterSynergyFactor;

    // 朗繆爾表面覆蓋率 θ_CO2 = Kp_CO2 / (1 + Kp_CO2 + Kp_N2)
    const thetaCO2 = Kp_CO2 / (1 + Kp_CO2 + Kp_N2);
    const eqCapacity = qMaxEffective * thetaCO2;

    // 半飽和時間 t_1/2 (min): 25 °C 基準約 18.8 min；高溫擴散略加速但脫附主導
    const diffFactor = Math.sqrt(T_K / T_ref);
    const tHalfMin = 18.8 / (diffFactor * (0.85 + 0.15 * rhFrac));

    // 熱力學判定狀態
    let regimeLabel = '高效開放空氣捕捉態';
    let regimeColor = 'text-emerald-400';
    if (temperatureC >= 55 && thetaCO2 < 0.45) {
      regimeLabel = '低溫熱再生脫附態 (CO₂ 釋放)';
      regimeColor = 'text-amber-400';
    } else if (thetaCO2 < 0.35) {
      regimeLabel = '低親和力脫附區 (結合過弱或高溫)';
      regimeColor = 'text-rose-400';
    } else if (temperatureC >= 55 && thetaCO2 >= 0.65) {
      regimeLabel = '結合過強鎖死 (60°C 難以再生)';
      regimeColor = 'text-purple-400';
    }

    // 生成 0..60 分鐘動力學曲線 (擬一階-朗繆爾動力學)
    const curve: { tMin: number; q: number }[] = [];
    const kRate = Math.LN2 / tHalfMin;
    for (let t = 0; t <= 60; t += 1.5) {
      curve.push({
        tMin: t,
        q: eqCapacity * (1 - Math.exp(-kRate * t)),
      });
    }

    return {
      thetaCO2,
      eqCapacity,
      tHalfMin,
      waterSynergyFactor,
      regimeLabel,
      regimeColor,
      curve,
      selectivity: Kp_CO2 / Math.max(1e-6, (Kp_N2 / 0.78) * pCO2),
    };
  }, [temperatureC, humidityPct, enthalpyAbs]);

  // 初始化孔道氣體分子粒子
  useEffect(() => {
    const initial: GasParticle[] = [];
    for (let i = 0; i < 42; i++) {
      const r = i / 42;
      const species: GasParticle['species'] = r < 0.48 ? 'N2' : r < 0.8 ? 'CO2' : 'H2O';
      initial.push({
        x: 30 + ((i * 37) % 330),
        y: 105 + ((i * 53) % 145),
        vx: 0.7 + (i % 5) * 0.25,
        vy: ((i % 7) - 3) * 0.22,
        species,
        boundSite: null,
      });
    }
    particlesRef.current = initial;
  }, []);

  // 動畫步進與 Canvas 雙面板繪製
  useEffect(() => {
    let rafId = 0;

    const renderFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // 背景
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, w, h);

      // 更新粒子動態 (左面板孔道範圍 x: 24..376, y: 74..286)
      const speedScale = 0.65 + (temperatureC - 20) * 0.02;
      const targetBoundCount = Math.round(thermo.thetaCO2 * AMINE_SITES.length);
      const particles = particlesRef.current;

      if (isAnimating) {
        // 統計目前各站點佔用情況
        const siteOccupied = new Array(AMINE_SITES.length).fill(false);
        for (const p of particles) {
          if (p.boundSite !== null) {
            siteOccupied[p.boundSite] = true;
          }
        }
        let currentBound = siteOccupied.filter(Boolean).length;

        for (const p of particles) {
          if (p.boundSite !== null) {
            const site = AMINE_SITES[p.boundSite];
            // 熱振動
            p.x = site.x + (Math.random() - 0.5) * 2.4;
            p.y = site.y + (site.y < 180 ? 12 : -12) + (Math.random() - 0.5) * 2.4;
            // 若超出目標佔用率或高溫脫附，釋放粒子
            if (currentBound > targetBoundCount && Math.random() < 0.08) {
              siteOccupied[p.boundSite] = false;
              p.boundSite = null;
              p.vx = 1.1 * speedScale;
              p.vy = site.y < 180 ? 0.9 : -0.9;
              currentBound--;
            }
          } else {
            p.x += p.vx * speedScale;
            p.y += p.vy * speedScale;

            // 孔壁反彈
            if (p.y < 92) {
              p.y = 92;
              p.vy = Math.abs(p.vy);
            } else if (p.y > 264) {
              p.y = 264;
              p.vy = -Math.abs(p.vy);
            }
            // 週期性氣流入口
            if (p.x > 372) {
              p.x = 28;
              p.y = 104 + Math.random() * 148;
            }

            // CO2 嘗試與空閒胺基位點結合
            if (p.species === 'CO2' && currentBound < targetBoundCount) {
              for (let sIdx = 0; sIdx < AMINE_SITES.length; sIdx++) {
                if (!siteOccupied[sIdx]) {
                  const s = AMINE_SITES[sIdx];
                  const dx = p.x - s.x;
                  const dy = p.y - s.y;
                  if (dx * dx + dy * dy < 900) {
                    p.boundSite = sIdx;
                    siteOccupied[sIdx] = true;
                    currentBound++;
                    break;
                  }
                }
              }
            }
          }
        }
      }

      // ─── 左側面板：COF-999 烯烴共價骨架微孔通道示意圖 (x = 16..384) ───
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(16, 16, 368, 328);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(16, 16, 368, 328);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('COF-999 一維多胺奈米孔道微觀模擬', 28, 36);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText(
        humidityPct >= 20
          ? '水氣協同轉換為碳酸氫鹽 (1:1 高容量模式)'
          : '乾燥條件：雙胺結合形成胺基甲酸酯 (1:2 模式)',
        28,
        52
      );

      // 繪製上下烯烴鍵結骨架孔壁 (C=C 蜂巢輪廓)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(24, 62, 352, 20);
      ctx.fillRect(24, 274, 352, 20);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(24, 82);
      ctx.lineTo(376, 82);
      ctx.moveTo(24, 274);
      ctx.lineTo(376, 274);
      ctx.stroke();

      // 孔道流動氣流箭頭背景
      ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.fillRect(24, 82, 352, 192);
      ctx.fillStyle = '#334155';
      ctx.font = '11px monospace';
      ctx.fillText('400 ppm 開放空氣氣流 →', 34, 182);

      // 繪製胺基多胺鏈結合位點 (-NH2)
      AMINE_SITES.forEach((site) => {
        const isTop = site.y < 180;
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(site.x, site.y);
        ctx.lineTo(site.x, site.y + (isTop ? 10 : -10));
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(site.x, site.y + (isTop ? 12 : -12), 5, 0, Math.PI * 2);
        ctx.fill();
      });

      // 繪製氣體分子
      const showWaterCount = Math.round((humidityPct / 80) * 10);
      let waterDrawn = 0;
      for (const p of particles) {
        if (p.species === 'H2O') {
          if (waterDrawn >= showWaterCount) continue;
          waterDrawn++;
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.species === 'N2') {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // CO2 分子
          ctx.fillStyle = p.boundSite !== null ? '#fbbf24' : '#34d399';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.boundSite !== null ? 5.2 : 4.2, 0, Math.PI * 2);
          ctx.fill();
          if (p.boundSite !== null) {
            ctx.strokeStyle = '#fef3c7';
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }

      // 左面板底部圖例
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#34d399';
      ctx.fillText('● CO₂ (游離)', 28, 322);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('● CO₂ (已捕集)', 106, 322);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('● H₂O (協同水氣)', 198, 322);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('● N₂ (惰性穿過)', 294, 322);

      // ─── 右側面板：即時動力學吸附曲線 q(t) 與實驗基準對照 (x = 404..784) ───
      const rX = 404;
      const rW = 380;
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(rX, 16, rW, 328);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(rX, 16, rW, 328);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('400 ppm 開放空氣 CO₂ 動力學吸附容量曲線 q(t)', rX + 16, 36);

      const chartL = rX + 52;
      const chartR = rX + rW - 20;
      const chartT = 62;
      const chartB = 300;
      const chartW = chartR - chartL;
      const chartH = chartB - chartT;
      const qMaxAxis = 2.6; // mmol/g

      // 網格線
      ctx.font = '10px monospace';
      [0, 0.5, 1.0, 1.5, 2.0, 2.5].forEach((qVal) => {
        const py = chartB - (qVal / qMaxAxis) * chartH;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
        ctx.beginPath();
        ctx.moveTo(chartL, py);
        ctx.lineTo(chartR, py);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.fillText(qVal.toFixed(1), rX + 18, py + 3);
      });

      // 座標軸
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(chartL, chartT);
      ctx.lineTo(chartL, chartB);
      ctx.lineTo(chartR, chartB);
      ctx.stroke();

      // 標註 Nature 2024 實測基準線: 2.05 mmol/g (50% RH) 與 0.96 mmol/g (Dry)
      const drawBenchmark = (val: number, label: string, color: string) => {
        const py = chartB - (val / qMaxAxis) * chartH;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(chartL, py);
        ctx.lineTo(chartR, py);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.font = '10px sans-serif';
        ctx.fillText(label, chartL + 8, py - 4);
      };

      drawBenchmark(2.05, 'COF-999 實測 (50% RH): 2.05 mmol/g', 'rgba(56, 189, 248, 0.75)');
      drawBenchmark(0.96, 'COF-999 實測 (乾燥): 0.96 mmol/g', 'rgba(148, 163, 184, 0.7)');

      // 繪製當前條件吸附動力學曲線 q(t)
      ctx.strokeStyle = temperatureC >= 55 && thermo.thetaCO2 < 0.45 ? '#f59e0b' : '#34d399';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      thermo.curve.forEach((pt, idx) => {
        const px = chartL + (pt.tMin / 60) * chartW;
        const py = chartB - Math.min(qMaxAxis, pt.q) * (chartH / qMaxAxis);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // 標註半飽和時間 t_1/2 點
      const halfQ = thermo.eqCapacity * 0.5;
      const halfX = chartL + Math.min(1, thermo.tHalfMin / 60) * chartW;
      const halfY = chartB - Math.min(qMaxAxis, halfQ) * (chartH / qMaxAxis);
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(halfX, halfY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fda4af';
      ctx.font = '10px monospace';
      ctx.fillText(`t₁/₂ ≈ ${thermo.tHalfMin.toFixed(1)} min`, Math.min(chartR - 95, halfX + 6), halfY + 12);

      // 軸標籤
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText('mmol g⁻¹', rX + 12, chartT - 8);
      ctx.fillText('0 min', chartL, chartB + 16);
      ctx.fillText('30 min', chartL + chartW * 0.46, chartB + 16);
      ctx.fillText('60 min', chartR - 32, chartB + 16);
      ctx.fillText('吸附暴露時間 t (分鐘)', chartL + chartW * 0.3, chartB + 32);

      if (isAnimating) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [temperatureC, humidityPct, enthalpyAbs, thermo, isAnimating]);

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* 標題列與快捷情景預設 */}
      <div className="flex flex-col gap-3 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-100">
              COF-999 開放空氣碳捕捉：微孔競爭吸附與再生模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            模擬 400 ppm CO<sub>2</sub>、N<sub>2</sub> 與 H<sub>2</sub>O 在多胺修飾共價有機骨架內的競爭朗繆爾吸附與 60°C 低溫再生熱力學
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAnimating(!isAnimating)}
          className="self-start sm:self-auto rounded-lg bg-slate-800 border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
        >
          {isAnimating ? '⏸ 暫停分子動畫' : '▶ 啟動分子動畫'}
        </button>
      </div>

      {/* 三鍵切換情景 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setTemperatureC(25);
            setHumidityPct(0);
            setEnthalpyAbs(62);
          }}
          className={`flex-1 min-w-[110px] rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
            temperatureC === 25 && humidityPct === 0
              ? 'bg-sky-600 text-white'
              : 'border border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
          }`}
        >
          25°C 乾燥捕捉 (0% RH)
        </button>
        <button
          type="button"
          onClick={() => {
            setTemperatureC(25);
            setHumidityPct(50);
            setEnthalpyAbs(62);
          }}
          className={`flex-1 min-w-[110px] rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
            temperatureC === 25 && humidityPct === 50
              ? 'bg-emerald-600 text-white'
              : 'border border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
          }`}
        >
          25°C 潮濕捕捉 (50% RH)
        </button>
        <button
          type="button"
          onClick={() => {
            setTemperatureC(60);
            setHumidityPct(50);
            setEnthalpyAbs(62);
          }}
          className={`flex-1 min-w-[110px] rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
            temperatureC === 60
              ? 'bg-amber-600 text-white'
              : 'border border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
          }`}
        >
          60°C 低溫再生脫附
        </button>
      </div>

      {/* 畫布區域 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          className="w-full h-auto block rounded-lg"
        />
      </div>

      {/* 即時熱力學與動力學監控 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">平衡 CO<sub>2</sub> 吸附量</div>
          <div className="mt-1 font-mono text-base font-bold text-emerald-400">
            {thermo.eqCapacity.toFixed(2)} mmol/g
          </div>
          <div className="text-[10px] text-slate-500">
            水氣協同倍率 {thermo.waterSynergyFactor.toFixed(2)}×
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">胺基位點佔據率 θ</div>
          <div className="mt-1 font-mono text-base font-bold text-sky-400">
            {(thermo.thetaCO2 * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500">
            400 ppm 條件競爭覆蓋
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">半飽和時間 t<sub>1/2</sub></div>
          <div className="mt-1 font-mono text-base font-bold text-rose-300">
            {thermo.tHalfMin.toFixed(1)} min
          </div>
          <div className="text-[10px] text-slate-500">
            25°C 實測基準 18.8 min
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs text-slate-400">熱力學工作狀態</div>
          <div className={`mt-1 text-xs font-bold leading-snug ${thermo.regimeColor}`}>
            {thermo.regimeLabel}
          </div>
          <div className="text-[10px] text-slate-500">
            T = {temperatureC}°C | RH = {humidityPct}%
          </div>
        </div>
      </div>

      {/* 控制滑桿區 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">系統溫度 T</span>
            <span className="font-mono font-bold text-amber-400">{temperatureC} °C</span>
          </div>
          <input
            type="range"
            min={20}
            max={85}
            step={1}
            value={temperatureC}
            onChange={(e) => setTemperatureC(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>25°C (開放空氣捕捉)</span>
            <span>60°C (低溫再生)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">相對濕度 RH</span>
            <span className="font-mono font-bold text-sky-400">{humidityPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={80}
            step={5}
            value={humidityPct}
            onChange={(e) => setHumidityPct(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>0% (乾燥胺基甲酸酯)</span>
            <span>50–80% (碳酸氫鹽增效)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">結合焓 |ΔH|</span>
            <span className="font-mono font-bold text-emerald-400">{enthalpyAbs} kJ/mol</span>
          </div>
          <input
            type="range"
            min={45}
            max={85}
            step={1}
            value={enthalpyAbs}
            onChange={(e) => setEnthalpyAbs(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>45 (過弱難抓)</span>
            <span>62 (黃金區間)</span>
            <span>85 (過強難再生)</span>
          </div>
        </div>
      </div>

      {/* 科學機制說明 */}
      <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400 leading-relaxed">
        <strong className="text-slate-200">化學計量與再生熱力學權衡：</strong>
        水分子在多數多孔材料中會毒化金屬配位點，但在烯烴鍵結的 COF-999 中反而與胺基協同作用，讓每莫耳 CO<sub>2</sub> 所需的胺基數從 2 個降為 1 個，容量從 0.96 躍升至 2.05 mmol/g；同時適中的結合焓使材料只需加熱至 60°C 即可釋放純化氣體完成循環。
      </div>
    </div>
  );
};
