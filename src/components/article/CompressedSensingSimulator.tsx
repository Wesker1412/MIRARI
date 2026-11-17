import React, { useState, useEffect, useRef, useMemo } from 'react';

type NormHighlight = 'all' | 'l1' | 'l2' | 'l05';
type RecoveryMode = 'random_l1' | 'random_l2' | 'uniform';

const N_SIGNAL = 64;
const SPARSE_SUPPORT = [5, 13, 22, 29, 37, 44, 51, 58];
const SPARSE_AMPS = [1.0, -0.88, 0.76, 0.92, -0.71, 0.81, -0.64, 0.73];

/**
 * 預計算 N = 64 正交離散餘弦變換矩陣 (Orthonormal DCT-II)
 * 滿足 Psi^T * Psi = I_64 與 Psi * Psi^T = I_64
 */
const DCT_MATRIX: number[][] = Array.from({ length: N_SIGNAL }, (_, n) =>
  Array.from({ length: N_SIGNAL }, (_, k) => {
    const scale = k === 0 ? Math.sqrt(1 / N_SIGNAL) : Math.sqrt(2 / N_SIGNAL);
    return scale * Math.cos((Math.PI * k * (n + 0.5)) / N_SIGNAL);
  })
);

function createSeededPermutation(n: number, seedInit: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  let seed = seedInit >>> 0;
  for (let i = n - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export const CompressedSensingSimulator: React.FC = () => {
  // === 面板一：二維 (x1, x2) 凸幾何膨脹狀態 ===
  const [radiusR, setRadiusR] = useState<number>(1.59);
  const [planeAngleDeg, setPlaneAngleDeg] = useState<number>(28);
  const [normFocus, setNormFocus] = useState<NormHighlight>('all');
  const [isAnimatingBall, setIsAnimatingBall] = useState<boolean>(false);
  const geomCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // === 面板二：一維 N = 64 ISTA 稀疏頻譜重建狀態 ===
  const [sparsityK, setSparsityK] = useState<number>(4);
  const [samplesM, setSamplesM] = useState<number>(22);
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>('random_l1');
  const [seedOffset, setSeedOffset] = useState<number>(0);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const specCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 面板一自動膨脹動畫
  useEffect(() => {
    if (!isAnimatingBall) return;
    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      setRadiusR((prev) => {
        const next = prev + dt * 0.65;
        if (next >= 2.15) {
          setIsAnimatingBall(false);
          return 2.15;
        }
        return Number(next.toFixed(3));
      });
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isAnimatingBall]);

  // 計算面板一精確幾何解：a1 * x1 + a2 * x2 = b
  const geomData = useMemo(() => {
    const b = 1.4;
    const rad = (planeAngleDeg * Math.PI) / 180;
    const a1 = Math.cos(rad);
    const a2 = Math.sin(rad);

    // ℓ2 最小能量正交投影
    const denom2 = a1 * a1 + a2 * a2; // = 1
    const r2Star = b / Math.sqrt(denom2);
    const l2Pt = { x1: (b * a1) / denom2, x2: (b * a2) / denom2 };

    // ℓ1 最小菱形半徑與切點
    const maxAbsA = Math.max(Math.abs(a1), Math.abs(a2));
    const r1Star = b / maxAbsA;
    const isDegenerate45 = Math.abs(Math.abs(a1) - Math.abs(a2)) < 1e-3;
    const l1Pt =
      Math.abs(a1) >= Math.abs(a2)
        ? { x1: b / a1, x2: 0 }
        : { x1: 0, x2: b / a2 };

    return {
      b,
      a1,
      a2,
      r2Star,
      l2Pt,
      r1Star,
      l1Pt,
      isDegenerate45,
      l2Reached: radiusR >= r2Star - 1e-3,
      l1Reached: radiusR >= r1Star - 1e-3,
    };
  }, [planeAngleDeg, radiusR]);

  // 繪製面板一：二維 (x1, x2) 凸幾何膨脹 Canvas
  useEffect(() => {
    const canvas = geomCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const cssW = 380;
    const cssH = 310;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, cssW, cssH);

    const cx = cssW * 0.44;
    const cy = cssH * 0.56;
    const scale = 68; // 1 單位 = 68 px
    const toPx = (x1: number, x2: number) => ({
      px: cx + x1 * scale,
      py: cy - x2 * scale,
    });

    // 1. 背景網格
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
    ctx.lineWidth = 1;
    for (let g = -2; g <= 3; g++) {
      const gx = cx + g * scale;
      if (gx > 12 && gx < cssW - 12) {
        ctx.beginPath();
        ctx.moveTo(gx, 14);
        ctx.lineTo(gx, cssH - 14);
        ctx.stroke();
      }
      const gy = cy - g * scale;
      if (gy > 14 && gy < cssH - 14) {
        ctx.beginPath();
        ctx.moveTo(14, gy);
        ctx.lineTo(cssW - 14, gy);
        ctx.stroke();
      }
    }

    // 2. 座標軸
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(16, cy);
    ctx.lineTo(cssW - 16, cy);
    ctx.moveTo(cx, cssH - 16);
    ctx.lineTo(cx, 16);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('x₁', cssW - 18, cy - 7);
    ctx.textAlign = 'left';
    ctx.fillText('x₂', cx + 7, 24);

    // 3. 繪製三種範數球 (半徑為當前 radiusR)
    const showL2 = normFocus === 'all' || normFocus === 'l2';
    const showL1 = normFocus === 'all' || normFocus === 'l1';
    const showL05 = normFocus === 'all' || normFocus === 'l05';

    // 3a. ℓ2 圓盤
    if (showL2) {
      const alpha = normFocus === 'l2' ? 0.24 : 0.11;
      ctx.save();
      ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = normFocus === 'l2' ? 2.6 : 1.9;
      ctx.beginPath();
      ctx.arc(cx, cy, radiusR * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 3b. ℓ1 菱形多胞體 (|x1| + |x2| <= r)
    if (showL1) {
      const alpha = normFocus === 'l1' ? 0.26 : 0.14;
      const pTop = toPx(0, radiusR);
      const pRight = toPx(radiusR, 0);
      const pBottom = toPx(0, -radiusR);
      const pLeft = toPx(-radiusR, 0);
      ctx.save();
      ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = normFocus === 'l1' ? 2.8 : 2.1;
      ctx.beginPath();
      ctx.moveTo(pTop.px, pTop.py);
      ctx.lineTo(pRight.px, pRight.py);
      ctx.lineTo(pBottom.px, pBottom.py);
      ctx.lineTo(pLeft.px, pLeft.py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 3c. ℓ0.5 非凸星形 ((|x1|^0.5 + |x2|^0.5)^2 <= r)
    if (showL05) {
      const alpha = normFocus === 'l05' ? 0.25 : 0.12;
      ctx.save();
      ctx.fillStyle = `rgba(244, 114, 182, ${alpha})`;
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = normFocus === 'l05' ? 2.5 : 1.7;
      ctx.beginPath();
      const segs = 120;
      for (let i = 0; i <= segs; i++) {
        const t = (i / segs) * Math.PI * 2;
        const c = Math.cos(t);
        const s = Math.sin(t);
        // 參數化 (|x1|^0.5 + |x2|^0.5) = r^0.5 => x1 = r * sgn(c) * c^4, x2 = r * sgn(s) * s^4
        const x1 = radiusR * Math.sign(c) * Math.pow(Math.abs(c), 4);
        const x2 = radiusR * Math.sign(s) * Math.pow(Math.abs(s), 4);
        const pt = toPx(x1, x2);
        if (i === 0) ctx.moveTo(pt.px, pt.py);
        else ctx.lineTo(pt.px, pt.py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 4. 繪製欠定測量超平面直線 a1*x1 + a2*x2 = b
    const { a1, a2, b, l2Pt, l1Pt, l2Reached, l1Reached } = geomData;
    const x1Min = -1.6;
    const x1Max = 3.2;
    const pLineA = toPx(x1Min, (b - a1 * x1Min) / a2);
    const pLineB = toPx(x1Max, (b - a1 * x1Max) / a2);

    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(pLineA.px, pLineA.py);
    ctx.lineTo(pLineB.px, pLineB.py);
    ctx.stroke();
    ctx.restore();

    // 標註測量直線方程式
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 10.5px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${a1.toFixed(2)}x₁ + ${a2.toFixed(2)}x₂ = ${b.toFixed(1)}`,
      16,
      20
    );

    // 5. 標註首撞切點
    if (showL2 && l2Reached) {
      const p2 = toPx(l2Pt.x1, l2Pt.x2);
      ctx.save();
      // 畫原點到 l2Pt 的法線虛線
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p2.px, p2.py, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#bae6fd';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `ℓ₂ (${l2Pt.x1.toFixed(2)}, ${l2Pt.x2.toFixed(2)})`,
        p2.px + 8,
        p2.py - 6
      );
      ctx.restore();
    }

    if ((showL1 || showL05) && l1Reached) {
      const p1 = toPx(l1Pt.x1, l1Pt.x2);
      ctx.save();
      ctx.fillStyle = '#34d399';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p1.px, p1.py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#6ee7b7';
      ctx.font = 'bold 10.5px monospace';
      ctx.textAlign = 'left';
      const labelOffsetX = l1Pt.x1 > 0.5 ? -86 : 10;
      const labelOffsetY = l1Pt.x2 > 0.5 ? -10 : 18;
      ctx.fillText(
        `ℓ₁ 頂點 (${l1Pt.x1.toFixed(2)}, ${l1Pt.x2.toFixed(2)})`,
        p1.px + labelOffsetX,
        p1.py + labelOffsetY
      );
      ctx.restore();
    }
  }, [geomData, normFocus, radiusR]);

  // === 面板二真實數值引擎：N = 64 DCT-II + ISTA / L2 / Uniform ===
  const recoveryResult = useMemo(() => {
    const xTrue = new Float64Array(N_SIGNAL);
    for (let j = 0; j < sparsityK; j++) {
      xTrue[SPARSE_SUPPORT[j]] = SPARSE_AMPS[j];
    }

    // sTrue = Psi * xTrue
    const sTrue = new Float64Array(N_SIGNAL);
    for (let n = 0; n < N_SIGNAL; n++) {
      let sum = 0;
      const row = DCT_MATRIX[n];
      for (let k = 0; k < N_SIGNAL; k++) sum += row[k] * xTrue[k];
      sTrue[n] = sum;
    }

    // 建構採樣索引子集 Omega (|Omega| = M)
    const omega: number[] = [];
    if (recoveryMode === 'uniform') {
      for (let m = 0; m < samplesM; m++) {
        omega.push(Math.floor((m * N_SIGNAL) / samplesM));
      }
    } else {
      const perm = createSeededPermutation(
        N_SIGNAL,
        4242 + sparsityK * 13 + samplesM * 7 + seedOffset * 97
      );
      for (let m = 0; m < samplesM; m++) omega.push(perm[m]);
      omega.sort((a, b) => a - b);
    }

    // 量測向量 y = sTrue[omega]
    const y = omega.map((n) => sTrue[n]);

    const applyA = (x: Float64Array): Float64Array => {
      const out = new Float64Array(samplesM);
      for (let m = 0; m < samplesM; m++) {
        const row = DCT_MATRIX[omega[m]];
        let s = 0;
        for (let k = 0; k < N_SIGNAL; k++) s += row[k] * x[k];
        out[m] = s;
      }
      return out;
    };

    const applyAT = (v: ArrayLike<number>): Float64Array => {
      const out = new Float64Array(N_SIGNAL);
      for (let m = 0; m < samplesM; m++) {
        const row = DCT_MATRIX[omega[m]];
        const vm = v[m];
        for (let k = 0; k < N_SIGNAL; k++) out[k] += row[k] * vm;
      }
      return out;
    };

    const xRec = new Float64Array(N_SIGNAL);
    if (recoveryMode === 'random_l2' || recoveryMode === 'uniform') {
      // 因為 DCT_MATRIX 列正交，A * A^T = I_M，故最小能量 pseudoinverse 精確等於 A^T * y
      const aty = applyAT(y);
      xRec.set(aty);
    } else {
      // 真正執行 450 步 ISTA (Iterative Shrinkage-Thresholding Algorithm) 凸優化求解 ℓ1 稀疏恢復
      const aty = applyAT(y);
      let maxATy = 0;
      for (let k = 0; k < N_SIGNAL; k++) {
        const a = Math.abs(aty[k]);
        if (a > maxATy) maxATy = a;
      }
      const res = new Float64Array(samplesM);
      for (let iter = 0; iter < 450; iter++) {
        const lam = Math.max(0.0012, maxATy * 0.5 * Math.pow(0.978, iter));
        const ax = applyA(xRec);
        for (let m = 0; m < samplesM; m++) res[m] = ax[m] - y[m];
        const grad = applyAT(res);
        for (let k = 0; k < N_SIGNAL; k++) {
          const z = xRec[k] - grad[k];
          const mag = Math.abs(z) - lam;
          xRec[k] = mag > 0 ? Math.sign(z) * mag : 0;
        }
      }
    }

    // 重建時域波形 sRec = Psi * xRec
    const sRec = new Float64Array(N_SIGNAL);
    for (let n = 0; n < N_SIGNAL; n++) {
      let sum = 0;
      const row = DCT_MATRIX[n];
      for (let k = 0; k < N_SIGNAL; k++) sum += row[k] * xRec[k];
      sRec[n] = sum;
    }

    // 計算頻譜相對 RMSE
    let err2 = 0;
    let norm2 = 0;
    for (let k = 0; k < N_SIGNAL; k++) {
      err2 += (xRec[k] - xTrue[k]) * (xRec[k] - xTrue[k]);
      norm2 += xTrue[k] * xTrue[k];
    }
    const relRmse = Math.sqrt(err2 / Math.max(1e-12, norm2));
    const isExactSuccess = recoveryMode === 'random_l1' && relRmse < 0.05;

    return {
      xTrue,
      sTrue,
      xRec,
      sRec,
      omega,
      relRmse,
      isExactSuccess,
    };
  }, [sparsityK, samplesM, recoveryMode, seedOffset]);

  // 繪製面板二 A：時域波形與欠採樣點 Canvas
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const cssW = 460;
    const cssH = 175;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, cssW, cssH);

    const padL = 36;
    const padR = 14;
    const padT = 26;
    const padB = 24;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;
    const midY = padT + plotH / 2;

    const { sTrue, sRec, omega, isExactSuccess } = recoveryResult;
    let maxAmp = 0.4;
    for (let n = 0; n < N_SIGNAL; n++) {
      maxAmp = Math.max(maxAmp, Math.abs(sTrue[n]), Math.abs(sRec[n]));
    }
    const yScale = (plotH * 0.44) / maxAmp;

    // 參考零線與格線
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, midY);
    ctx.lineTo(cssW - padR, midY);
    ctx.stroke();

    // 繪製真實波形 (灰色虛線)
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (let n = 0; n < N_SIGNAL; n++) {
      const x = padL + (n / (N_SIGNAL - 1)) * plotW;
      const y = midY - sTrue[n] * yScale;
      if (n === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // 繪製重建波形 (實線)
    const recColor =
      recoveryMode === 'random_l1'
        ? isExactSuccess
          ? '#34d399'
          : '#f59e0b'
        : recoveryMode === 'random_l2'
        ? '#38bdf8'
        : '#fb7185';
    ctx.save();
    ctx.strokeStyle = recColor;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    for (let n = 0; n < N_SIGNAL; n++) {
      const x = padL + (n / (N_SIGNAL - 1)) * plotW;
      const y = midY - sRec[n] * yScale;
      if (n === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // 繪製 M 個欠採樣點
    ctx.fillStyle = '#fbbf24';
    for (const n of omega) {
      const x = padL + (n / (N_SIGNAL - 1)) * plotW;
      const y = midY - sTrue[n] * yScale;
      ctx.beginPath();
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 標題與圖例
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`時域訊號波形與 ${samplesM} 個採樣點 (N = 64)`, padL, 16);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('--- 真實訊號', cssW - 185, 16);
    ctx.fillStyle = recColor;
    ctx.fillText('── 重建波形', cssW - 102, 16);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('n = 0', padL + 8, cssH - 7);
    ctx.fillText('時域索引 n', padL + plotW / 2, cssH - 7);
    ctx.fillText('n = 63', cssW - padR - 12, cssH - 7);
  }, [recoveryResult, recoveryMode, samplesM]);

  // 繪製面板二 B：DCT 頻譜係數對照 Canvas
  useEffect(() => {
    const canvas = specCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const cssW = 460;
    const cssH = 180;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, cssW, cssH);

    const padL = 36;
    const padR = 14;
    const padT = 26;
    const padB = 24;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;
    const midY = padT + plotH / 2;

    const { xTrue, xRec, isExactSuccess } = recoveryResult;
    const barW = Math.max(2.5, plotW / N_SIGNAL - 1.5);
    const yScale = plotH * 0.43;

    // 零線
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, midY);
    ctx.lineTo(cssW - padR, midY);
    ctx.stroke();

    const recColor =
      recoveryMode === 'random_l1'
        ? isExactSuccess
          ? '#34d399'
          : '#f59e0b'
        : recoveryMode === 'random_l2'
        ? '#38bdf8'
        : '#fb7185';

    for (let k = 0; k < N_SIGNAL; k++) {
      const cx = padL + ((k + 0.5) / N_SIGNAL) * plotW;

      // 真實係數外框
      if (Math.abs(xTrue[k]) > 1e-4) {
        const hTrue = xTrue[k] * yScale;
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(
          cx - barW / 2 - 0.8,
          hTrue >= 0 ? midY - hTrue : midY,
          barW + 1.6,
          Math.abs(hTrue)
        );
      }

      // 重建係數填色柱
      if (Math.abs(xRec[k]) > 0.004) {
        const hRec = Math.max(-plotH * 0.48, Math.min(plotH * 0.48, xRec[k] * yScale));
        ctx.fillStyle = recColor;
        ctx.fillRect(
          cx - barW / 2,
          hRec >= 0 ? midY - hRec : midY,
          barW,
          Math.abs(hRec)
        );
      }
    }

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`正交頻譜係數對照 (K = ${sparsityK} 個非零分量)`, padL, 16);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('□ 真實稀疏峰值', cssW - 188, 16);
    ctx.fillStyle = recColor;
    ctx.fillText('■ 重建係數', cssW - 92, 16);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('k = 0', padL + 10, cssH - 7);
    ctx.fillText('DCT 頻率索引 k', padL + plotW / 2, cssH - 7);
    ctx.fillText('k = 63', cssW - padR - 14, cssH - 7);
  }, [recoveryResult, recoveryMode, sparsityK]);

  const samplingPercent = ((samplesM / N_SIGNAL) * 100).toFixed(1);
  const rmsePercent = (recoveryResult.relRmse * 100).toFixed(2);

  return (
    <div className="my-8 w-full max-w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-3.5 sm:p-5 text-slate-100 shadow-2xl">
      {/* 總標題列 */}
      <div className="flex flex-col gap-2 border-b border-slate-700/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-bold tracking-wide text-cyan-300">
            壓縮感知雙重實驗室：凸幾何奇蹟與 ISTA 稀疏頻譜重建
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            左／上面板演示二維欠定系統中 ℓ₁ 菱形與 ℓ₂ 圓盤的撞擊幾何；右／下面板於瀏覽器實時執行 N = 64 訊號之真實 ISTA 凸優化
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center self-start rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-300">
          Basis Pursuit · ISTA 實時求解
        </span>
      </div>

      {/* 雙面板主區域 */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* === 面板一：二維 (x1, x2) 凸幾何氣球膨脹 === */}
        <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 p-3 lg:col-span-5">
          <div className="flex items-center justify-between gap-2 pb-2">
            <span className="text-xs font-bold text-emerald-300">
              面板一：二維欠定系統 (x₁, x₂) 範數球膨脹
            </span>
            <button
              type="button"
              onClick={() => {
                setRadiusR(0.2);
                setIsAnimatingBall(true);
              }}
              className="shrink-0 rounded-md border border-emerald-500/40 bg-emerald-950/70 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-900/70"
            >
              ▶ 膨脹動畫
            </button>
          </div>

          <div className="min-w-0 overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950">
            <canvas ref={geomCanvasRef} className="block w-full h-auto" />
          </div>

          {/* 範數切換列 */}
          <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
            {(
              [
                { id: 'all', label: '三者幾何疊加' },
                { id: 'l1', label: 'ℓ₁ 菱形 (凸)' },
                { id: 'l2', label: 'ℓ₂ 圓盤 (稠密)' },
                { id: 'l05', label: 'ℓ₀.₅ 星形 (非凸)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setNormFocus(opt.id)}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                  normFocus === opt.id
                    ? 'bg-cyan-600 text-white ring-1 ring-cyan-400/50'
                    : 'border border-slate-700/80 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 面板一滑桿 */}
          <div className="mt-2.5 space-y-2.5">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">膨脹半徑 r</span>
                <span className="font-mono font-bold text-emerald-300">
                  r = {radiusR.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={2.2}
                step={0.02}
                value={radiusR}
                onChange={(e) => {
                  setIsAnimatingBall(false);
                  setRadiusR(parseFloat(e.target.value));
                }}
                className="mt-1.5 w-full accent-emerald-400"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                <span>ℓ₂ 首撞 r* = {geomData.r2Star.toFixed(2)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAnimatingBall(false);
                    setRadiusR(Number(geomData.r1Star.toFixed(2)));
                  }}
                  className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-emerald-300 hover:bg-slate-800"
                >
                  跳至 ℓ₁ 首撞點 ({geomData.r1Star.toFixed(2)})
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">超平面傾角 θ</span>
                <span className="font-mono font-bold text-amber-300">{planeAngleDeg}°</span>
              </div>
              <input
                type="range"
                min={15}
                max={75}
                step={1}
                value={planeAngleDeg}
                onChange={(e) => setPlaneAngleDeg(parseInt(e.target.value, 10))}
                className="mt-1.5 w-full accent-amber-400"
              />
            </div>
          </div>

          {/* 面板一即時讀數 */}
          <div className="mt-2.5 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-lg border border-sky-500/25 bg-sky-950/30 px-2.5 py-1.5">
              <span className="font-semibold text-sky-300">ℓ₂ 圓盤切點：</span>
              <span className="font-mono text-slate-200">
                ({geomData.l2Pt.x1.toFixed(2)}, {geomData.l2Pt.x2.toFixed(2)})
              </span>
              <span className="ml-1.5 text-slate-400">（雙座標皆非零 → 稠密假訊號）</span>
            </div>
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/30 px-2.5 py-1.5">
              <span className="font-semibold text-emerald-300">ℓ₁ 菱形頂點：</span>
              <span className="font-mono text-slate-200">
                ({geomData.l1Pt.x1.toFixed(2)}, {geomData.l1Pt.x2.toFixed(2)})
              </span>
              <span className="ml-1.5 text-slate-400">
                {geomData.isDegenerate45
                  ? '（45° 退化邊界：整條邊同時相交）'
                  : '（精準撞擊座標軸 → 稀疏恢復）'}
              </span>
            </div>
          </div>
        </div>

        {/* === 面板二：一維 N = 64 ISTA 稀疏頻譜重建 === */}
        <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 p-3 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <span className="text-xs font-bold text-cyan-300">
              面板二：一維 N = 64 稀疏頻譜實時重建對決
            </span>
            <button
              type="button"
              onClick={() => setSeedOffset((s) => s + 1)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
            >
              重新抽取隨機遮罩 (#{seedOffset + 1})
            </button>
          </div>

          {/* 重建演算法切換列 */}
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {(
              [
                {
                  id: 'random_l1',
                  label: '隨機採樣 + ℓ₁ ISTA',
                  sub: '不相干投影 · 凸優化軟閾值',
                },
                {
                  id: 'random_l2',
                  label: '隨機採樣 + ℓ₂ 最小能量',
                  sub: 'Pseudoinverse · 能量彌散',
                },
                {
                  id: 'uniform',
                  label: '均勻等距欠採樣',
                  sub: '違背奈奎斯特 · 週期混疊',
                },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setRecoveryMode(m.id)}
                className={`rounded-lg px-2.5 py-2 text-left transition ${
                  recoveryMode === m.id
                    ? 'bg-cyan-600 text-white ring-1 ring-cyan-400/50'
                    : 'border border-slate-700/80 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-bold leading-tight">{m.label}</div>
                <div
                  className={`mt-0.5 text-[10px] ${
                    recoveryMode === m.id ? 'text-cyan-100' : 'text-slate-400'
                  }`}
                >
                  {m.sub}
                </div>
              </button>
            ))}
          </div>

          {/* 波形與頻譜雙畫布 */}
          <div className="mt-2.5 space-y-2.5">
            <div className="min-w-0 overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950">
              <canvas ref={waveCanvasRef} className="block w-full h-auto" />
            </div>
            <div className="min-w-0 overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950">
              <canvas ref={specCanvasRef} className="block w-full h-auto" />
            </div>
          </div>

          {/* 面板二滑桿控制 */}
          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">稀疏度 K（非零頻率數）</span>
                <span className="font-mono font-bold text-amber-300">K = {sparsityK}</span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                step={1}
                value={sparsityK}
                onChange={(e) => setSparsityK(parseInt(e.target.value, 10))}
                className="mt-1.5 w-full accent-amber-400"
              />
              <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
                <span>K = 2 (極稀疏)</span>
                <span>K = 8 (較稠密)</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">採樣測量數 M（N = 64）</span>
                <span className="font-mono font-bold text-cyan-300">
                  M = {samplesM} ({samplingPercent}%)
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={48}
                step={1}
                value={samplesM}
                onChange={(e) => setSamplesM(parseInt(e.target.value, 10))}
                className="mt-1.5 w-full accent-cyan-400"
              />
              <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
                <span>M = 10 (嚴重欠採)</span>
                <span>M = 48 (接近奈奎斯特)</span>
              </div>
            </div>
          </div>

          {/* 面板二即時數據讀數 */}
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
              <div className="text-[10px] text-slate-400">採樣率 M / N</div>
              <div className="mt-0.5 font-mono text-xs sm:text-sm font-bold text-cyan-300">
                {samplesM} / 64 ({samplingPercent}%)
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
              <div className="text-[10px] text-slate-400">量測／稀疏比 M / K</div>
              <div className="mt-0.5 font-mono text-xs sm:text-sm font-bold text-slate-100">
                {(samplesM / sparsityK).toFixed(1)}×
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
              <div className="text-[10px] text-slate-400">重建相對誤差 RMSE</div>
              <div
                className={`mt-0.5 font-mono text-xs sm:text-sm font-bold ${
                  recoveryResult.relRmse < 0.05
                    ? 'text-emerald-400'
                    : recoveryResult.relRmse < 0.25
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {rmsePercent}%
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
              <div className="text-[10px] text-slate-400">重建狀態判定</div>
              <div className="mt-0.5 text-[11px] font-bold leading-snug text-slate-200">
                {recoveryMode === 'uniform'
                  ? '週期混疊失效'
                  : recoveryMode === 'random_l2'
                  ? '能量彌散失真'
                  : recoveryResult.isExactSuccess
                  ? '精確稀疏恢復'
                  : '超越相變邊界 (失敗)'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 物理／數學邊界限制宣告 */}
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
        <strong className="text-slate-300">模型適用邊界：</strong>
        面板一呈現二維 (x₁, x₂) 單約束超平面下的範數球幾何（ℓ₀.₅ 非凸星形雖能碰撞座標軸，但在高維空間存在局部極小值陷阱，缺乏凸優化的全域最優保證）。面板二為無量測雜訊之理想 N = 64 正交離散餘弦（DCT-II）基底實時 ISTA（450 步軟閾值迭代）示範；當稀疏度 K 過高、採樣數 M 跌破 Donoho–Tanner 相變曲線（約 O(K ln(N/K)) 量級），或採樣模式與基底高度相干（如均勻等距採樣）時，重建將直接失敗。真實 MRI 等工程應用須額外處理量測雜訊、多尺度小波變換與全變差（TV）正則化。
      </div>
    </div>
  );
};
