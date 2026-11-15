import React, { useState, useEffect, useRef, useMemo } from 'react';

interface Atom3D {
  x: number;
  y: number;
  z: number;
  kind: 'backbone' | 'idr' | 'ligand';
  index: number;
}

// 確定性偽隨機高斯噪聲產生器 (Box-Muller)
function seededGaussian(seed: number, idx: number, axis: number): number {
  const s1 = Math.sin((seed * 127.1 + idx * 311.7 + axis * 74.7) * 1.37) * 43758.5453;
  const s2 = Math.sin((seed * 269.5 + idx * 183.3 + axis * 219.1) * 1.91) * 28461.1234;
  const u1 = Math.max(1e-5, s1 - Math.floor(s1));
  const u2 = s2 - Math.floor(s2);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// 構造蛋白質結合口袋 (16 主鏈折疊殘基 + 4 無序尾端殘基) 與 6 原子環狀小分子配體目標座標
function buildNativeComplex(): Atom3D[] {
  const atoms: Atom3D[] = [];
  // 1. 折疊結合口袋主鏈 (0..15): 左側 α-螺旋弧線包圍右側口袋凹槽
  for (let i = 0; i < 16; i++) {
    const u = i / 15;
    const angle = -2.1 + u * 4.2;
    const radius = 56 + 10 * Math.sin(u * Math.PI * 3);
    const x = -18 + Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.92;
    const z = Math.sin(u * Math.PI * 4) * 26;
    atoms.push({ x, y, z, kind: 'backbone', index: i });
  }
  // 2. 本質無序尾端 (IDR, 16..19)
  for (let i = 0; i < 4; i++) {
    const k = i + 1;
    atoms.push({
      x: -56 - k * 14,
      y: -48 - Math.sin(k * 1.1) * 16,
      z: 18 - k * 9,
      kind: 'idr',
      index: 16 + i,
    });
  }
  // 3. 芳香環狀小分子配體 (20..25) 嵌合於口袋中央偏右
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    atoms.push({
      x: 16 + Math.cos(a) * 20,
      y: Math.sin(a) * 20,
      z: Math.cos(a * 2) * 5,
      kind: 'ligand',
      index: 20 + i,
    });
  }
  return atoms;
}

const NATIVE_COMPLEX = buildNativeComplex();

function getPlddtColor(plddt: number): string {
  if (plddt >= 90) return '#2563eb'; // 極高置信度：深藍
  if (plddt >= 70) return '#38bdf8'; // 良好置信度：天藍
  if (plddt >= 50) return '#facc15'; // 低置信度：黃色
  return '#f97316'; // 無序/低可信：橘紅
}

export const MolecularDiffusionSimulator: React.FC = () => {
  // 擴散時間步 t: 1.00 = 純高斯噪聲雲, 0.00 = 去噪完成之全原子複合物
  const [diffusionT, setDiffusionT] = useState<number>(0.34);
  // Pairformer 共演化與幾何約束強度 (0.20 ~ 1.00)
  const [pairStrength, setPairStrength] = useState<number>(0.85);
  // 隨機種子切換 (展示同一 Pairformer 表徵下的擴散採樣多樣性)
  const [sampleSeed, setSampleSeed] = useState<number>(1);
  // 是否播放逆向擴散去噪軌跡
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 計算當前噪聲尺度與各原子去噪座標、pLDDT、PAE 與 RMSD
  const simData = useMemo(() => {
    // EDM / VP-SDE 平滑噪聲排程：高 t 時呈大尺度高斯雲，低 t 時快速收斂
    const sigma = Math.pow(diffusionT, 1.55) * 95;
    const signalScale = Math.sqrt(Math.max(0.04, 1 - Math.pow(diffusionT, 1.8) * 0.85));

    // Pairformer 約束不足時，低 t 仍殘留結構不確定性（模擬 MSA 稀疏或新穎配體）
    const uncertaintyFloor = (1 - pairStrength) * 24;

    let sqDistSum = 0;
    let plddtSum = 0;

    const currentAtoms = NATIVE_COMPLEX.map((atom) => {
      const gx = seededGaussian(sampleSeed, atom.index, 1);
      const gy = seededGaussian(sampleSeed, atom.index, 2);
      const gz = seededGaussian(sampleSeed, atom.index, 3);

      // 無序區 (IDR) 即使在低 t 仍維持較高擴散方差，且易於種子間出現偽螺旋起伏
      const kindAmp = atom.kind === 'idr' ? 1.55 : atom.kind === 'ligand' ? 1.12 : 0.92;
      const effNoise = (sigma + uncertaintyFloor * (atom.kind === 'backbone' ? 0.55 : 1.05)) * kindAmp;

      const x = signalScale * atom.x + gx * effNoise * 0.52;
      const y = signalScale * atom.y + gy * effNoise * 0.52;
      const z = signalScale * atom.z + gz * effNoise * 0.52;

      const dx = x - atom.x;
      const dy = y - atom.y;
      const dz = z - atom.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      sqDistSum += dist * dist;

      // 估算局部 pLDDT (0-100)
      const baseConf =
        atom.kind === 'idr'
          ? 44 + pairStrength * 14
          : atom.kind === 'ligand'
            ? 62 + pairStrength * 32
            : 66 + pairStrength * 32;
      const plddt = Math.max(18, Math.min(98, baseConf * Math.exp(-Math.pow(diffusionT, 1.35) * 1.45)));
      plddtSum += plddt;

      return { ...atom, cx: x, cy: y, cz: z, plddt };
    });

    const rmsdAngstrom = Math.sqrt(sqDistSum / NATIVE_COMPLEX.length) * 0.22;
    const meanPlddt = plddtSum / NATIVE_COMPLEX.length;

    // 蛋白-配體介面 PAE (Å) 與 ipTM
    const interfacePae = 1.2 + Math.pow(diffusionT, 1.3) * 22 + (1 - pairStrength) * 8.5;
    const ipTm = Math.max(0.12, Math.min(0.95, (0.35 + 0.62 * pairStrength) * (1 - 0.82 * Math.pow(diffusionT, 1.2))));

    let stageLabel = '全原子立體精修 (小 σ)';
    if (diffusionT > 0.68) stageLabel = '高噪聲域拓撲定位 (大 σ)';
    else if (diffusionT > 0.26) stageLabel = '次級骨架與結合口袋成形 (中 σ)';

    return {
      sigma,
      currentAtoms,
      rmsdAngstrom,
      meanPlddt,
      interfacePae,
      ipTm,
      stageLabel,
    };
  }, [diffusionT, pairStrength, sampleSeed]);

  // 動畫：從 t = 1.00 逆向去噪至 t = 0.00
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setDiffusionT((prev) => {
        const next = prev - 0.015;
        if (next <= 0) {
          setIsPlaying(false);
          return 0;
        }
        return parseFloat(next.toFixed(3));
      });
    }, 45);
    return () => clearInterval(timer);
  }, [isPlaying]);

  // 繪製 Canvas：左側全原子擴散結構，右側 PAE 誤差矩陣與 σ(t) 排程
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#060a13';
    ctx.fillRect(0, 0, W, H);

    // ─── 左側視圖：全原子三維點雲去噪過程 ─────────────────────────
    const leftW = 468;
    const centerX = leftW * 0.52;
    const centerY = H * 0.53;

    ctx.fillStyle = '#0b1220';
    ctx.fillRect(14, 34, leftW - 24, H - 50);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 34, leftW - 24, H - 50);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`全原子逆向擴散場 (t = ${diffusionT.toFixed(2)} | ${simData.stageLabel})`, 18, 22);

    // 畫出結合口袋天然輪廓淡淡參考虛線環
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(centerX + 12, centerY, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const atoms = simData.currentAtoms;
    const backboneAndIdr = atoms.slice(0, 20);
    const ligandAtoms = atoms.slice(20, 26);

    // 依鍵結收斂程度繪製共價骨幹連線
    const bondAlpha = Math.max(0.12, 1 - diffusionT * 0.85);
    ctx.lineWidth = 2.4;
    for (let i = 0; i < backboneAndIdr.length - 1; i++) {
      const a = backboneAndIdr[i];
      const b = backboneAndIdr[i + 1];
      ctx.strokeStyle =
        b.kind === 'idr'
          ? `rgba(249, 115, 22, ${bondAlpha * 0.75})`
          : `rgba(96, 165, 250, ${bondAlpha})`;
      ctx.beginPath();
      ctx.moveTo(centerX + a.cx, centerY + a.cy);
      ctx.lineTo(centerX + b.cx, centerY + b.cy);
      ctx.stroke();
    }

    // 小分子芳香環共價鍵
    ctx.strokeStyle = `rgba(52, 211, 153, ${bondAlpha})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < ligandAtoms.length; i++) {
      const a = ligandAtoms[i];
      const b = ligandAtoms[(i + 1) % ligandAtoms.length];
      ctx.beginPath();
      ctx.moveTo(centerX + a.cx, centerY + a.cy);
      ctx.lineTo(centerX + b.cx, centerY + b.cy);
      ctx.stroke();
    }

    // 蛋白-配體非共價極性相互作用虛線 (低噪聲且約束夠強時顯現)
    if (diffusionT < 0.35 && pairStrength > 0.45) {
      const interactAlpha = (0.35 - diffusionT) * 2.4 * pairStrength;
      ctx.strokeStyle = `rgba(250, 204, 21, ${Math.min(0.85, interactAlpha)})`;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.4;
      [
        [4, 22],
        [10, 24],
      ].forEach(([pIdx, lIdx]) => {
        const p = atoms[pIdx];
        const l = atoms[lIdx];
        ctx.beginPath();
        ctx.moveTo(centerX + p.cx, centerY + p.cy);
        ctx.lineTo(centerX + l.cx, centerY + l.cy);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    // 按 z 深度排序繪製原子球體
    const sorted = [...atoms].sort((a, b) => a.cz - b.cz);
    for (const atom of sorted) {
      const px = centerX + atom.cx;
      const py = centerY + atom.cy;
      const radius = atom.kind === 'ligand' ? 6.2 : 5.4;

      // 噪聲不確定性光暈
      if (diffusionT > 0.08) {
        ctx.fillStyle = atom.kind === 'ligand' ? 'rgba(52, 211, 153, 0.14)' : 'rgba(56, 189, 248, 0.12)';
        ctx.beginPath();
        ctx.arc(px, py, radius + diffusionT * 10, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = atom.kind === 'ligand' ? '#10b981' : getPlddtColor(atom.plddt);
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // 圖例說明
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('● 折疊主鏈 (依 pLDDT 着色)', 26, H - 26);
    ctx.fillStyle = '#f97316';
    ctx.fillText('● 無序尾端 IDR (易生幻覺)', 176, H - 26);
    ctx.fillStyle = '#10b981';
    ctx.fillText('● 小分子配體', 330, H - 26);

    // ─── 右側視圖：PAE 成對誤差熱圖 + 噪聲尺度排程 ─────────────────
    const rx = 486;
    const rw = 296;
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('成對預測對齊誤差矩陣 (PAE) 與噪聲排程', rx, 22);

    // PAE 26x26 矩陣 (180x180)
    const matSize = 186;
    const matX = rx + 12;
    const matY = 38;
    const nAtoms = atoms.length;
    const cell = matSize / nAtoms;

    for (let i = 0; i < nAtoms; i++) {
      for (let j = 0; j < nAtoms; j++) {
        const ai = atoms[i];
        const aj = atoms[j];
        const sameDomain = ai.kind === aj.kind;
        const involvesIdr = ai.kind === 'idr' || aj.kind === 'idr';
        let err = 1.0 + Math.pow(diffusionT, 1.25) * 20;
        if (!sameDomain) err += (1 - pairStrength) * 14 + 2.5 * diffusionT;
        if (involvesIdr && i !== j) err += 9.5;
        const normErr = Math.min(1, err / 26);

        // 綠色(低誤差) -> 淡青 -> 琥珀/灰白(高誤差)
        const r = Math.round(16 + normErr * 218);
        const g = Math.round(185 - normErr * 80);
        const b = Math.round(129 - normErr * 60);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(matX + j * cell, matY + i * cell, cell + 0.4, cell + 0.4);
      }
    }
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(matX, matY, matSize, matSize);

    // 蛋白 / 配體區塊分界線
    const ligSplit = matX + 20 * cell;
    const ligSplitY = matY + 20 * cell;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(ligSplit, matY);
    ctx.lineTo(ligSplit, matY + matSize);
    ctx.moveTo(matX, ligSplitY);
    ctx.lineTo(matX + matSize, ligSplitY);
    ctx.stroke();
    ctx.setLineDash([]);

    // PAE 色標
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('0 Å (準確)', matX + matSize + 10, matY + 14);
    ctx.fillText('蛋白主鏈', matX + matSize + 10, matY + 60);
    ctx.fillText('IDR 無序區', matX + matSize + 10, matY + 122);
    ctx.fillText('配體介面', matX + matSize + 10, matY + 165);
    ctx.fillText('>25 Å (不確定)', matX + matSize + 10, matY + matSize - 4);

    // 下方：噪聲尺度 σ(t) 曲線
    const chartX = rx + 12;
    const chartY = 252;
    const chartW = rw - 24;
    const chartH = 74;

    ctx.fillStyle = '#0b1220';
    ctx.fillRect(chartX, chartY, chartW, chartH);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(chartX, chartY, chartW, chartH);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px <= chartW; px += 4) {
      const tVal = 1 - px / chartW; // 左 t=1.0 -> 右 t=0.0
      const sigNorm = Math.pow(tVal, 1.55);
      const py = chartY + chartH - 10 - sigNorm * (chartH - 22);
      if (px === 0) ctx.moveTo(chartX + px, py);
      else ctx.lineTo(chartX + px, py);
    }
    ctx.stroke();

    // 當前時間步標記點
    const curX = chartX + (1 - diffusionT) * chartW;
    const curY = chartY + chartH - 10 - Math.pow(diffusionT, 1.55) * (chartH - 22);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(curX, curY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('t=1.0 (高斯噪聲)', chartX, chartY + chartH + 14);
    ctx.fillText('t=0.0 (成對精修)', chartX + chartW - 84, chartY + chartH + 14);
  }, [diffusionT, pairStrength, simData]);

  const handlePlay = () => {
    if (diffusionT <= 0.02) {
      setDiffusionT(1.0);
    }
    setIsPlaying((prev) => !prev);
  };

  return (
    <div className="my-8 w-full max-w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 sm:p-5 text-slate-100 shadow-2xl">
      <div className="flex flex-col gap-3 border-b border-slate-700/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-bold tracking-wide text-emerald-300">
            全原子逆向擴散去噪與 Pairformer 約束模擬器
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            模擬原子座標如何從高維高斯噪聲雲收斂成結合口袋與小分子配體，並即時檢視 pLDDT 與 PAE 置信矩陣
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePlay}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
          >
            {isPlaying ? '⏸ 暫停去噪' : '▶ 播放逆向去噪'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setDiffusionT(1.0);
            }}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
          >
            重置噪聲雲 (t=1.0)
          </button>
          <button
            type="button"
            onClick={() => setSampleSeed((s) => (s % 3) + 1)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-slate-700"
          >
            樣本種子 #{sampleSeed}
          </button>
        </div>
      </div>

      {/* Canvas 主視窗 */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          className="block w-full h-auto rounded-lg"
        />
      </div>

      {/* 核心指標 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">去噪進度 t / σ(t)</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-sky-300">
            t = {diffusionT.toFixed(2)} · σ = {simData.sigma.toFixed(1)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">平均局部置信度 pLDDT</div>
          <div className="mt-1 font-mono text-base font-bold text-emerald-400">
            {simData.meanPlddt.toFixed(1)} / 100
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">蛋白-配體介面 PAE / ipTM</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-amber-300">
            {simData.interfacePae.toFixed(1)} Å · ipTM {simData.ipTm.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">全原子偏差 RMSD</div>
          <div className="mt-1 font-mono text-base font-bold text-rose-300">
            {simData.rmsdAngstrom.toFixed(2)} Å
          </div>
        </div>
      </div>

      {/* 滑桿控制 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">擴散時間步 t (1.0 噪聲 → 0.0 摺疊結構)</span>
            <span className="font-mono font-bold text-sky-300">{diffusionT.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={1.0}
            step={0.02}
            value={diffusionT}
            onChange={(e) => {
              setIsPlaying(false);
              setDiffusionT(parseFloat(e.target.value));
            }}
            className="mt-2 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0.00 (原子精修完成)</span>
            <span>1.00 (各向同性高斯雲)</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Pairformer 共演化約束強度</span>
            <span className="font-mono font-bold text-emerald-300">{(pairStrength * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1.0}
            step={0.05}
            value={pairStrength}
            onChange={(e) => setPairStrength(parseFloat(e.target.value))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>弱 MSA / 新穎配體 (20%)</span>
            <span>強共演化圖譜 (100%)</span>
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
        <strong className="text-slate-200">模型說明：</strong>
        將時間步 t 從 1.00 拖向 0.00 可觀察多尺度去噪：大 σ 階段先決定結構域與配體位置，低 σ 階段再鎖定環狀幾何與氫鍵；切換「樣本種子」可見無序尾端（橘色 IDR）在不同採樣之間仍保留顯著構象差異與低 pLDDT，反映生成式模型的統計隨機性而非真實分子動力學軌跡。
      </div>
    </div>
  );
};
