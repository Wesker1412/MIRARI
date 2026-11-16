import React, { useState, useEffect, useRef, useMemo } from 'react';

type MagneticPhaseMode = 'ferromagnet' | 'conventional_afm' | 'altermagnet_d' | 'altermagnet_g';

interface PhaseMetadata {
  id: MagneticPhaseMode;
  label: string;
  shortLabel: string;
  symmetryTag: string;
  netMoment: string;
  degeneracyStatus: string;
  description: string;
  nodesDeg: number[];
}

const PHASE_META: Record<MagneticPhaseMode, PhaseMetadata> = {
  ferromagnet: {
    id: 'ferromagnet',
    label: '鐵磁體 (Ferromagnet)',
    shortLabel: '鐵磁體 FM',
    symmetryTag: '破壞時間反演 T，淨磁矩 M ≠ 0',
    netMoment: 'M ≠ 0 (宏觀淨磁化)',
    degeneracyStatus: '全布里淵區等向自旋劈裂',
    description:
      '所有晶格格點自旋同向排列，缺乏連結反轉自旋的對稱操作；自旋向上與向下費米面在各向均產生均勻劈裂。',
    nodesDeg: [],
  },
  conventional_afm: {
    id: 'conventional_afm',
    label: '傳統反鐵磁體 (Conventional AFM)',
    shortLabel: '傳統 AFM',
    symmetryTag: '[C₂ ∥ t] 或 [C₂ ∥ P] 保護',
    netMoment: 'M = 0 (共線補償)',
    degeneracyStatus: '全布里淵區克萊默斯簡併 (ΔE = 0)',
    description:
      '相反自旋子晶格可透過純晶格平移 t 或空間反演 P 加上時間反演 T 互相疊合，周圍非磁性原子配位完全等價，非相對論自旋簡併處處受保護。',
    nodesDeg: [],
  },
  altermagnet_d: {
    id: 'altermagnet_d',
    label: '交錯磁體 d-wave (Altermagnet d-wave)',
    shortLabel: '交錯磁體 d-wave',
    symmetryTag: '[C₂ ∥ C₄] 晶格旋轉結合時間反演',
    netMoment: 'M = 0 (共線補償)',
    degeneracyStatus: 'd-wave 動量相依交替劈裂 (2 條節線)',
    description:
      '相反自旋子晶格周圍的非磁性配位環境彼此旋轉 90°；純平移或反演無法疊合兩者，僅旋轉 C₄ 結合自旋翻轉 C₂ 對稱，在動量空間形成 ΔE(k) ∝ cos(2θ) 的四葉交替劈裂。',
    nodesDeg: [45, 135],
  },
  altermagnet_g: {
    id: 'altermagnet_g',
    label: '交錯磁體 g-wave (α-MnTe 模型)',
    shortLabel: '交錯磁體 g-wave',
    symmetryTag: '[C₂ ∥ C₆] / 鏡面結合時間反演',
    netMoment: 'M = 0 (共線補償)',
    degeneracyStatus: 'g-wave 六方交替劈裂 (k_z ≠ 0 切面 3 條垂直節線)',
    description:
      '模擬六方 α-MnTe 在有限 k_z 動量切面上的交錯磁性對稱：非磁性 Te 配位打破子晶格間的平移與反演等效性，在 k_z = 0 水平節面外再形成 3 條垂直節線 (ΔE ∝ sin 3θ)，呈現六葉變號劈裂。',
    nodesDeg: [0, 60, 120, 180],
  },
};

const ORDER_LIST: MagneticPhaseMode[] = [
  'ferromagnet',
  'conventional_afm',
  'altermagnet_d',
  'altermagnet_g',
];

/**
 * 計算給定動量波矢 (kx, ky) (範圍 [-π, π]) 與模式下的幾何自旋劈裂因子 f(k) ∈ [-1, 1]
 */
function evaluateFormFactor(
  mode: MagneticPhaseMode,
  kx: number,
  ky: number
): number {
  if (mode === 'ferromagnet') return 1.0;
  if (mode === 'conventional_afm') return 0.0;

  if (mode === 'altermagnet_d') {
    // 緊束縛 d_{x^2-y^2} 型因子：cos(kx) - cos(ky) 歸一化至 [-1, 1]
    return 0.5 * (Math.cos(kx) - Math.cos(ky));
  }

  // altermagnet_g: 六方 α-MnTe 於 k_z ≠ 0 切面之最低階 g-wave 諧波因子 ~ sin(3θ) * envelope(k)
  const k = Math.hypot(kx, ky);
  if (k < 1e-4) return 0.0;
  const theta = Math.atan2(ky, kx);
  // 隨 k 增長並於布里淵區邊界平滑調制
  const radialEnvelope = Math.sin(Math.min(Math.PI, k * 0.95));
  return Math.sin(3 * theta) * Math.max(0.15, radialEnvelope);
}

/**
 * 計算基底緊束縛色散 E0(k) (meV 相對費米能階，約落在 [-600, +600] meV)
 */
function evaluateBaseDispersion(
  mode: MagneticPhaseMode,
  kx: number,
  ky: number
): number {
  if (mode === 'altermagnet_g') {
    // 六方緊束縛近似基底色散
    const eHex =
      -180 *
        (Math.cos(kx) +
          2 * Math.cos(0.5 * kx) * Math.cos((Math.sqrt(3) / 2) * ky)) +
      160;
    return eHex;
  }
  // 正方／金紅石投影緊束縛色散
  return -240 * (Math.cos(kx) + Math.cos(ky)) + 60;
}

export const AltermagnetSpinSimulator: React.FC = () => {
  const [mode, setMode] = useState<MagneticPhaseMode>('altermagnet_d');
  const [exchangeJ, setExchangeJ] = useState<number>(260); // meV
  const [thetaDeg, setThetaDeg] = useState<number>(15); // 0 to 180 degrees
  const [tempRatio, setTempRatio] = useState<number>(0.25); // T / T_N (0.05 to 1.30)

  const fermiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bandCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const meta = PHASE_META[mode];

  // 磁序參數 m(T)：T < T_N 時依連續相變律衰減，T >= T_N 時嚴格歸零恢復克萊默斯簡併
  const orderParameter = useMemo(() => {
    if (tempRatio >= 1.0) return 0;
    return Math.pow(Math.max(0, 1 - tempRatio), 0.35);
  }, [tempRatio]);

  const effectiveJ = exchangeJ * orderParameter;

  // 沿選取動量切線 theta_k 在典型費米半徑 k_F ~ 1.75 rad 處的劈裂能量 ΔE(θ_k)
  const { splitAtCutMeV, isOnNode, netMagnetizationRatio } = useMemo(() => {
    const rad = (thetaDeg * Math.PI) / 180;
    const kProbe = 1.75;
    const kx = kProbe * Math.cos(rad);
    const ky = kProbe * Math.sin(rad);
    const factor = evaluateFormFactor(mode, kx, ky);
    const deltaE = 2 * effectiveJ * factor; // E_+ - E_- = 2 J(k)
    const onNode =
      mode !== 'ferromagnet' &&
      (mode === 'conventional_afm' || Math.abs(deltaE) < 4.0 || tempRatio >= 1.0);
    const netM = mode === 'ferromagnet' ? orderParameter : 0;

    return {
      splitAtCutMeV: deltaE,
      isOnNode: onNode,
      netMagnetizationRatio: netM,
    };
  }, [mode, thetaDeg, effectiveJ, tempRatio, orderParameter]);

  // 繪製動量空間 (kx, ky) 等能面與節線 Canvas
  useEffect(() => {
    const canvas = fermiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const cssW = 360;
    const cssH = 290;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, cssW, cssH);

    const cx = cssW / 2;
    const cy = cssH / 2 + 6;
    const halfBz = 104; // 對應 [-π, +π]

    // 1. 動量空間自旋劈裂強度背景熱圖 (kx, ky)
    const gridN = 64;
    const cellSize = (halfBz * 2) / gridN;
    for (let iy = 0; iy < gridN; iy++) {
      for (let ix = 0; ix < gridN; ix++) {
        const u = (ix + 0.5) / gridN;
        const v = (iy + 0.5) / gridN;
        const kx = (u * 2 - 1) * Math.PI;
        const ky = (1 - v * 2) * Math.PI;
        const f = evaluateFormFactor(mode, kx, ky);
        const val = f * (effectiveJ / 400);

        if (Math.abs(val) > 0.015) {
          const alpha = Math.min(0.42, Math.abs(val) * 0.52);
          ctx.fillStyle =
            val > 0
              ? `rgba(56, 189, 248, ${alpha.toFixed(3)})`
              : `rgba(251, 113, 133, ${alpha.toFixed(3)})`;
          ctx.fillRect(
            cx - halfBz + ix * cellSize,
            cy - halfBz + iy * cellSize,
            cellSize + 0.5,
            cellSize + 0.5
          );
        }
      }
    }

    // 2. 第一布里淵區框線與座標軸
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(cx - halfBz, cy - halfBz, halfBz * 2, halfBz * 2);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - halfBz - 10, cy);
    ctx.lineTo(cx + halfBz + 10, cy);
    ctx.moveTo(cx, cy - halfBz - 10);
    ctx.lineTo(cx, cy + halfBz + 10);
    ctx.stroke();

    // 3. 繪製節線 (Nodal lines where ΔE(k) = 0)
    if (mode === 'altermagnet_d' || mode === 'altermagnet_g') {
      ctx.save();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      const angles = mode === 'altermagnet_d' ? [45, 135] : [0, 60, 120];
      angles.forEach((deg) => {
        const rad = (deg * Math.PI) / 180;
        const dx = Math.cos(rad) * halfBz * 1.15;
        const dy = -Math.sin(rad) * halfBz * 1.15;
        ctx.beginPath();
        ctx.moveTo(cx - dx, cy - dy);
        ctx.lineTo(cx + dx, cy + dy);
        ctx.stroke();
      });
      ctx.restore();
    }

    // 4. 透過 Marching / 角度採樣繪製 E_↑(k) = 0 與 E_↓(k) = 0 等能面輪廓
    const drawFermiContour = (spinSign: 1 | -1, color: string, lineWidth: number, dashed = false) => {
      const steps = 160;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      if (dashed) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      let started = false;

      for (let i = 0; i <= steps; i++) {
        const ang = (i / steps) * Math.PI * 2;
        const dirX = Math.cos(ang);
        const dirY = Math.sin(ang);

        // 在半徑 r ∈ [0.15, π] 上用二分法尋找 E_spin(r cosθ, r sinθ) = 0 (費米面)
        let rLow = 0.15;
        let rHigh = Math.PI * 0.96;
        const evalSpin = (r: number) => {
          const kx = r * dirX;
          const ky = r * dirY;
          return evaluateBaseDispersion(mode, kx, ky) + spinSign * effectiveJ * evaluateFormFactor(mode, kx, ky);
        };

        let fLow = evalSpin(rLow);
        let fHigh = evalSpin(rHigh);
        let rStar = 1.75;

        if (fLow * fHigh <= 0) {
          for (let it = 0; it < 16; it++) {
            const rMid = 0.5 * (rLow + rHigh);
            const fMid = evalSpin(rMid);
            if (fLow * fMid <= 0) {
              rHigh = rMid;
              fHigh = fMid;
            } else {
              rLow = rMid;
              fLow = fMid;
            }
          }
          rStar = 0.5 * (rLow + rHigh);
        } else {
          // 若極端劈裂將整個能帶推出費米面外，夾緊在可見半徑
          rStar = fLow > 0 ? 0.35 : Math.PI * 0.92;
        }

        const px = cx + (rStar * dirX / Math.PI) * halfBz;
        const py = cy - (rStar * dirY / Math.PI) * halfBz;
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };

    const isDegenerateEverywhere = mode === 'conventional_afm' || tempRatio >= 1.0 || exchangeJ === 0;
    if (isDegenerateEverywhere) {
      drawFermiContour(1, '#fbbf24', 2.6, false);
    } else {
      drawFermiContour(1, '#38bdf8', 2.4, false);
      drawFermiContour(-1, '#fb7185', 2.4, false);
    }

    // 5. 繪製當前動量掃描切線 θ_k
    const cutRad = (thetaDeg * Math.PI) / 180;
    const cutDx = Math.cos(cutRad) * (halfBz + 8);
    const cutDy = -Math.sin(cutRad) * (halfBz + 8);
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - cutDx, cy - cutDy);
    ctx.lineTo(cx + cutDx, cy + cutDy);
    ctx.stroke();

    // 切線端點圓點
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(cx + cutDx, cy + cutDy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 標籤與圖例
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Γ', cx - 8, cy + 12);
    ctx.fillText('+kₓ', cx + halfBz + 16, cy + 4);
    ctx.fillText('+kᵧ', cx, cy - halfBz - 8);

    ctx.textAlign = 'left';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('動量空間等能面自旋劈裂 (kₓ, kᵧ)', 12, 18);

    // 圖例小點
    ctx.font = '10px sans-serif';
    if (isDegenerateEverywhere) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('● E↑ = E↓ (克萊默斯簡併重合)', 12, cssH - 10);
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('● 自旋 ↑ 費米面', 12, cssH - 10);
      ctx.fillStyle = '#fb7185';
      ctx.fillText('● 自旋 ↓ 費米面', 112, cssH - 10);
      if (mode === 'altermagnet_d' || mode === 'altermagnet_g') {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('┄ 節線 (ΔE=0)', 212, cssH - 10);
      }
    }
  }, [mode, exchangeJ, thetaDeg, tempRatio, effectiveJ]);

  // 繪製沿 θ_k 切線的一維能帶色散 E_↑(k), E_↓(k)
  useEffect(() => {
    const canvas = bandCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const cssW = 560;
    const cssH = 200;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, cssW, cssH);

    const padL = 56;
    const padR = 20;
    const padT = 34;
    const padB = 28;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;
    const midY = padT + plotH * 0.52;
    const eScale = plotH / 1200; // +-600 meV

    // 費米能階 E_F = 0 水平虛線
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, midY);
    ctx.lineTo(padL + plotW, midY);
    ctx.stroke();
    ctx.restore();

    // 垂直 Γ 點中心線
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL + plotW / 2, padT);
    ctx.lineTo(padL + plotW / 2, padT + plotH);
    ctx.stroke();

    const rad = (thetaDeg * Math.PI) / 180;
    const dirX = Math.cos(rad);
    const dirY = Math.sin(rad);

    const nPts = 180;
    const upPts: { x: number; y: number; e: number }[] = [];
    const dnPts: { x: number; y: number; e: number }[] = [];

    for (let i = 0; i <= nPts; i++) {
      const s = (i / nPts) * 2 - 1; // -1 to +1
      const kMag = s * Math.PI;
      const kx = kMag * dirX;
      const ky = kMag * dirY;
      const e0 = evaluateBaseDispersion(mode, kx, ky);
      const jK = effectiveJ * evaluateFormFactor(mode, kx, ky);
      const eUp = e0 + jK;
      const eDn = e0 - jK;

      const x = padL + (i / nPts) * plotW;
      upPts.push({ x, y: midY - eUp * eScale, e: eUp });
      dnPts.push({ x, y: midY - eDn * eScale, e: eDn });
    }

    // 在兩條自旋能帶之間填上微弱陰影帶突出劈裂差距
    if (!isOnNode) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.beginPath();
      upPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      for (let i = dnPts.length - 1; i >= 0; i--) {
        ctx.lineTo(dnPts[i].x, dnPts[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    const strokeCurve = (pts: { x: number; y: number }[], color: string, width: number, dashed = false) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dashed) ctx.setLineDash([6, 4]);
      ctx.beginPath();
      pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
    };

    if (isOnNode) {
      strokeCurve(upPts, '#fbbf24', 2.8, false);
    } else {
      strokeCurve(upPts, '#38bdf8', 2.4, false);
      strokeCurve(dnPts, '#fb7185', 2.4, false);
    }

    // 在 k ≈ +1.75 處繪製 ΔE 垂直標尺箭頭
    const probeIdx = Math.round(((1.75 / Math.PI + 1) * 0.5) * nPts);
    const pUp = upPts[probeIdx];
    const pDn = dnPts[probeIdx];
    if (pUp && pDn && Math.abs(pUp.y - pDn.y) > 8) {
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(pUp.x, pUp.y);
      ctx.lineTo(pDn.x, pDn.y);
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `ΔE = ${Math.abs(splitAtCutMeV).toFixed(0)} meV`,
        pUp.x + 8,
        0.5 * (pUp.y + pDn.y) + 4
      );
      ctx.restore();
    }

    // 軸標籤與標題
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `沿 θ_k = ${thetaDeg}° 色散 E↑(k), E↓(k)`,
      padL,
      19
    );

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('E_F = 0', padL - 6, midY + 4);
    ctx.fillText('+500', padL - 6, midY - 500 * eScale + 4);
    ctx.fillText('-500', padL - 6, midY + 500 * eScale + 4);

    ctx.textAlign = 'center';
    ctx.fillText('-k', padL + 16, cssH - 8);
    ctx.fillText('Γ (k = 0)', padL + plotW / 2, cssH - 8);
    ctx.fillText('+k', padL + plotW - 16, cssH - 8);

    if (isOnNode) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 11.5px sans-serif';
      ctx.fillText(
        tempRatio >= 1.0
          ? 'T ≥ T_N 順磁相：簡併恢復'
          : mode === 'conventional_afm'
          ? '平移/反演保護：簡併 (E↑=E↓)'
          : '落於節線：劈裂歸零 (E↑=E↓)',
        cssW - padR,
        19
      );
    }
  }, [mode, thetaDeg, effectiveJ, isOnNode, splitAtCutMeV, tempRatio]);

  // 實空間 SVG 子晶格節點座標與配位幾何
  const realSpaceSites = useMemo(() => {
    if (mode === 'altermagnet_g') {
      // 六方晶格 (α-MnTe 類交錯配位示意)
      return [
        { x: 110, y: 80, sub: 'A' as const, angle: 0 },
        { x: 250, y: 80, sub: 'B' as const, angle: 60 },
        { x: 110, y: 185, sub: 'B' as const, angle: 60 },
        { x: 250, y: 185, sub: 'A' as const, angle: 0 },
      ];
    }
    return [
      { x: 110, y: 82, sub: 'A' as const, angle: 0 },
      { x: 250, y: 82, sub: 'B' as const, angle: mode === 'altermagnet_d' ? 90 : 0 },
      { x: 110, y: 182, sub: 'B' as const, angle: mode === 'altermagnet_d' ? 90 : 0 },
      { x: 250, y: 182, sub: 'A' as const, angle: 0 },
    ];
  }, [mode]);

  const isParamagnetic = tempRatio >= 1.0;

  return (
    <div className="my-8 w-full max-w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-3.5 sm:p-5 text-slate-100 shadow-2xl">
      {/* 頂部標題與模型示意註記 */}
      <div className="flex flex-col gap-3 border-b border-slate-700/80 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-cyan-300">
              交錯磁性自旋群對稱與動量空間自旋劈裂模擬器
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              對照實空間非磁性原子配位對稱性、二維等能面劈裂與沿切線角度 θ<sub>k</sub> 的色散能帶變化
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center self-start rounded-full border border-cyan-500/30 bg-cyan-950/60 px-2.5 py-1 font-mono text-[11px] font-semibold text-cyan-300">
            {meta.symmetryTag}
          </span>
        </div>

        {/* 磁相四模式切換列 */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {ORDER_LIST.map((mId) => {
            const item = PHASE_META[mId];
            const active = mode === mId;
            return (
              <button
                key={mId}
                type="button"
                onClick={() => {
                  setMode(mId);
                  if (mId === 'altermagnet_d' && (thetaDeg === 0 || thetaDeg === 60)) {
                    setThetaDeg(15);
                  } else if (mId === 'altermagnet_g' && thetaDeg === 45) {
                    setThetaDeg(30);
                  }
                }}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition text-center ${
                  active
                    ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400/50'
                    : 'border border-slate-700/80 bg-slate-950/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {item.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* 雙視圖聯動區：實空間晶格 (左) + 動量空間費米面 (右) */}
      <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {/* 左視圖：實空間晶格與配位環境 */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2.5">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-200">
              實空間：磁性子晶格與非磁性配位環境
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {isParamagnetic ? '順磁無序態' : mode === 'ferromagnet' ? '同向自旋' : '共線反平行'}
            </span>
          </div>
          <svg
            viewBox="0 0 360 262"
            className="block w-full h-auto rounded-lg bg-[#050814]"
            role="img"
            aria-label="實空間磁性子晶格與非磁性周圍原子配位旋轉示意"
          >
            {/* 晶格連線 */}
            <g stroke="#1e293b" strokeWidth="1.5" strokeDasharray="4 4">
              <line x1="110" y1="82" x2="250" y2="82" />
              <line x1="110" y1="182" x2="250" y2="182" />
              <line x1="110" y1="82" x2="110" y2="182" />
              <line x1="250" y1="82" x2="250" y2="182" />
            </g>

            {/* 對稱操作指示箭頭 */}
            <g>
              <path
                d="M 142 132 Q 180 108 218 132"
                fill="none"
                stroke={mode === 'conventional_afm' ? '#10b981' : '#fbbf24'}
                strokeWidth="1.4"
                strokeDasharray="3 3"
              />
              <text
                x="180"
                y="112"
                textAnchor="middle"
                fill={mode === 'conventional_afm' ? '#34d399' : '#fbbf24'}
                fontSize="10"
                fontFamily="monospace"
              >
                {mode === 'ferromagnet'
                  ? '平移 t (自旋同向)'
                  : mode === 'conventional_afm'
                  ? '[C₂ ∥ t] 平移+翻轉'
                  : mode === 'altermagnet_d'
                  ? '[C₂ ∥ C₄] 旋轉90°+翻轉'
                  : '[C₂ ∥ C₆] 旋轉60°+翻轉'}
              </text>
            </g>

            {/* 繪製各磁格點與周圍非磁性配位籠 */}
            {realSpaceSites.map((site, idx) => {
              const isSpinUp =
                mode === 'ferromagnet' ? true : site.sub === 'A';
              const spinColor = isParamagnetic
                ? '#64748b'
                : isSpinUp
                ? '#38bdf8'
                : '#fb7185';
              const cageColor =
                site.sub === 'A' ? 'rgba(56, 189, 248, 0.32)' : 'rgba(251, 113, 133, 0.32)';
              const rx = mode === 'conventional_afm' || mode === 'ferromagnet' ? 28 : 34;
              const ry = mode === 'conventional_afm' || mode === 'ferromagnet' ? 28 : 20;

              return (
                <g key={idx} transform={`translate(${site.x}, ${site.y})`}>
                  {/* 周圍非磁性陰離子配位幾何（各向異性八面體／菱形投影） */}
                  <g transform={`rotate(${site.angle})`}>
                    <ellipse
                      cx="0"
                      cy="0"
                      rx={rx}
                      ry={ry}
                      fill={
                        mode === 'conventional_afm' || mode === 'ferromagnet'
                          ? 'rgba(148, 163, 184, 0.10)'
                          : cageColor
                      }
                      stroke={
                        mode === 'conventional_afm' || mode === 'ferromagnet'
                          ? '#475569'
                          : isSpinUp
                          ? '#0284c7'
                          : '#e11d48'
                      }
                      strokeWidth="1.3"
                    />
                    {/* 兩側非磁性配位原子 (如 O / Te) */}
                    <circle cx={-rx} cy="0" r="4.5" fill="#94a3b8" />
                    <circle cx={rx} cy="0" r="4.5" fill="#94a3b8" />
                    {mode === 'altermagnet_g' && (
                      <>
                        <circle cx={rx * 0.5} cy={ry * 0.85} r="3.6" fill="#64748b" />
                        <circle cx={-rx * 0.5} cy={-ry * 0.85} r="3.6" fill="#64748b" />
                      </>
                    )}
                  </g>

                  {/* 中心磁性原子圓點 */}
                  <circle cx="0" cy="0" r="11" fill="#0f172a" stroke={spinColor} strokeWidth="2" />

                  {/* 自旋方向箭頭 */}
                  {isParamagnetic ? (
                    <g transform={`rotate(${idx * 67 + 25})`}>
                      <line x1="0" y1="6" x2="0" y2="-6" stroke="#94a3b8" strokeWidth="1.8" />
                      <polygon points="0,-8 -3,-3 3,-3" fill="#94a3b8" />
                    </g>
                  ) : isSpinUp ? (
                    <g>
                      <line x1="0" y1="7" x2="0" y2="-6" stroke={spinColor} strokeWidth="2.2" />
                      <polygon points="0,-9 -3.5,-3 3.5,-3" fill={spinColor} />
                    </g>
                  ) : (
                    <g>
                      <line x1="0" y1="-7" x2="0" y2="6" stroke={spinColor} strokeWidth="2.2" />
                      <polygon points="0,9 -3.5,3 3.5,3" fill={spinColor} />
                    </g>
                  )}

                  <text
                    x="0"
                    y="45"
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="9.5"
                    fontFamily="monospace"
                  >
                    {isParamagnetic
                      ? `格點 ${site.sub} (熱擾亂)`
                      : isSpinUp
                      ? `子晶格 ${site.sub} (↑)`
                      : `子晶格 ${site.sub} (↓)`}
                  </text>
                </g>
              );
            })}

            {/* 底部配位圖例 */}
            <g transform="translate(14, 248)">
              <circle cx="4" cy="-3" r="3.5" fill="#94a3b8" />
              <text x="12" y="0" fill="#94a3b8" fontSize="10">
                非磁性配位原子（如 O / Te）：決定子晶格間的旋轉對稱與交換通道差異
              </text>
            </g>
          </svg>
        </div>

        {/* 右視圖：動量空間 (kx, ky) 等能面自旋劈裂 */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2.5">
          <canvas
            ref={fermiCanvasRef}
            className="block w-full h-auto rounded-lg"
          />
        </div>
      </div>

      {/* 一維色散切片 E_↑(k), E_↓(k) */}
      <div className="mt-3.5 min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2.5">
        <canvas
          ref={bandCanvasRef}
          className="block w-full h-auto rounded-lg"
        />
      </div>

      {/* 即時觀測讀數面板 */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">宏觀淨磁化強度 M</div>
          <div
            className={`mt-1 font-mono text-sm sm:text-base font-bold ${
              netMagnetizationRatio > 0.01 ? 'text-sky-400' : 'text-emerald-400'
            }`}
          >
            {netMagnetizationRatio > 0.01
              ? `${(netMagnetizationRatio * 100).toFixed(0)}% M_s (≠ 0)`
              : '0.00 (M = 0)'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">切線動量劈裂 ΔE(θ<sub>k</sub>)</div>
          <div
            className={`mt-1 font-mono text-sm sm:text-base font-bold ${
              isOnNode ? 'text-amber-400' : 'text-cyan-300'
            }`}
          >
            {isOnNode ? '0.0 meV (簡併)' : `${splitAtCutMeV > 0 ? '+' : ''}${splitAtCutMeV.toFixed(0)} meV`}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">磁序參數 m(T)</div>
          <div
            className={`mt-1 font-mono text-sm sm:text-base font-bold ${
              isParamagnetic ? 'text-amber-400' : 'text-slate-100'
            }`}
          >
            {isParamagnetic ? '0.00 (T ≥ T_N 順磁)' : orderParameter.toFixed(2)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">能帶簡併狀態</div>
          <div className="mt-1 text-xs font-semibold leading-snug text-slate-200">
            {isParamagnetic
              ? '克萊默斯簡併恢復'
              : mode === 'conventional_afm'
              ? '全區簡併受保護'
              : mode === 'ferromagnet'
              ? '全區極化劈裂'
              : isOnNode
              ? '切線命中對稱節線'
              : '非相對論劈裂開啟'}
          </div>
        </div>
      </div>

      {/* 互動滑桿控制區 */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* 1. 交換耦合劈裂強度 J_ex */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">交換耦合劈裂強度 J<sub>ex</sub></span>
            <span className="font-mono font-bold text-cyan-300">{exchangeJ} meV</span>
          </div>
          <input
            type="range"
            min={0}
            max={400}
            step={10}
            value={exchangeJ}
            onChange={(e) => setExchangeJ(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-cyan-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0 meV</span>
            <span>α-MnTe 實測 ~100–370</span>
            <span>400 meV</span>
          </div>
        </div>

        {/* 2. 動量掃描切角 θ_k */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">動量切線角度 θ<sub>k</sub></span>
            <span className="font-mono font-bold text-amber-300">{thetaDeg}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={180}
            step={1}
            value={thetaDeg}
            onChange={(e) => setThetaDeg(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-amber-500"
          />
          <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-slate-400">
            <button
              type="button"
              onClick={() =>
                setThetaDeg(mode === 'altermagnet_d' ? 45 : mode === 'altermagnet_g' ? 60 : 45)
              }
              className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-slate-300 hover:bg-slate-800"
            >
              跳至節線
            </button>
            <button
              type="button"
              onClick={() =>
                setThetaDeg(mode === 'altermagnet_d' ? 0 : mode === 'altermagnet_g' ? 30 : 0)
              }
              className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-cyan-300 hover:bg-slate-800"
            >
              跳至反節點 (最大劈裂)
            </button>
          </div>
        </div>

        {/* 3. 等效溫度 T / T_N */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">約化溫度 T / T<sub>N</sub></span>
            <span
              className={`font-mono font-bold ${
                isParamagnetic ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {tempRatio.toFixed(2)} {isParamagnetic ? '(> 1.0)' : '(< 1.0)'}
            </span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1.3}
            step={0.05}
            value={tempRatio}
            onChange={(e) => setTempRatio(parseFloat(e.target.value))}
            className="mt-2 w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0.10 低溫有序</span>
            <span>1.00 相變點</span>
            <span>1.30 順磁態</span>
          </div>
        </div>
      </div>

      {/* 機制解讀與模型限制宣告 */}
      <div className="mt-4 space-y-2 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-300">
        <p>
          <strong className="text-cyan-300">{meta.label}：</strong>
          {meta.description}
        </p>
        <p className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
          模型示意：緊束縛有效哈密頓量 E<sub>±</sub>(k) = E<sub>0</sub>(k) ± J(k) 用於揭示自旋群對稱與動量空間自旋劈裂機制，非特定材料的完整第一性原理 DFT 能帶。
        </p>
      </div>
    </div>
  );
};
