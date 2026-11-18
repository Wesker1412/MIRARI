import React, { useState, useMemo, useEffect, useRef } from 'react';

type RecombMode = 'insertion' | 'excision' | 'inversion';
type OrientationMode = 'direct' | 'inverted';

interface StageInfo {
  id: number;
  shortLabel: string;
  title: string;
  summary: string;
  structuralBadge: string;
}

const STAGES: StageInfo[] = [
  {
    id: 0,
    shortLabel: '1. 雙重捕獲',
    title: '階段 1｜雙二聚體 TBL / DBL 雙重捕獲（Synaptic Capture）',
    summary:
      '四個 IS621 重組酶單體組裝為雙二聚體突觸複合體：一對二聚體藉橋接 RNA 的目標結合環（TBL）配對目標 DNA，另一對二聚體藉供體結合環（DBL）抓握供體 DNA，跨二聚體界面尚未完全閉合。',
    structuralBadge: 'Cryo-EM 捕獲態：雙 DNA 同步就位',
  },
  {
    id: 1,
    shortLabel: '2. 頂端股切割',
    title: "階段 2｜複合 RuvC–Tnp 位點與 5'-磷酸絲胺酸共價切割",
    summary:
      "兩組二聚體對接完成後，跨界面組裝出複合 RuvC–Tnp 催化核心。催化性絲胺酸殘基對目標與供體 DNA 之頂端股發動親核攻擊，形成共價 5'-磷酸絲胺酸（5'-phosphoserine）中間體，將斷端牢牢鎖在蛋白口袋內而不暴露游離雙股斷裂。",
    structuralBadge: "共價鎖定：無游離 DSB 暴露",
  },
  {
    id: 2,
    shortLabel: '3. 霍利迪交叉',
    title: '階段 3｜頂端股互換再連接與霍利迪交叉（Holliday Junction）',
    summary:
      "受 5'-磷酸絲胺酸保護的頂端股 3'-OH 末端彼此跨越二聚體界面交換伴侶，透過轉酯反應完成頂端股無痕再連接，使目標 DNA 與供體 DNA 在交匯點形成四向互連的霍利迪交叉中間體。",
    structuralBadge: 'Cryo-EM 交叉態：四向鏈交換',
  },
  {
    id: 3,
    shortLabel: '4. 底端股解析',
    title: '階段 4｜底端股切割解析與無痕重組產物釋放',
    summary:
      '催化核心依序切開並交換兩條底端股，完成最後磷酸二酯鍵閉合並解離霍利迪交叉。整個循環無需宿主 NHEJ 或 HDR 修復機器介入，單一步驟即釋放完整的重組基因組產物。',
    structuralBadge: '重組完成：單步驟拓撲重寫',
  },
];

const TARGET_SEQ = 'G A T C A G T C T G';
const TARGET_COMP = 'C T A G T C A G A C';
const DONOR_SEQ = 'C G T A G A C T G A';
const DONOR_COMP = 'G C A T C T G A C T';

const MISMATCH_INDICES_TBL = [2, 5, 7, 3];
const MISMATCH_INDICES_DBL = [1, 4, 6, 8];

export const BridgeRnaRecombinaseSimulator: React.FC = () => {
  const [mode, setMode] = useState<RecombMode>('insertion');
  const [orientation, setOrientation] = useState<OrientationMode>('direct');
  const [tblMismatch, setTblMismatch] = useState<number>(0);
  const [dblMismatch, setDblMismatch] = useState<number>(0);
  const [stage, setStage] = useState<number>(2);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-advance reaction stages when playing
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setStage((prev) => (prev + 1) % STAGES.length);
    }, 1700);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const handleModeChange = (nextMode: RecombMode) => {
    setMode(nextMode);
    if (nextMode === 'excision') {
      setOrientation('direct');
    } else if (nextMode === 'inversion') {
      setOrientation('inverted');
    }
  };

  const handleOrientationChange = (nextOri: OrientationMode) => {
    setOrientation(nextOri);
    if (mode === 'excision' && nextOri === 'inverted') {
      setMode('inversion');
    } else if (mode === 'inversion' && nextOri === 'direct') {
      setMode('excision');
    }
  };

  // Thermodynamic & synaptic commitment model
  const thermo = useMemo(() => {
    const dgBasePerLoop = -11.5; // kcal/mol for ~10-11 bp cognate bridge RNA pairing
    const ddgMismatch = 3.4; // kcal/mol energetic penalty per nt mismatch
    const strainMap: Record<RecombMode, number> = {
      excision: 0.4,
      inversion: 0.9,
      insertion: 1.2,
    };
    const pMaxMap: Record<RecombMode, number> = {
      excision: 94,
      inversion: 89,
      insertion: 86,
    };

    const dgTbl = dgBasePerLoop + tblMismatch * ddgMismatch;
    const dgDbl = dgBasePerLoop + dblMismatch * ddgMismatch;
    const oriPenalty = mode === 'insertion' && orientation === 'inverted' ? 0.3 : 0;
    const dgStrain = strainMap[mode] + oriPenalty;
    const dgTotal = dgTbl + dgDbl + dgStrain;

    const dgThresh = -5.5;
    const rtEff = 1.2;
    const probTbl = 1 / (1 + Math.exp((dgTbl - dgThresh) / rtEff));
    const probDbl = 1 / (1 + Math.exp((dgDbl - dgThresh) / rtEff));
    const pRec = Math.max(0.5, Math.min(96, pMaxMap[mode] * probTbl * probDbl));

    // Synaptic commitment is compromised when either loop fails pairing gate
    const complexAssembled = pRec >= 25;

    let topologyOutcome = '';
    if (mode === 'insertion') {
      topologyOutcome =
        orientation === 'direct'
          ? '環狀供體正向嵌入目標基因組'
          : '環狀供體反向（180°）嵌入目標基因組';
    } else if (mode === 'excision') {
      topologyOutcome = '兩同向位點間 DNA 片段環出切除';
    } else {
      topologyOutcome = '兩反向位點間基因區段 180° 倒位翻轉';
    }

    return {
      dgTbl,
      dgDbl,
      dgTotal,
      probTbl,
      probDbl,
      pRec,
      complexAssembled,
      topologyOutcome,
    };
  }, [mode, orientation, tblMismatch, dblMismatch]);

  // Draw thermodynamic energy landscape + P_rec specificity curve on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 24; x < w; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 24; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // --- TOP PANEL: Reaction Free-Energy Coordinate (y: 18..155) ---
    const topPlotLeft = 42;
    const topPlotRight = w - 20;
    const topPlotTop = 28;
    const topPlotBottom = 148;
    const topW = topPlotRight - topPlotLeft;
    const baselineY = 82;

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('突觸反應自由能剖面 ΔG (kcal/mol) — 共價絲胺酸如何迴避游離 DSB 能障', 16, 17);

    // Baseline (ΔG = 0)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(topPlotLeft, baselineY);
    ctx.lineTo(topPlotRight, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.fillText('0', 22, baselineY + 3);
    ctx.fillText('+ΔG', 14, topPlotTop + 8);
    ctx.fillText('-ΔG', 14, topPlotBottom - 4);

    // Dashed crimson reference curve: Exposed Free DSB pathway barrier
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const u = i / 80;
      const px = topPlotLeft + u * topW;
      const dsbPeak = Math.exp(-Math.pow((u - 0.48) * 5.2, 2)) * 46;
      const py = baselineY - dsbPeak;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(251, 113, 133, 0.85)';
    ctx.font = '10px sans-serif';
    ctx.fillText('游離 DSB 暴露態（高能不穩定）', topPlotLeft + topW * 0.31, topPlotTop + 10);

    // Solid curve: Bridge RNA covalent 5'-phosphoserine pathway
    // Depth of capture well depends on |dgTotal|
    const stabilityScale = Math.max(0.15, Math.min(1.15, -thermo.dgTotal / 22));
    const energyAtU = (u: number): number => {
      // u=0: free substrates; u=0.22: capture well; u=0.45: Ser covalent intermediate; u=0.68: Holliday junction; u=0.95: product
      const captureWell = -34 * stabilityScale * Math.exp(-Math.pow((u - 0.22) * 5.0, 2));
      const serBarrier = (14 + (1 - stabilityScale) * 26) * Math.exp(-Math.pow((u - 0.36) * 7.5, 2));
      const serWell = -26 * stabilityScale * Math.exp(-Math.pow((u - 0.48) * 6.0, 2));
      const hjBarrier = (12 + (1 - stabilityScale) * 20) * Math.exp(-Math.pow((u - 0.62) * 7.5, 2));
      const hjWell = -28 * stabilityScale * Math.exp(-Math.pow((u - 0.72) * 6.0, 2));
      const productShift = thermo.complexAssembled ? -22 * u * u : 6 * u;
      return baselineY - (captureWell + serWell + hjWell + productShift - serBarrier - hjBarrier) * -1;
    };

    // Wait: make negative ΔG go DOWN (larger y) and positive ΔG go UP (smaller y)
    const yFromU = (u: number): number => {
      const dg =
        -32 * stabilityScale * Math.exp(-Math.pow((u - 0.22) * 4.5, 2)) +
        (16 + (1 - stabilityScale) * 22) * Math.exp(-Math.pow((u - 0.37) * 8.0, 2)) -
        28 * stabilityScale * Math.exp(-Math.pow((u - 0.5) * 6.0, 2)) +
        (14 + (1 - stabilityScale) * 18) * Math.exp(-Math.pow((u - 0.63) * 8.0, 2)) -
        26 * stabilityScale * Math.exp(-Math.pow((u - 0.74) * 5.8, 2)) +
        (thermo.complexAssembled ? -18 * Math.pow(u, 1.8) : 10 * u);
      // dg negative -> below baselineY
      return Math.max(topPlotTop + 4, Math.min(topPlotBottom - 4, baselineY - dg * 1.1));
    };
    void energyAtU;

    ctx.strokeStyle = thermo.complexAssembled ? '#38bdf8' : '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const u = i / 100;
      const px = topPlotLeft + u * topW;
      const py = yFromU(u);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Stage markers along reaction coordinate
    const stageUs = [0.22, 0.5, 0.74, 0.94];
    stageUs.forEach((su, idx) => {
      const sx = topPlotLeft + su * topW;
      const sy = yFromU(su);
      const active = idx === stage;
      ctx.beginPath();
      ctx.arc(sx, sy, active ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#fbbf24' : '#0ea5e9';
      ctx.fill();
      if (active) {
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = active ? '#fde68a' : '#94a3b8';
      ctx.font = active ? 'bold 10px sans-serif' : '9px sans-serif';
      ctx.fillText(`S${idx + 1}`, sx - 7, sy - 9);
    });

    // Divider line
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, 165);
    ctx.lineTo(w - 14, 165);
    ctx.stroke();

    // --- BOTTOM PANEL: Recombination Probability P_rec vs Mismatch Count (y: 175..320) ---
    const botLeft = 48;
    const botRight = w - 24;
    const botTop = 194;
    const botBottom = 296;
    const botW = botRight - botLeft;
    const botH = botBottom - botTop;

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('雙環鹼基錯配（Mismatch）對突觸重組機率 P_rec 之門控效應', 16, 182);

    // Axes
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(botLeft, botTop);
    ctx.lineTo(botLeft, botBottom);
    ctx.lineTo(botRight, botBottom);
    ctx.stroke();

    // Y ticks (0%, 50%, 100%)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    [0, 50, 100].forEach((pct) => {
      const py = botBottom - (pct / 100) * botH;
      ctx.fillText(`${pct}%`, 14, py + 3);
      if (pct > 0) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.beginPath();
        ctx.moveTo(botLeft, py);
        ctx.lineTo(botRight, py);
        ctx.stroke();
      }
    });

    // Compute P_rec curve across TBL mismatch 0..4 (given current DBL mismatch)
    // and second curve for DBL mismatch 0..4 (given current TBL mismatch)
    const calcP = (mTbl: number, mDbl: number): number => {
      const dgT = -11.5 + mTbl * 3.4;
      const dgD = -11.5 + mDbl * 3.4;
      const pT = 1 / (1 + Math.exp((dgT + 5.5) / 1.2));
      const pD = 1 / (1 + Math.exp((dgD + 5.5) / 1.2));
      const pMax = mode === 'excision' ? 94 : mode === 'inversion' ? 89 : 86;
      return Math.max(0.5, Math.min(96, pMax * pT * pD));
    };

    // Draw TBL mismatch curve (Sky)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const m = (i / 40) * 4;
      const p = calcP(m, dblMismatch);
      const px = botLeft + (m / 4) * botW;
      const py = botBottom - (p / 100) * botH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Draw DBL mismatch curve (Emerald)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const m = (i / 40) * 4;
      const p = calcP(tblMismatch, m);
      const px = botLeft + (m / 4) * botW;
      const py = botBottom - (p / 100) * botH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // X ticks (0..4 nt)
    for (let m = 0; m <= 4; m++) {
      const px = botLeft + (m / 4) * botW;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`${m} nt`, px - 11, botBottom + 14);
    }

    // Current operating point markers
    const curPxTbl = botLeft + (tblMismatch / 4) * botW;
    const curPxDbl = botLeft + (dblMismatch / 4) * botW;
    const curPy = botBottom - (thermo.pRec / 100) * botH;

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(curPxTbl, curPy, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(curPxDbl, curPy, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Legend & Live readout
    ctx.fillStyle = '#38bdf8';
    ctx.font = '10px sans-serif';
    ctx.fillText('━ 變動 TBL 錯配', botRight - 185, botTop + 10);
    ctx.fillStyle = '#10b981';
    ctx.fillText('-- 變動 DBL 錯配', botRight - 92, botTop + 10);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(
      `當前 P_rec = ${thermo.pRec.toFixed(1)}%  |  ΔG_pair = ${thermo.dgTotal.toFixed(1)} kcal/mol`,
      botLeft,
      h - 8
    );
  }, [stage, mode, orientation, tblMismatch, dblMismatch, thermo]);

  // Helper to render base-pair alignment strip with mismatch highlighting
  const renderPairStrip = (
    label: string,
    seqA: string,
    seqB: string,
    mismatchCount: number,
    mismatchPositions: number[],
    accentClass: string
  ) => {
    const aBases = seqA.split(' ');
    const bBases = seqB.split(' ');
    const activeMismatches = new Set(mismatchPositions.slice(0, mismatchCount));

    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className={`font-semibold ${accentClass}`}>{label}</span>
          <span className="font-mono text-slate-400">
            錯配: <strong className={mismatchCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>{mismatchCount} nt</strong>
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-10 gap-0.5 text-center font-mono text-[11px]">
          {aBases.map((base, idx) => {
            const isMm = activeMismatches.has(idx);
            const partnerBase = isMm ? (bBases[idx] === 'A' ? 'C' : bBases[idx] === 'C' ? 'T' : 'G') : bBases[idx];
            return (
              <div
                key={idx}
                className={`rounded py-0.5 leading-tight ${
                  isMm ? 'bg-rose-950/70 text-rose-300 ring-1 ring-rose-500/40' : 'bg-slate-900/70 text-slate-300'
                }`}
              >
                <div>{base}</div>
                <div className={isMm ? 'text-rose-400 font-bold' : 'text-emerald-400/80'}>{isMm ? '×' : '|'}</div>
                <div>{partnerBase}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const activeStage = STAGES[stage];

  return (
    <div className="my-8 w-full max-w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 sm:p-5 text-slate-100 shadow-2xl">
      {/* 標題與播放控制 */}
      <div className="flex flex-col gap-3 border-b border-slate-700/80 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
              <h3 className="text-base sm:text-lg font-bold tracking-wide text-amber-300">
                IS110／IS621 橋接 RNA（Bridge RNA）雙特異性重組模擬器
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              互動檢驗雙二聚體突觸複合體、TBL／DBL 雙環鹼基配對門控與 5&apos;-磷酸絲胺酸無游離斷裂鏈交換循環
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500"
            >
              {isPlaying ? '⏸ 暫停循環' : '▶ 播放四態循環'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setMode('insertion');
                setOrientation('direct');
                setTblMismatch(0);
                setDblMismatch(0);
                setStage(0);
              }}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
            >
              ↺ 重置狀態
            </button>
          </div>
        </div>

        {/* 模式切換按鈕 */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            {
              id: 'insertion' as const,
              title: '插入（Insertion）',
              sub: '同向環狀供體嵌入基因組',
            },
            {
              id: 'excision' as const,
              title: '切除（Excision）',
              sub: '同向重組位點將中間片段環出移除',
            },
            {
              id: 'inversion' as const,
              title: '倒位（Inversion）',
              sub: '反向位點使中間基因翻轉 180°',
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleModeChange(item.id)}
              className={`rounded-xl border px-3 py-2 text-left transition ${
                mode === item.id
                  ? 'border-sky-400 bg-sky-950/70 text-sky-100 shadow-sm'
                  : 'border-slate-700/80 bg-slate-950/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800/70'
              }`}
            >
              <div className="text-xs font-bold">{item.title}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">{item.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 反應階段步進軸 */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {STAGES.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setStage(st.id);
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                stage === st.id
                  ? 'bg-emerald-600 text-white shadow'
                  : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {st.shortLabel}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-1 border-t border-slate-800/80 pt-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-bold text-emerald-300">{activeStage.title}</div>
          <span
            className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
              thermo.complexAssembled
                ? 'border border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                : 'border border-rose-500/50 bg-rose-950/60 text-rose-300'
            }`}
          >
            {thermo.complexAssembled ? activeStage.structuralBadge : '雙環配對失穩：複合催化受阻'}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">{activeStage.summary}</p>
      </div>

      {/* 主視覺雙面板：SVG 突觸複合體幾何 + Canvas 熱力學能障與特異性曲線 */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* 左側：響應式 SVG 雙二聚體突觸複合體與拓撲演變 */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2 lg:col-span-7">
          <svg
            viewBox="0 0 640 370"
            className="block h-auto w-full"
            role="img"
            aria-label="IS621 雙二聚體突觸複合體與橋接 RNA 鏈交換拓撲示意圖"
          >
            <defs>
              <linearGradient id="dimerTargetGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="dimerDonorGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#047857" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* 背景座標格線 */}
            <rect x="0" y="0" width="640" height="370" fill="#030712" rx="8" />
            <text x="16" y="22" fill="#cbd5e1" fontSize="12" fontWeight="700">
              IS621 雙二聚體突觸複合體（Dimer-of-Dimers）與無痕鏈交換拓撲
            </text>

            {/* 上方：Target-TBL 二聚體 (Monomer 1 & 2) */}
            <g transform={stage === 0 ? 'translate(0, -6)' : 'translate(0, 0)'}>
              <rect
                x="44"
                y="38"
                width="260"
                height="112"
                rx="22"
                fill="url(#dimerTargetGrad)"
                stroke="#38bdf8"
                strokeWidth="1.6"
                strokeDasharray={stage === 0 ? '5 3' : undefined}
              />
              <text x="58" y="56" fill="#7dd3fc" fontSize="11" fontWeight="700">
                目標二聚體（IS621 × 2）
              </text>
              <text x="58" y="70" fill="#94a3b8" fontSize="10">
                結合 TBL 目標結合環
              </text>

              {/* Target DNA 雙股 */}
              {/* Top strand */}
              {stage < 2 ? (
                <>
                  <line x1="22" y1="98" x2={stage >= 1 ? 168 : 322} y2="98" stroke="#38bdf8" strokeWidth="3.5" />
                  {stage >= 1 && (
                    <line x1="184" y1="98" x2="322" y2="98" stroke="#38bdf8" strokeWidth="3.5" />
                  )}
                </>
              ) : (
                // Stage 2 & 3: top strand crosses downward across synaptic interface
                <>
                  <path
                    d="M 22 98 L 164 98 C 210 98, 220 175, 290 218 L 320 218"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="3.5"
                  />
                  <path
                    d="M 184 98 L 322 98"
                    fill="none"
                    stroke={stage === 3 ? '#10b981' : '#38bdf8'}
                    strokeWidth="3.5"
                    strokeDasharray={stage === 2 ? '3 2' : undefined}
                  />
                </>
              )}

              {/* Bottom strand */}
              <line
                x1="22"
                y1="114"
                x2={stage === 3 ? 168 : 322}
                y2="114"
                stroke="#0284c7"
                strokeWidth="3"
              />
              {stage === 3 && (
                <path
                  d="M 168 114 C 220 114, 240 205, 320 234"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="3"
                />
              )}
              <text x="24" y="90" fill="#7dd3fc" fontSize="9.5" fontFamily="monospace">
                目標 DNA 5&apos;→3&apos;
              </text>

              {/* TBL 環 (Amber) */}
              <path
                d="M 96 138 Q 174 122 252 138"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
              />
              <text x="142" y="146" fill="#fbbf24" fontSize="10" fontWeight="700">
                TBL ({tblMismatch} 錯配)
              </text>

              {/* Base-pair rungs for TBL */}
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const rx = 112 + i * 17;
                const isMm = i < tblMismatch;
                return (
                  <line
                    key={`tbl-${i}`}
                    x1={rx}
                    y1="116"
                    x2={rx}
                    y2="132"
                    stroke={isMm ? '#f43f5e' : '#fbbf24'}
                    strokeWidth={isMm ? '2' : '1.4'}
                    strokeDasharray={isMm ? '2 2' : undefined}
                  />
                );
              })}
            </g>

            {/* 下方：Donor-DBL 二聚體 (Monomer 3 & 4) */}
            <g transform={stage === 0 ? 'translate(0, 6)' : 'translate(0, 0)'}>
              <rect
                x="336"
                y="156"
                width="260"
                height="112"
                rx="22"
                fill="url(#dimerDonorGrad)"
                stroke="#10b981"
                strokeWidth="1.6"
                strokeDasharray={stage === 0 ? '5 3' : undefined}
              />
              <text x="456" y="176" fill="#6ee7b7" fontSize="11" fontWeight="700">
                供體二聚體（IS621 × 2）
              </text>
              <text x="456" y="190" fill="#94a3b8" fontSize="10">
                結合 DBL 供體結合環
              </text>

              {/* Donor DNA 雙股 */}
              {stage < 2 ? (
                <>
                  <line x1="318" y1="218" x2={stage >= 1 ? 454 : 618} y2="218" stroke="#10b981" strokeWidth="3.5" />
                  {stage >= 1 && (
                    <line x1="470" y1="218" x2="618" y2="218" stroke="#10b981" strokeWidth="3.5" />
                  )}
                </>
              ) : (
                <>
                  <path
                    d="M 618 218 L 470 218 C 410 218, 360 120, 322 98"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3.5"
                  />
                  <line x1="320" y1="218" x2="452" y2="218" stroke="#38bdf8" strokeWidth="3.5" />
                </>
              )}

              <line
                x1={stage === 3 ? 470 : 318}
                y1="234"
                x2="618"
                y2="234"
                stroke="#059669"
                strokeWidth="3"
              />
              {stage === 3 && (
                <path
                  d="M 470 234 C 390 234, 340 130, 184 114"
                  fill="none"
                  stroke="#059669"
                  strokeWidth="3"
                />
              )}
              <text x="512" y="210" fill="#6ee7b7" fontSize="9.5" fontFamily="monospace">
                供體 DNA ({orientation === 'direct' ? '同向' : '反向'})
              </text>

              {/* DBL 環 (Amber) */}
              <path
                d="M 388 256 Q 466 240 544 256"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
              />
              <text x="434" y="264" fill="#fbbf24" fontSize="10" fontWeight="700">
                DBL ({dblMismatch} 錯配)
              </text>

              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const rx = 404 + i * 17;
                const isMm = i < dblMismatch;
                return (
                  <line
                    key={`dbl-${i}`}
                    x1={rx}
                    y1="236"
                    x2={rx}
                    y2="250"
                    stroke={isMm ? '#f43f5e' : '#fbbf24'}
                    strokeWidth={isMm ? '2' : '1.4'}
                    strokeDasharray={isMm ? '2 2' : undefined}
                  />
                );
              })}
            </g>

            {/* 橋接 RNA 主幹連接 TBL 與 DBL */}
            <path
              d="M 252 138 C 305 150, 335 244, 388 256"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.4"
              strokeDasharray="4 2"
            />
            <rect x="255" y="176" width="128" height="22" rx="6" fill="#451a03" stroke="#f59e0b" strokeWidth="1" />
            <text x="263" y="191" fill="#fde68a" fontSize="10" fontWeight="700">
              橋接 RNA（bRNA）主幹
            </text>

            {/* 跨二聚體界面：複合 RuvC–Tnp 催化核心與 5'-磷酸絲胺酸共價鎖 */}
            <g>
              <ellipse
                cx="320"
                cy="148"
                rx="54"
                ry="22"
                fill={thermo.complexAssembled && stage >= 1 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(51, 65, 85, 0.25)'}
                stroke={thermo.complexAssembled && stage >= 1 ? '#fbbf24' : '#64748b'}
                strokeWidth="1.5"
              />
              <text x="276" y="145" fill="#fef3c7" fontSize="9.5" fontWeight="700">
                複合 RuvC–Tnp 核心
              </text>
              <text x="282" y="158" fill="#cbd5e1" fontSize="9">
                {stage === 0
                  ? '二聚體對接組裝中'
                  : stage === 1
                  ? "Ser–5'P 共價鎖定斷端"
                  : stage === 2
                  ? '霍利迪交叉構象成立'
                  : '底端股解析完成'}
              </text>
            </g>

            {/* 共價 5'-磷酸絲胺酸橙色標記（Stage 1 & 2） */}
            {(stage === 1 || stage === 2) && (
              <>
                <circle cx="176" cy="98" r="6" fill="#fb923c" stroke="#fff" strokeWidth="1.2" />
                <text x="150" y="84" fill="#fdba74" fontSize="9.5" fontWeight="700">
                  Ser–5&apos;P
                </text>
                <circle cx="462" cy="218" r="6" fill="#fb923c" stroke="#fff" strokeWidth="1.2" />
                <text x="438" y="204" fill="#fdba74" fontSize="9.5" fontWeight="700">
                  Ser–5&apos;P
                </text>
              </>
            )}

            {/* 底部產物拓撲示意框 (y: 284..358) */}
            <rect x="16" y="282" width="608" height="76" rx="10" fill="#0f172a" stroke="#334155" strokeWidth="1.2" />
            <text x="28" y="300" fill="#94a3b8" fontSize="10" fontWeight="700">
              單步驟重組拓撲結果預覽（{mode === 'insertion' ? '插入模式' : mode === 'excision' ? '切除模式' : '倒位模式'}）：
            </text>

            {mode === 'insertion' && (
              <g transform="translate(28, 312)">
                {/* Genome before -> integrated donor cassette */}
                <line x1="0" y1="20" x2="120" y2="20" stroke="#38bdf8" strokeWidth="4" />
                <rect x="120" y="10" width="128" height="20" rx="5" fill="#065f46" stroke="#10b981" strokeWidth="1.5" />
                <text x="132" y="24" fill="#d1fae5" fontSize="10" fontWeight="700">
                  {orientation === 'direct' ? '供體負載 → (正向插入)' : '← 供體負載 (反向插入)'}
                </text>
                <line x1="248" y1="20" x2="368" y2="20" stroke="#38bdf8" strokeWidth="4" />
                <text x="382" y="24" fill="#cbd5e1" fontSize="10.5">
                  無需切出暴露 DSB 即嵌入目標基因座
                </text>
              </g>
            )}

            {mode === 'excision' && (
              <g transform="translate(28, 312)">
                <line x1="0" y1="20" x2="110" y2="20" stroke="#38bdf8" strokeWidth="4" />
                <line x1="114" y1="20" x2="224" y2="20" stroke="#38bdf8" strokeWidth="4" />
                <circle cx="112" cy="20" r="4" fill="#fbbf24" />
                <text x="95" y="10" fill="#fbbf24" fontSize="9">
                  無痕接點
                </text>
                <ellipse cx="305" cy="20" rx="34" ry="14" fill="none" stroke="#10b981" strokeWidth="3" />
                <text x="279" y="23" fill="#6ee7b7" fontSize="9.5" fontWeight="700">
                  環出切除
                </text>
                <text x="355" y="24" fill="#cbd5e1" fontSize="10.5">
                  同向位點間片段成環移除，基因組直接接合
                </text>
              </g>
            )}

            {mode === 'inversion' && (
              <g transform="translate(28, 312)">
                <line x1="0" y1="20" x2="90" y2="20" stroke="#38bdf8" strokeWidth="4" />
                <rect x="90" y="10" width="140" height="20" rx="5" fill="#4c1d95" stroke="#a78bfa" strokeWidth="1.5" />
                <text x="106" y="24" fill="#ede9fe" fontSize="10" fontWeight="700">
                  ← 基因區段翻轉 180°
                </text>
                <line x1="230" y1="20" x2="320" y2="20" stroke="#38bdf8" strokeWidth="4" />
                <text x="336" y="24" fill="#cbd5e1" fontSize="10.5">
                  兩反向重組位點之間序列原地反轉方向
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* 右側：Canvas 自由能剖面與 P_rec 錯配門控曲線 */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2 lg:col-span-5">
          <canvas
            ref={canvasRef}
            width={480}
            height={330}
            className="block h-auto w-full rounded-lg"
          />
        </div>
      </div>

      {/* 實時量化指標卡 */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">雙環配對自由能 ΔG_pair</div>
          <div className="mt-1 font-mono text-base font-bold text-amber-300">
            {thermo.dgTotal.toFixed(1)} kcal/mol
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            TBL {thermo.dgTbl.toFixed(1)} / DBL {thermo.dgDbl.toFixed(1)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">突觸重組機率 P_rec</div>
          <div
            className={`mt-1 font-mono text-base font-bold ${
              thermo.pRec >= 60 ? 'text-emerald-400' : thermo.pRec >= 25 ? 'text-amber-300' : 'text-rose-400'
            }`}
          >
            {thermo.pRec.toFixed(1)}%
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            {thermo.complexAssembled ? 'AND 邏輯閘門通過' : '門檻未達，重組受阻'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">游離雙股斷裂 (Free DSB)</div>
          <div className="mt-1 font-mono text-base font-bold text-sky-300">0 暴露</div>
          <div className="mt-0.5 text-[10px] text-slate-500">5&apos;-磷酸絲胺酸共價鎖住斷端</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">產物拓撲構型</div>
          <div className="mt-1 text-xs font-bold leading-snug text-emerald-200">{thermo.topologyOutcome}</div>
        </div>
      </div>

      {/* 可編程雙環配對控制台 */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
        <div className="flex flex-col gap-2 border-b border-slate-800/80 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-bold text-slate-200">可編程雙環配對控制台（TBL &amp; DBL）</div>
            <div className="text-[11px] text-slate-400">
              調整任一結合環的鹼基錯配或相對方向，測試雙特異性 AND 門控對突觸重組機率的影響
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setTblMismatch(0);
                setDblMismatch(0);
              }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                tblMismatch === 0 && dblMismatch === 0
                  ? 'border-emerald-500 bg-emerald-950/60 text-emerald-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              完美雙重匹配 (0/0)
            </button>
            <button
              type="button"
              onClick={() => {
                setTblMismatch(2);
                setDblMismatch(0);
              }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                tblMismatch === 2 && dblMismatch === 0
                  ? 'border-amber-500 bg-amber-950/60 text-amber-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              單環錯配測試 (2/0)
            </button>
            <button
              type="button"
              onClick={() => {
                setTblMismatch(3);
                setDblMismatch(3);
              }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                tblMismatch === 3 && dblMismatch === 3
                  ? 'border-rose-500 bg-rose-950/60 text-rose-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              雙環失穩測試 (3/3)
            </button>
          </div>
        </div>

        {/* 滑桿與方向切換 */}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="tbl-mismatch-slider" className="font-semibold text-sky-300">
                TBL 目標結合環錯配
              </label>
              <span className="font-mono font-bold text-slate-200">{tblMismatch} nt</span>
            </div>
            <input
              id="tbl-mismatch-slider"
              type="range"
              min={0}
              max={4}
              step={1}
              value={tblMismatch}
              onChange={(e) => setTblMismatch(parseInt(e.target.value, 10))}
              className="mt-2 w-full accent-sky-500"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>0 nt（完全互補）</span>
              <span>4 nt（脫靶阻斷）</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="dbl-mismatch-slider" className="font-semibold text-emerald-300">
                DBL 供體結合環錯配
              </label>
              <span className="font-mono font-bold text-slate-200">{dblMismatch} nt</span>
            </div>
            <input
              id="dbl-mismatch-slider"
              type="range"
              min={0}
              max={4}
              step={1}
              value={dblMismatch}
              onChange={(e) => setDblMismatch(parseInt(e.target.value, 10))}
              className="mt-2 w-full accent-emerald-500"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>0 nt（完全互補）</span>
              <span>4 nt（脫靶阻斷）</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
            <div className="text-xs font-semibold text-amber-300">供體－目標相對方向</div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleOrientationChange('direct')}
                className={`rounded-md border py-1.5 text-xs font-semibold transition ${
                  orientation === 'direct'
                    ? 'border-amber-400 bg-amber-950/60 text-amber-200'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                同向 (Direct)
              </button>
              <button
                type="button"
                onClick={() => handleOrientationChange('inverted')}
                className={`rounded-md border py-1.5 text-xs font-semibold transition ${
                  orientation === 'inverted'
                    ? 'border-amber-400 bg-amber-950/60 text-amber-200'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                反向 (Inverted)
              </button>
            </div>
            <div className="mt-1.5 text-[10px] text-slate-400">
              染色體內：同向→切除；反向→倒位；環狀供體→依配向正／反嵌入
            </div>
          </div>
        </div>

        {/* 雙環鹼基對即時比對條 */}
        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {renderPairStrip(
            'TBL 環 ↔ 目標 DNA（Target）配對窗口',
            TARGET_SEQ,
            TARGET_COMP,
            tblMismatch,
            MISMATCH_INDICES_TBL,
            'text-sky-300'
          )}
          {renderPairStrip(
            'DBL 環 ↔ 供體 DNA（Donor）配對窗口',
            DONOR_SEQ,
            DONOR_COMP,
            dblMismatch,
            MISMATCH_INDICES_DBL,
            'text-emerald-300'
          )}
        </div>
      </div>

      {/* 必備科學邊界聲明 */}
      <div className="mt-3 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <strong className="text-slate-200">模型說明：</strong>
        催化機制幾何與拓撲示範模型（依據 IS621 Cryo-EM 三態結構原理建構），非完整全原子分子動力學模擬。配對自由能與突觸重組機率採用兩獨立結合環熱力學耦合近似，旨在呈現 TBL／DBL 雙重鹼基配對門控與共價 5&apos;-磷酸絲胺酸迴避游離雙股斷裂之核心物理邏輯。
      </div>
    </div>
  );
};
