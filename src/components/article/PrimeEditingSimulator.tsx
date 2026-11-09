import React, { useState, useMemo, useEffect, useRef } from 'react';

export const PrimeEditingSimulator: React.FC = () => {
  const [pbsLength, setPbsLength] = useState<number>(13); // Primer Binding Site nt (typical 10-15)
  const [rtTemplateLength, setRtTemplateLength] = useState<number>(14); // RT template nt (typical 10-20)
  const [editorGeneration, setEditorGeneration] = useState<'PE2' | 'PE3' | 'PEmax_MLH1dn'>('PEmax_MLH1dn');
  const [editType, setEditType] = useState<'transversion' | 'insertion' | 'deletion'>('transversion');
  const [currentStep, setCurrentStep] = useState<number>(3); // 0: 識別, 1: 切口, 2: 逆轉錄, 3: 瓣狀平衡, 4: 整合

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 計算熱力學融解溫度 Tm 與退火親和力
  const pbsTm = 2 * (pbsLength * 0.5) + 4 * (pbsLength * 0.5); // 簡化 Wallace 經驗估算 (40-60°C)

  // 根據世代與參數估算編輯效率與純度
  const metrics = useMemo(() => {
    // 最佳 PBS 長度約在 12-14 nt
    const pbsPenalty = Math.abs(pbsLength - 13) * 3.5;
    // 最佳 RT 模板長度約在 12-16 nt
    const rtPenalty = Math.abs(rtTemplateLength - 14) * 2.8;

    let baseEff = 68 - pbsPenalty - rtPenalty;
    let baseIndel = 2.5;

    if (editorGeneration === 'PE2') {
      // 僅靠 pegRNA 轉錄，未經第二切口引導，效率較溫和 (15-30%)
      baseEff *= 0.45;
      baseIndel = 0.8;
    } else if (editorGeneration === 'PE3') {
      // 引入非編輯鏈切口 (sgRNA nicking)，效率提高 3-4 倍，但引發少許雙鏈斷裂 indel
      baseEff *= 1.15;
      baseIndel = 4.2;
    } else if (editorGeneration === 'PEmax_MLH1dn') {
      // 突變熱點優化酶 PEmax 結合顯性負性 MLH1dn 抑制細胞錯配修復 (MMR)
      baseEff *= 1.35;
      baseIndel = 1.6;
    }

    if (editType === 'insertion') {
      baseEff *= 0.85;
    } else if (editType === 'deletion') {
      baseEff *= 0.9;
    }

    const finalEfficiency = Math.max(5, Math.min(92, Math.round(baseEff)));
    const finalIndel = Math.max(0.2, Math.min(12, parseFloat(baseIndel.toFixed(1))));
    const editPurity = Math.round((finalEfficiency / (finalEfficiency + finalIndel)) * 100);

    return {
      efficiency: finalEfficiency,
      indelRate: finalIndel,
      purity: editPurity,
    };
  }, [pbsLength, rtTemplateLength, editorGeneration, editType]);

  const stepDescriptions = useMemo(() => [
    {
      title: '1. pegRNA 靶向識別與 DNA 解旋',
      desc: 'nCas9(H840A) 與 pegRNA 形成的核糖核蛋白複合體（RNP）掃描 PAM 序列 (NGG)，並在靶位點解旋形成 R-loop。',
    },
    {
      title: '2. 靶標鏈單鏈精確切口 (Nicking)',
      desc: 'nCas9 催化中心精準切割非互補鏈（PAM 鏈），產生游離的 3\'-羥基（3\'-OH）單鏈懸臂，完全避免有害的 DNA 雙鏈斷裂 (DSB)。',
    },
    {
      title: '3. 引物結合位點 (PBS) 退火與逆轉錄延伸',
      desc: '釋放的 3\'-OH 端單鏈 DNA 與 pegRNA 尾端的 PBS 雜交退火；隨後工程化逆轉錄酶以 pegRNA 的 RT 模板為藍本，原位直接合成含有預期編輯的新生 DNA 鏈。',
    },
    {
      title: '4. 3\' 編輯瓣與 5\' 未編輯瓣之熱力學競爭',
      desc: '新生合成的 3\' 單鏈瓣（含目標編輯）與原本的 5\' 單鏈瓣在 DNA 雙鏈修復中展開分子雜交競爭，細胞核酸內切酶（如 FEN1）優先切除 5\' 瓣。',
    },
    {
      title: '5. 錯配修復 (MMR) 繞過與遺傳密碼永久寫入',
      desc: 'DNA 連接酶封閉缺口；透過非編輯鏈輔助切口或短暫抑制 MLH1/MSH2 錯配修復，細胞以編輯鏈為模板進行複製，永久固定靶向編輯。',
    },
  ], []);

  // 繪製微觀 DNA 雙螺旋切口、退火雜交與能量平衡曲線
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark sleek background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    // Subtle background coordinate lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 35) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Top Section: DNA Double Strand & R-Loop / Nicking / RT Elongation
    const dnaTopY = 38;
    const dnaBottomY = 72;

    // Non-target strand (top, 5' -> 3')
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(25, dnaTopY);
    ctx.lineTo(w - 25, dnaTopY);
    ctx.stroke();

    // Target strand (bottom, 3' -> 5')
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(25, dnaBottomY);
    ctx.lineTo(w - 25, dnaBottomY);
    ctx.stroke();

    // Base pair rungs between strands
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1.5;
    for (let x = 35; x < w - 35; x += 14) {
      // If in R-loop region (x between 220 and 460), rungs are open/unzipped
      if (x >= 220 && x <= 460) continue;
      ctx.beginPath();
      ctx.moveTo(x, dnaTopY + 3);
      ctx.lineTo(x, dnaBottomY - 3);
      ctx.stroke();
    }

    // Nick position
    const nickX = 260;
    if (currentStep >= 1) {
      // Nick marker
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(nickX, dnaBottomY - 8);
      ctx.lineTo(nickX, dnaBottomY + 8);
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.font = '10px sans-serif';
      ctx.fillText('✁ 單鏈切口 (Nick)', nickX - 35, dnaBottomY + 22);
    }

    // pegRNA PBS Annealing & RT Extension (Step >= 2)
    const pbsPixelWidth = pbsLength * 8.5;
    const rtPixelWidth = rtTemplateLength * 8.5;

    if (currentStep >= 2) {
      // PBS binding segment (Sky blue)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(nickX, dnaBottomY + 8);
      ctx.lineTo(nickX - pbsPixelWidth, dnaBottomY + 8);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`PBS 退火 (${pbsLength} nt)`, nickX - pbsPixelWidth, dnaBottomY + 36);

      // RT Extended 3' Flap (Emerald)
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(nickX, dnaBottomY + 8);
      ctx.lineTo(nickX + rtPixelWidth, dnaBottomY + 8);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`RT 延伸鏈 (${rtTemplateLength} nt)`, nickX + 10, dnaBottomY + 36);

      // Edit point marker in the RT template
      const editMarkerX = nickX + Math.round(rtPixelWidth * 0.55);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(editMarkerX, dnaBottomY + 8, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('目標編輯位點', editMarkerX - 25, dnaBottomY - 14);
    }

    // Bottom Section: Thermodynamic Energy Landscape & Flap Equilibrium
    const plotY0 = 165;

    // Horizontal baseline
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, plotY0);
    ctx.lineTo(w - 40, plotY0);
    ctx.stroke();

    // Axis label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('自由能平衡曲線 ΔG (kcal/mol) 與瓣狀置換熱力學路徑', 45, 116);

    // Energy curve
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 40; px <= w - 40; px++) {
      const normX = (px - 40) / (w - 80);
      const barrier = Math.exp(-Math.pow((normX - 0.45) * 6, 2)) * 18;
      const well = -Math.sin(normX * Math.PI) * 12 - (currentStep >= 3 ? normX * 15 : 0);
      const py = plotY0 - (barrier + well);
      if (px === 40) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Step state label
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`當前進程: ${stepDescriptions[currentStep].title}`, 45, h - 14);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`效率: ${metrics.efficiency}% | 純度: ${metrics.purity}% | Indel: ${metrics.indelRate}%`, w - 280, h - 14);

  }, [pbsLength, rtTemplateLength, editorGeneration, editType, currentStep, metrics, pbsTm, stepDescriptions]);

  return (
    <div className="my-8 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-md">
      {/* 頂部標題 */}
      <div className="flex flex-col gap-2 border-b border-slate-700/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-lg font-bold tracking-wide text-slate-100">
              Prime Editing（引導編輯）分子搜索替換反應模擬器
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            解構 nCas9 缺口酶與工程化逆轉錄酶的無 DSB 遺傳密碼精準拼寫機理
          </p>
        </div>

        {/* 步驟進程切換 */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-1">
          {[0, 1, 2, 3, 4].map((step) => (
            <button
              key={step}
              onClick={() => setCurrentStep(step)}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                currentStep === step
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              步驟 {step + 1}
            </button>
          ))}
        </div>
      </div>

      {/* 分子機制示意圖展示 */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
        <div className="text-xs font-semibold text-emerald-400">
          {stepDescriptions[currentStep].title}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          {stepDescriptions[currentStep].desc}
        </p>

        {/* 互動式分子動畫結構視圖 */}
        <div className="relative mt-4 flex h-48 w-full flex-col items-center justify-center rounded-lg border border-slate-800/80 bg-slate-900/60 p-3 overflow-hidden">
          {/* DNA 雙鏈幾何軸線 */}
          <div className="relative w-full max-w-lg">
            {/* 上鏈 5' -> 3' */}
            <div className="flex h-5 w-full items-center justify-between border-b-2 border-slate-600 px-4 font-mono text-[11px] text-slate-400">
              <span>5&apos;-... C T G A T G C</span>
              <span className="font-bold text-sky-400">A G T C C A A G C</span>
              <span>G T C A A ...-3&apos;</span>
            </div>

            {/* 下鏈 (靶標鏈) */}
            <div className="flex h-5 w-full items-center justify-between border-t-2 border-slate-600 px-4 font-mono text-[11px] text-slate-400">
              <span>3&apos;-... G A C T A C G</span>
              <span className="font-bold text-slate-500">
                {currentStep >= 1 ? (
                  <span className="text-rose-400">T C A ✁ G G T T C G</span>
                ) : (
                  'T C A G G T T C G'
                )}
              </span>
              <span>C A G T T ...-5&apos;</span>
            </div>

            {/* pegRNA 與 逆轉錄酶複合體動態懸浮層 */}
            {currentStep >= 1 && (
              <div className="mt-2 flex flex-col items-center">
                {/* pegRNA 結構 */}
                <div className="flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-950/40 px-3 py-1 text-[11px] font-mono text-emerald-300 shadow-lg">
                  <span className="text-emerald-400">🧬</span>
                  <span className="text-slate-400">pegRNA 尾端:</span>
                  <span className="rounded bg-sky-900/40 px-1 text-sky-300" title="PBS 引物結合位點">
                    PBS ({pbsLength} nt, Tm ≈ {pbsTm}°C)
                  </span>
                  <span>-</span>
                  <span className="rounded bg-emerald-900/50 px-1 font-bold text-emerald-200" title="RT 模板">
                    RT 模板 ({rtTemplateLength} nt) [
                    <span className="text-amber-400 underline decoration-wavy">
                      {editType === 'transversion' ? 'A→T 點突變' : editType === 'insertion' ? '+3 nt 插入' : 'Δ3 nt 缺失'}
                    </span>
                    ]
                  </span>
                </div>

                {/* 逆轉錄酶原位合成提示 */}
                {currentStep >= 2 && (
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-emerald-400 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>M-MLV 逆轉錄酶原位合成 3&apos; 編輯瓣中...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 系統微狀態標籤 */}
          <div className="absolute bottom-2 right-3 flex items-center gap-2 text-[10px] text-slate-500">
            <span>nCas9 活性狀態: {currentStep >= 1 ? '已切出單鏈切口 (Nick)' : '靶標掃描中'}</span>
            <span>•</span>
            <span>MMR 錯配修復: {editorGeneration === 'PEmax_MLH1dn' ? '已抑制 (MLH1dn)' : '活躍 (天然清除)'}</span>
          </div>
        </div>

        {/* 雙鏈切口、退火雜交與能量平衡 Canvas */}
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950 p-2">
          <canvas
            ref={canvasRef}
            width={720}
            height={200}
            className="h-48 w-full object-contain sm:h-52"
          />
        </div>
      </div>

      {/* 核心實時編輯效能指標 */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>✅ 精確編輯效率 (Editing %)</span>
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-300">
            {metrics.efficiency}%
          </div>
          <div className="text-[10px] text-slate-500">
            {metrics.efficiency > 50 ? '極高精準置換率' : '中等編輯活性'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>⚠️ 副產物插入/缺失 (Indel %)</span>
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-rose-300">
            {metrics.indelRate}%
          </div>
          <div className="text-[10px] text-slate-500">
            {metrics.indelRate < 2 ? '低副產物安全區間' : '微量雙鏈切口誘發'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>🧬 編輯純度比 (Purity)</span>
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-sky-300">
            {metrics.purity}%
          </div>
          <div className="text-[10px] text-slate-500">
            精確產物 / (精確產物 + 副產物)
          </div>
        </div>
      </div>

      {/* 參數控制盤 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* 引導編輯器版本選擇 */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <label className="text-xs font-semibold text-slate-300">引導編輯器世代架構</label>
          <div className="mt-2 space-y-1.5">
            {[
              { id: 'PE2', label: 'PE2 (基礎工程化 RT)' },
              { id: 'PE3', label: 'PE3 (+ 非編輯鏈切口 sgRNA)' },
              { id: 'PEmax_MLH1dn', label: 'PEmax + MLH1dn (MMR 抑制)' },
            ].map((gen) => (
              <button
                key={gen.id}
                onClick={() => setEditorGeneration(gen.id as any)}
                className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                  editorGeneration === gen.id
                    ? 'border border-emerald-500/60 bg-emerald-950/40 font-semibold text-emerald-200'
                    : 'border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {gen.label}
              </button>
            ))}
          </div>
        </div>

        {/* 目標突變型態 */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <label className="text-xs font-semibold text-slate-300">目標遺傳編輯類型</label>
          <div className="mt-2 space-y-1.5">
            {[
              { id: 'transversion', label: '顛換點突變 (A·T ➔ C·G / T·A)' },
              { id: 'insertion', label: '微小片段精準插入 (+3 至 15 bp)' },
              { id: 'deletion', label: '靶向精確缺失 (Δ3 至 20 bp)' },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setEditType(type.id as any)}
                className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                  editType === type.id
                    ? 'border border-sky-500/60 bg-sky-950/40 font-semibold text-sky-200'
                    : 'border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* pegRNA PBS 與 RT 長度微調 */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">PBS 長度: {pbsLength} nt</span>
              <span className="text-[10px] text-slate-500">Tm ≈ {pbsTm}°C</span>
            </div>
            <input
              type="range"
              min={9}
              max={17}
              step={1}
              value={pbsLength}
              onChange={(e) => setPbsLength(parseInt(e.target.value, 10))}
              className="mt-1 w-full accent-emerald-500"
            />
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">RT 模板長度: {rtTemplateLength} nt</span>
              <span className="text-[10px] text-slate-500">最優 10-16 nt</span>
            </div>
            <input
              type="range"
              min={10}
              max={22}
              step={1}
              value={rtTemplateLength}
              onChange={(e) => setRtTemplateLength(parseInt(e.target.value, 10))}
              className="mt-1 w-full accent-sky-500"
            />
          </div>
        </div>
      </div>

      {/* 原理提示欄 */}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400">
        <span className="mt-0.5 text-emerald-400">❓</span>
        <p className="leading-relaxed">
          <strong className="text-slate-200">搜索與替換（Search-and-Replace）革命：</strong>
          傳統 CRISPR-Cas9 仰賴暴力切斷雙鏈（DSB），再透過隨機的非同源末端連接（NHEJ）造成混亂的副產物。Prime Editing 透過 nCas9 缺口酶與逆轉錄酶的精巧串聯，以 pegRNA 為單一嚮導和模板，直接在活細胞基因組中「複製貼上」精確鹼基。2021 年 Cell 論文更證實，阻斷細胞內部的錯配修復系統（MMR），能使原本會被細胞自動修復覆蓋掉的編輯產物大幅提高 2 至 5 倍，開啟了無副反應治療單基因遺傳疾病的全新維度。
        </p>
      </div>
    </div>
  );
};
