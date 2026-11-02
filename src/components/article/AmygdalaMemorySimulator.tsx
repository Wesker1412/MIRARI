import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

type StimulusCategory = 'faces' | 'places' | 'objects';

interface NeuronModel {
  id: number;
  name: string;
  preferredCategory: StimulusCategory;
  baselineRate: number; // Hz (typically 2 - 5 Hz in human amygdala)
  tuningGain: number; // Hz increase on preferred stimulus
}

export const AmygdalaMemorySimulator: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<StimulusCategory>('faces');
  const [arousal, setArousal] = useState<number>(1.2); // 0.6x to 2.2x
  const [noiseLevel, setNoiseLevel] = useState<number>(0.2); // 0.05 to 0.5
  const [trialCount, setTrialCount] = useState<number>(1);
  const [trialSeed, setTrialSeed] = useState<number>(42);

  const rasterCanvasRef = useRef<HTMLCanvasElement>(null);

  // 12 Amygdala model neurons with diverse category preferences
  const neurons: NeuronModel[] = useMemo(
    () => [
      { id: 1, name: 'N1 (臉孔選擇性)', preferredCategory: 'faces', baselineRate: 3.2, tuningGain: 14.5 },
      { id: 2, name: 'N2 (臉孔選擇性)', preferredCategory: 'faces', baselineRate: 2.8, tuningGain: 18.0 },
      { id: 3, name: 'N3 (臉孔選擇性)', preferredCategory: 'faces', baselineRate: 4.1, tuningGain: 12.0 },
      { id: 4, name: 'N4 (臉孔/場景共調)', preferredCategory: 'faces', baselineRate: 3.5, tuningGain: 8.5 },
      { id: 5, name: 'N5 (場景選擇性)', preferredCategory: 'places', baselineRate: 2.5, tuningGain: 16.0 },
      { id: 6, name: 'N6 (場景選擇性)', preferredCategory: 'places', baselineRate: 3.0, tuningGain: 15.2 },
      { id: 7, name: 'N7 (場景選擇性)', preferredCategory: 'places', baselineRate: 3.8, tuningGain: 13.5 },
      { id: 8, name: 'N8 (廣泛反應型)', preferredCategory: 'places', baselineRate: 4.5, tuningGain: 6.0 },
      { id: 9, name: 'N9 (物件選擇性)', preferredCategory: 'objects', baselineRate: 2.2, tuningGain: 15.0 },
      { id: 10, name: 'N10 (物件選擇性)', preferredCategory: 'objects', baselineRate: 3.1, tuningGain: 17.5 },
      { id: 11, name: 'N11 (物件選擇性)', preferredCategory: 'objects', baselineRate: 2.9, tuningGain: 14.0 },
      { id: 12, name: 'N12 (非選擇性基準)', preferredCategory: 'objects', baselineRate: 3.6, tuningGain: 4.0 },
    ],
    []
  );

  // Compute firing rates for current stimulus
  const neuralResponses = useMemo(() => {
    // Deterministic pseudo-random based on trialSeed
    const pseudoRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    return neurons.map((n, idx) => {
      const isPreferred = n.preferredCategory === selectedCategory;
      const categoryDrive = isPreferred ? n.tuningGain : n.tuningGain * 0.15;
      const trialJitter = (pseudoRandom(trialSeed + idx * 13) - 0.5) * noiseLevel * 10;
      
      // Response rate elevated by emotional arousal
      const responseRate = Math.max(
        0.5,
        n.baselineRate + categoryDrive * arousal + trialJitter
      );
      
      const rateDelta = responseRate - n.baselineRate;
      return {
        ...n,
        responseRate,
        rateDelta,
        isPreferred,
      };
    });
  }, [neurons, selectedCategory, arousal, noiseLevel, trialSeed]);

  // Selective ensemble average response
  const selectiveNeurons = neuralResponses.filter((n) => n.isPreferred);
  const avgSelectiveDelta =
    selectiveNeurons.reduce((sum, n) => sum + n.rateDelta, 0) / (selectiveNeurons.length || 1);

  // Subsequent Memory Effect (SME) Logistic Prediction
  // P(Recall) = 1 / (1 + exp(-(beta0 + beta1 * avgDelta)))
  const beta0 = -1.6;
  const beta1 = 0.22;
  const logitScore = beta0 + beta1 * avgSelectiveDelta;
  const predictedRecallProb = Math.min(0.96, Math.max(0.08, 1 / (1 + Math.exp(-logitScore))));
  const isMemoryConsolidated = predictedRecallProb >= 0.55;

  const handleNextTrial = useCallback(() => {
    setTrialCount((prev) => prev + 1);
    setTrialSeed(Date.now() % 100000);
  }, []);

  // Draw Raster Plot & Firing Rate Bar
  useEffect(() => {
    const canvas = rasterCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background styling
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Draw baseline vs post-stimulus background split
    const stimOnsetX = w * 0.25; // 0 ms onset line
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(0, 0, stimOnsetX, h);
    ctx.fillStyle = 'rgba(184, 115, 51, 0.04)';
    ctx.fillRect(stimOnsetX, 0, w - stimOnsetX, h);

    // Onset dashed line
    ctx.strokeStyle = 'rgba(184, 115, 51, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(stimOnsetX, 0);
    ctx.lineTo(stimOnsetX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Text labels for timeline
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('-200 ms (基線)', 8, 14);
    ctx.fillText('0 ms (刺激出現)', stimOnsetX + 6, 14);
    ctx.fillText('+800 ms (編碼期)', w - 90, 14);

    // Draw spikes for each neuron
    const rowHeight = (h - 28) / neurons.length;
    
    // Deterministic spike generator
    const pseudoRand = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    neuralResponses.forEach((nr, rowIdx) => {
      const yMid = 26 + rowIdx * rowHeight + rowHeight / 2;

      // Row separator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yMid + rowHeight / 2);
      ctx.lineTo(w, yMid + rowHeight / 2);
      ctx.stroke();

      // Label neuron name
      ctx.fillStyle = nr.isPreferred ? '#f59e0b' : '#64748b';
      ctx.font = '9px sans-serif';
      ctx.fillText(nr.name.slice(0, 4), 6, yMid + 3);

      // Baseline spikes (-200 to 0ms)
      const baselineSpikeCount = Math.round(nr.baselineRate * 0.2 * 4);
      for (let s = 0; s < baselineSpikeCount; s++) {
        const tFrac = pseudoRand(trialSeed + rowIdx * 31 + s * 7);
        const sx = 34 + tFrac * (stimOnsetX - 40);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, yMid - rowHeight * 0.35);
        ctx.lineTo(sx, yMid + rowHeight * 0.35);
        ctx.stroke();
      }

      // Evoked post-stimulus spikes (0 to +800ms)
      const postSpikeCount = Math.round(nr.responseRate * 0.8 * 2.8);
      for (let s = 0; s < postSpikeCount; s++) {
        const tFrac = pseudoRand(trialSeed * 2 + rowIdx * 43 + s * 17);
        // Gamma distribution-like onset clustering around 150-400ms
        const clusteredT = Math.pow(tFrac, 0.85);
        const sx = stimOnsetX + 4 + clusteredT * (w - stimOnsetX - 12);
        
        ctx.strokeStyle = nr.isPreferred ? '#fbbf24' : '#38bdf8';
        ctx.lineWidth = nr.isPreferred ? 2 : 1.2;
        ctx.beginPath();
        ctx.moveTo(sx, yMid - rowHeight * 0.38);
        ctx.lineTo(sx, yMid + rowHeight * 0.38);
        ctx.stroke();
      }
    });
  }, [neuralResponses, trialSeed, neurons.length]);

  return (
    <div className="my-8 rounded-2xl border border-mirari-line bg-white shadow-sm overflow-hidden font-sans">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 border-b border-mirari-line bg-mirari-surfaceAlt/30 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs uppercase tracking-wider font-semibold text-mirari-amber font-mono">
              Nature Neuroscience · 2026 研究解讀模型
            </span>
          </div>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-mirari-ink mt-1">
            人腦杏仁核單神經元：刺激選擇性發火與情節記憶編碼示範
          </h3>
          <p className="text-xs text-mirari-muted mt-0.5">
            呈現特定類別刺激、杏仁核神經元發火率升高與後續記憶回憶成功率之統計對應
          </p>
        </div>

        <button
          type="button"
          onClick={handleNextTrial}
          className="px-3.5 py-1.5 rounded-xl bg-mirari-ink text-white hover:bg-black text-xs font-medium transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>施加新刺激 (Trial #{trialCount})</span>
        </button>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* ─── Control Panel ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-mirari-line bg-mirari-paper/50">
          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-mirari-ink block">
              呈現刺激類別 (Stimulus Category)
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ['faces', '臉孔人物'],
                  ['places', '自然場景'],
                  ['objects', '人造物件'],
                ] as const
              ).map(([cat, label]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    handleNextTrial();
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white border border-mirari-line text-mirari-muted hover:text-mirari-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Emotional Arousal */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">情緒喚醒度 (Arousal Factor)</span>
              <span className="font-mono text-mirari-amber font-bold">{arousal.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="2.2"
              step="0.1"
              value={arousal}
              onChange={(e) => setArousal(parseFloat(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>低 (0.6x)</span>
              <span>中性 (1.0x)</span>
              <span>高強烈 (2.2x)</span>
            </div>
          </div>

          {/* Background Noise */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-mirari-ink">神經背景噪聲</span>
              <span className="font-mono text-mirari-dim">{Math.round(noiseLevel * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.45"
              step="0.05"
              value={noiseLevel}
              onChange={(e) => setNoiseLevel(parseFloat(e.target.value))}
              className="w-full accent-slate-700 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mirari-dim font-mono">
              <span>穩定放電</span>
              <span>生理隨機擾動</span>
            </div>
          </div>
        </div>

        {/* ─── Neural Raster Canvas View ──────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-mirari-ink">
              12 個單一神經元脈衝發火序列 (Single-Unit Spike Raster Plot)
            </span>
            <div className="flex items-center space-x-3 text-[11px]">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
                <span className="text-mirari-muted">類別選擇性響應神經元</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" />
                <span className="text-mirari-muted">非選擇性基線神經元</span>
              </span>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 shadow-inner bg-slate-900">
            <canvas
              ref={rasterCanvasRef}
              width={640}
              height={260}
              className="w-full h-[220px] block"
            />
          </div>
        </div>

        {/* ─── Outcome Readout Dashboard ──────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Selective Delta */}
          <div className="p-4 rounded-xl border border-mirari-line bg-mirari-paper/30 space-y-1">
            <span className="text-[11px] text-mirari-dim font-mono block uppercase">
              選擇性神經群平均增率 (ΔF)
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-mono text-2xl font-bold text-amber-600">
                +{avgSelectiveDelta.toFixed(1)}
              </span>
              <span className="text-xs text-mirari-dim font-mono">Hz / neuron</span>
            </div>
            <p className="text-[11px] text-mirari-muted leading-tight">
              該類別偏好神經元在刺激呈現後發火率相較靜息基線的抬升幅度
            </p>
          </div>

          {/* Predicted Probability */}
          <div className="p-4 rounded-xl border border-mirari-line bg-mirari-paper/30 space-y-1">
            <span className="text-[11px] text-mirari-dim font-mono block uppercase">
              模型預測回憶成功幾率 P(Recall)
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-mono text-2xl font-bold text-mirari-ink">
                {(predictedRecallProb * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-mirari-dim font-mono">Logistic SME</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-300 ${
                  isMemoryConsolidated ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
                style={{ width: `${predictedRecallProb * 100}%` }}
              />
            </div>
          </div>

          {/* Consolidation Status */}
          <div
            className={`p-4 rounded-xl border space-y-1 transition ${
              isMemoryConsolidated
                ? 'border-emerald-300 bg-emerald-50/60'
                : 'border-slate-300 bg-slate-50'
            }`}
          >
            <span className="text-[11px] font-mono block uppercase text-mirari-dim">
              後續情節記憶狀態判定
            </span>
            <div className="flex items-center space-x-2">
              <span
                className={`w-3 h-3 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${
                  isMemoryConsolidated ? 'bg-emerald-600' : 'bg-slate-400'
                }`}
              >
                {isMemoryConsolidated ? '✓' : '×'}
              </span>
              <span
                className={`font-serif text-base font-bold ${
                  isMemoryConsolidated ? 'text-emerald-950' : 'text-slate-700'
                }`}
              >
                {isMemoryConsolidated ? '成功編碼並形成記憶' : '未達顯著鞏固閾值 (遺忘)'}
              </span>
            </div>
            <p className="text-[11px] text-mirari-muted leading-tight">
              {isMemoryConsolidated
                ? '選擇性族群強發火驅動海馬迴下游突觸鞏固信號'
                : '刺激引發發火量微弱，信號淹沒於神經背景噪聲中'}
            </p>
          </div>
        </div>

        {/* ─── Scientific Caveat Box ──────────────────────────────── */}
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-950 text-xs space-y-1.5">
          <div className="flex items-center space-x-1.5 font-semibold">
            <svg className="w-4 h-4 text-amber-700 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>科學查核與邊界限制說明</span>
          </div>
          <p className="leading-relaxed text-amber-900/90">
            本互動組件為基於 <em>Nature Neuroscience</em> 2026 原始論文（DOI: 10.1038/s41593-026-02493-9）之教學模型。論文實證建立於癲癇患者顱內微電極記錄，發現特定刺激引發的杏仁核發火率與後續記憶測試具有<strong>統計預測力（後續記憶效應，SME）</strong>。
            請注意：<strong>相關性並不等同於已證明的因果必然性</strong>；且本示範之羅吉斯回歸參數與脈衝點陣圖為教學啟發數值模型，非個別受試者之未經處理生理原始資料。
          </p>
        </div>
      </div>
    </div>
  );
};
