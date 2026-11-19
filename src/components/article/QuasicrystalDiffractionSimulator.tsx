import React, { useState, useEffect, useRef, useMemo } from 'react';

type SimMode = 'periodic' | 'quasicrystal' | 'amorphous' | 'cut_project_1d';
type PeriodicType = 'square' | 'hexagonal';
type QuasicrystalType = 'penrose_10' | 'ammann_8';

interface Point2D {
  x: number;
  y: number;
}

interface TilePolygon {
  points: Point2D[];
  kind: 'fat' | 'thin' | 'square' | 'cell';
}

interface StructureData {
  atoms: Point2D[];
  tiles: TilePolygon[];
  bonds: Array<[Point2D, Point2D]>;
}

const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_ANGLE_DEG = (Math.atan(1 / PHI) * 180) / Math.PI; // ~31.7175°
const SILVER_ANGLE_DEG = (Math.atan(Math.SQRT2 - 1) * 180) / Math.PI; // 22.5°

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 生成四方 (C4) 或六方 (C6) 週期晶格點陣與單胞邊線
 */
function buildPeriodicLattice(kind: PeriodicType, radius: number): StructureData {
  const atoms: Point2D[] = [];
  const tiles: TilePolygon[] = [];
  const bonds: Array<[Point2D, Point2D]> = [];
  const r2 = radius * radius;

  if (kind === 'square') {
    const nMax = Math.ceil(radius) + 1;
    const grid = new Map<string, Point2D>();
    for (let ix = -nMax; ix <= nMax; ix++) {
      for (let iy = -nMax; iy <= nMax; iy++) {
        if (ix * ix + iy * iy <= r2) {
          const p = { x: ix, y: iy };
          atoms.push(p);
          grid.set(`${ix},${iy}`, p);
        }
      }
    }
    for (let ix = -nMax; ix <= nMax; ix++) {
      for (let iy = -nMax; iy <= nMax; iy++) {
        const p00 = grid.get(`${ix},${iy}`);
        const p10 = grid.get(`${ix + 1},${iy}`);
        const p11 = grid.get(`${ix + 1},${iy + 1}`);
        const p01 = grid.get(`${ix},${iy + 1}`);
        if (p00 && p10) bonds.push([p00, p10]);
        if (p00 && p01) bonds.push([p00, p01]);
        if (p00 && p10 && p11 && p01) {
          tiles.push({ points: [p00, p10, p11, p01], kind: 'square' });
        }
      }
    }
  } else {
    const a1x = 1;
    const a1y = 0;
    const a2x = 0.5;
    const a2y = Math.sqrt(3) / 2;
    const nMax = Math.ceil(radius * 1.4) + 2;
    const grid = new Map<string, Point2D>();
    for (let i = -nMax; i <= nMax; i++) {
      for (let j = -nMax; j <= nMax; j++) {
        const x = i * a1x + j * a2x;
        const y = i * a1y + j * a2y;
        if (x * x + y * y <= r2) {
          const p = { x, y };
          atoms.push(p);
          grid.set(`${i},${j}`, p);
        }
      }
    }
    for (let i = -nMax; i <= nMax; i++) {
      for (let j = -nMax; j <= nMax; j++) {
        const p00 = grid.get(`${i},${j}`);
        const p10 = grid.get(`${i + 1},${j}`);
        const p01 = grid.get(`${i},${j + 1}`);
        const p1m1 = grid.get(`${i + 1},${j - 1}`);
        if (p00 && p10) bonds.push([p00, p10]);
        if (p00 && p01) bonds.push([p00, p01]);
        if (p00 && p1m1) bonds.push([p00, p1m1]);
        if (p00 && p10 && p01) {
          tiles.push({ points: [p00, p10, p01], kind: 'cell' });
        }
      }
    }
  }

  return { atoms, tiles, bonds };
}

/**
 * 透過 Robinson 三角形置換 (5 代展開，等價於 5D→2D 切分投影對偶) 生成精確 Penrose P3 準晶點陣與胖瘦菱形
 */
function buildPenroseQuasicrystal(radius: number): StructureData {
  type Tri = [0 | 1, Point2D, Point2D, Point2D];
  let tris: Tri[] = [];

  for (let i = 0; i < 10; i++) {
    const a1 = (2 * Math.PI * i) / 10;
    const a2 = (2 * Math.PI * (i + 1)) / 10;
    const B = { x: Math.cos(a1), y: Math.sin(a1) };
    const C = { x: Math.cos(a2), y: Math.sin(a2) };
    const A = { x: 0, y: 0 };
    if (i % 2 === 0) tris.push([0, A, B, C]);
    else tris.push([0, A, C, B]);
  }

  const generations = 5;
  for (let gen = 0; gen < generations; gen++) {
    const next: Tri[] = [];
    for (const [type, A, B, C] of tris) {
      if (type === 0) {
        const P = {
          x: A.x + (B.x - A.x) / PHI,
          y: A.y + (B.y - A.y) / PHI,
        };
        next.push([0, C, P, B], [1, P, C, A]);
      } else {
        const Q = {
          x: B.x + (A.x - B.x) / PHI,
          y: B.y + (A.y - B.y) / PHI,
        };
        const R = {
          x: B.x + (C.x - B.x) / PHI,
          y: B.y + (C.y - B.y) / PHI,
        };
        next.push([1, R, C, A], [1, Q, R, B], [0, R, Q, A]);
      }
    }
    tris = next;
  }

  // 將最細分邊長歸一化為 1.0
  const scale = Math.pow(PHI, generations);
  const r2 = radius * radius;
  const ptsMap = new Map<string, Point2D>();
  const edgeMap = new Map<string, [Point2D, Point2D]>();
  const tiles: TilePolygon[] = [];

  const ptKey = (p: Point2D) => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)}`;

  for (const [type, A0, B0, C0] of tris) {
    const A = { x: A0.x * scale, y: A0.y * scale };
    const B = { x: B0.x * scale, y: B0.y * scale };
    const C = { x: C0.x * scale, y: C0.y * scale };

    const inA = A.x * A.x + A.y * A.y <= r2;
    const inB = B.x * B.x + B.y * B.y <= r2;
    const inC = C.x * C.x + C.y * C.y <= r2;

    if (inA) ptsMap.set(ptKey(A), A);
    if (inB) ptsMap.set(ptKey(B), B);
    if (inC) ptsMap.set(ptKey(C), C);

    if (inA && inB && inC) {
      tiles.push({
        points: [A, B, C],
        kind: type === 1 ? 'fat' : 'thin',
      });
    }

    // 僅繪製 AB 與 AC（BC 為胖瘦菱形內部對角分割線）
    if (inA && inB) {
      const k1 = ptKey(A);
      const k2 = ptKey(B);
      const ek = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      if (!edgeMap.has(ek)) edgeMap.set(ek, [A, B]);
    }
    if (inA && inC) {
      const k1 = ptKey(A);
      const k2 = ptKey(C);
      const ek = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      if (!edgeMap.has(ek)) edgeMap.set(ek, [A, C]);
    }
  }

  return {
    atoms: Array.from(ptsMap.values()),
    tiles,
    bonds: Array.from(edgeMap.values()),
  };
}

/**
 * 透過真正的 4D (Z^4) → 2D 切分投影 (Cut-and-Project) 生成 Ammann–Beenker 八重準晶點陣與正方形／45°菱形密鋪
 */
function buildAmmannBeenkerQuasicrystal(radius: number): StructureData {
  const ePar: Point2D[] = [0, 1, 2, 3].map((k) => ({
    x: Math.cos((k * Math.PI) / 4),
    y: Math.sin((k * Math.PI) / 4),
  }));
  const ePerp: Point2D[] = [0, 1, 2, 3].map((k) => ({
    x: Math.cos((k * 3 * Math.PI) / 4),
    y: Math.sin((k * 3 * Math.PI) / 4),
  }));

  const octagonApothem = 0.5 * (1 + Math.SQRT2);
  const inOctagonWindow = (px: number, py: number) => {
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 4;
      if (Math.abs(px * Math.cos(a) + py * Math.sin(a)) >= octagonApothem - 1e-6) {
        return false;
      }
    }
    return true;
  };

  // 微小非有理偏移消除邊界點對稱簡併
  const shiftX = 0.0013;
  const shiftY = 0.0027;
  const nLim = Math.ceil(radius * 0.88) + 2;
  const r2 = radius * radius;

  const nodeMap = new Map<string, { n: [number, number, number, number]; p: Point2D }>();
  const atoms: Point2D[] = [];

  for (let n0 = -nLim; n0 <= nLim; n0++) {
    for (let n1 = -nLim; n1 <= nLim; n1++) {
      for (let n2 = -nLim; n2 <= nLim; n2++) {
        for (let n3 = -nLim; n3 <= nLim; n3++) {
          const px =
            n0 * ePerp[0].x + n1 * ePerp[1].x + n2 * ePerp[2].x + n3 * ePerp[3].x + shiftX;
          const py =
            n0 * ePerp[0].y + n1 * ePerp[1].y + n2 * ePerp[2].y + n3 * ePerp[3].y + shiftY;

          if (!inOctagonWindow(px, py)) continue;

          const rx = n0 * ePar[0].x + n1 * ePar[1].x + n2 * ePar[2].x + n3 * ePar[3].x;
          const ry = n0 * ePar[0].y + n1 * ePar[1].y + n2 * ePar[2].y + n3 * ePar[3].y;

          if (rx * rx + ry * ry <= r2) {
            const p = { x: rx, y: ry };
            atoms.push(p);
            nodeMap.set(`${n0},${n1},${n2},${n3}`, { n: [n0, n1, n2, n3], p });
          }
        }
      }
    }
  }

  const bonds: Array<[Point2D, Point2D]> = [];
  const tiles: TilePolygon[] = [];

  const getN = (n0: number, n1: number, n2: number, n3: number) =>
    nodeMap.get(`${n0},${n1},${n2},${n3}`)?.p;

  for (const { n, p } of nodeMap.values()) {
    const [n0, n1, n2, n3] = n;
    for (let k = 0; k < 4; k++) {
      const d = [0, 0, 0, 0];
      d[k] = 1;
      const nb = getN(n0 + d[0], n1 + d[1], n2 + d[2], n3 + d[3]);
      if (nb) bonds.push([p, nb]);
    }
    // 檢查 4D 正方體各 2D 面的投影四邊形（正方形或 45° 菱形）
    for (let a = 0; a < 4; a++) {
      for (let b = a + 1; b < 4; b++) {
        const da = [0, 0, 0, 0];
        const db = [0, 0, 0, 0];
        da[a] = 1;
        db[b] = 1;
        const pa = getN(n0 + da[0], n1 + da[1], n2 + da[2], n3 + da[3]);
        const pb = getN(n0 + db[0], n1 + db[1], n2 + db[2], n3 + db[3]);
        const pab = getN(
          n0 + da[0] + db[0],
          n1 + da[1] + db[1],
          n2 + da[2] + db[2],
          n3 + da[3] + db[3]
        );
        if (pa && pb && pab) {
          const isSquare = b - a === 2;
          tiles.push({
            points: [p, pa, pab, pb],
            kind: isSquare ? 'square' : 'thin',
          });
        }
      }
    }
  }

  return { atoms, tiles, bonds };
}

/**
 * 生成具短程最近鄰排斥、無長程晶格對稱的非晶態玻璃原子群 (Amorphous Glass)
 */
function buildAmorphousGlass(radius: number): StructureData {
  const rng = mulberry32(20261119);
  const atoms: Point2D[] = [];
  const minDist = 0.88;
  const minDist2 = minDist * minDist;
  const targetCount = Math.round(Math.PI * radius * radius * 0.92);

  let attempts = 0;
  while (atoms.length < targetCount && attempts < 14000) {
    attempts++;
    const u = rng();
    const ang = rng() * Math.PI * 2;
    const r = Math.sqrt(u) * (radius - 0.12);
    const x = r * Math.cos(ang);
    const y = r * Math.sin(ang);

    let ok = true;
    for (let j = 0; j < atoms.length; j++) {
      const dx = x - atoms[j].x;
      const dy = y - atoms[j].y;
      if (dx * dx + dy * dy < minDist2) {
        ok = false;
        break;
      }
    }
    if (ok) atoms.push({ x, y });
  }

  // 短程排斥弛豫使近鄰間距更接近真實玻璃的局域配位
  for (let step = 0; step < 8; step++) {
    for (let i = 0; i < atoms.length; i++) {
      let fx = 0;
      let fy = 0;
      for (let j = 0; j < atoms.length; j++) {
        if (i === j) continue;
        const dx = atoms[i].x - atoms[j].x;
        const dy = atoms[i].y - atoms[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1e-6 && d2 < 1.15 * 1.15) {
          const d = Math.sqrt(d2);
          const push = (1.0 - d) * 0.08;
          fx += (dx / d) * push;
          fy += (dy / d) * push;
        }
      }
      const nx = atoms[i].x + fx;
      const ny = atoms[i].y + fy;
      if (nx * nx + ny * ny <= radius * radius) {
        atoms[i].x = nx;
        atoms[i].y = ny;
      }
    }
  }

  const bonds: Array<[Point2D, Point2D]> = [];
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const dx = atoms[i].x - atoms[j].x;
      const dy = atoms[i].y - atoms[j].y;
      if (dx * dx + dy * dy <= 1.24 * 1.24) {
        bonds.push([atoms[i], atoms[j]]);
      }
    }
  }

  return { atoms, tiles: [], bonds };
}

/**
 * 利用可分離複數矩陣乘積在瀏覽器即時計算二維傅立葉結構因子 |S(q)|^2 / N^2
 * S(q_x, q_y) = sum_j exp(-i (q_x x_j + q_y y_j))
 */
function computeStructureFactorGrid(
  atoms: Point2D[],
  gridSize: number,
  qMax: number
): { grid: Float32Array; maxOffCenter: number } {
  const N = atoms.length;
  const grid = new Float32Array(gridSize * gridSize);
  if (N === 0) return { grid, maxOffCenter: 1 };

  const cosX = new Float64Array(gridSize * N);
  const sinX = new Float64Array(gridSize * N);
  const cosY = new Float64Array(gridSize * N);
  const sinY = new Float64Array(gridSize * N);

  const qVals = new Float64Array(gridSize);
  for (let m = 0; m < gridSize; m++) {
    qVals[m] = -qMax + ((2 * m) / (gridSize - 1)) * qMax;
  }

  for (let m = 0; m < gridSize; m++) {
    const q = qVals[m];
    const rowOff = m * N;
    for (let j = 0; j < N; j++) {
      const phX = q * atoms[j].x;
      cosX[rowOff + j] = Math.cos(phX);
      sinX[rowOff + j] = -Math.sin(phX);

      // Canvas y 軸向下與數學直角座標 y 軸一致對應
      const phY = -q * atoms[j].y;
      cosY[rowOff + j] = Math.cos(phY);
      sinY[rowOff + j] = -Math.sin(phY);
    }
  }

  const invN2 = 1 / (N * N);
  let maxOffCenter = 1e-4;

  for (let iy = 0; iy < gridSize; iy++) {
    const qy = qVals[iy];
    const rowY = iy * N;
    for (let ix = 0; ix < gridSize; ix++) {
      const qx = qVals[ix];
      const rowX = ix * N;
      let re = 0;
      let im = 0;
      for (let j = 0; j < N; j++) {
        const ax = cosX[rowX + j];
        const bx = sinX[rowX + j];
        const ay = cosY[rowY + j];
        const by = sinY[rowY + j];
        re += ax * ay - bx * by;
        im += ax * by + bx * ay;
      }
      const intensity = (re * re + im * im) * invN2;
      grid[iy * gridSize + ix] = intensity;

      // 遮蔽中心透射光束 q=0 周邊主極大，用於自動標定布拉格尖峰色彩增益
      if (qx * qx + qy * qy > 2.2 * 2.2 && intensity > maxOffCenter) {
        maxOffCenter = intensity;
      }
    }
  }

  return { grid, maxOffCenter };
}

export const QuasicrystalDiffractionSimulator: React.FC = () => {
  const [mode, setMode] = useState<SimMode>('quasicrystal');
  const [periodicType, setPeriodicType] = useState<PeriodicType>('square');
  const [quasicrystalType, setQuasicrystalType] = useState<QuasicrystalType>('penrose_10');
  const [sampleRadius, setSampleRadius] = useState<number>(6.2);
  const [qMax, setQMax] = useState<number>(10.0);

  // 1D <- 2D 高維切分投影參數
  const [sliceAngleDeg, setSliceAngleDeg] = useState<number>(GOLDEN_ANGLE_DEG);
  const [windowScale, setWindowScale] = useState<number>(1.0);

  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 生成當前實空間點陣結構
  const structure = useMemo<StructureData>(() => {
    if (mode === 'periodic') return buildPeriodicLattice(periodicType, sampleRadius);
    if (mode === 'quasicrystal') {
      return quasicrystalType === 'penrose_10'
        ? buildPenroseQuasicrystal(sampleRadius)
        : buildAmmannBeenkerQuasicrystal(sampleRadius);
    }
    if (mode === 'amorphous') return buildAmorphousGlass(sampleRadius);
    return { atoms: [], tiles: [], bonds: [] };
  }, [mode, periodicType, quasicrystalType, sampleRadius]);

  // 計算二維結構因子 |S(q)|^2
  const diffraction = useMemo(() => {
    if (mode === 'cut_project_1d') return null;
    return computeStructureFactorGrid(structure.atoms, 112, qMax);
  }, [mode, structure.atoms, qMax]);

  // 計算 2D -> 1D 高維切分投影序列與一維結構因子
  const cutProject1D = useMemo(() => {
    const theta = (sliceAngleDeg * Math.PI) / 180;
    const ux = Math.cos(theta);
    const uy = Math.sin(theta);
    const nx = -uy;
    const ny = ux;

    // 單位正方形在垂直方向 E_perp 上的標準投影寬度為 |cos θ| + |sin θ|
    const canonicalWidth = Math.abs(ux) + Math.abs(uy);
    const halfW = 0.5 * canonicalWidth * windowScale;

    const accepted: Array<{ ix: number; iy: number; sPar: number; sPerp: number }> = [];
    const lim = 14;
    for (let ix = -lim; ix <= lim; ix++) {
      for (let iy = -lim; iy <= lim; iy++) {
        const sPar = ix * ux + iy * uy;
        const sPerp = ix * nx + iy * ny;
        if (Math.abs(sPerp) <= halfW + 1e-6 && Math.abs(sPar) <= 11.5) {
          accepted.push({ ix, iy, sPar, sPerp });
        }
      }
    }
    accepted.sort((a, b) => a.sPar - b.sPar);

    // 辨識 L (Long) 與 S (Short) 投影間距
    const steps: Array<{ pos: number; nextPos: number; kind: 'L' | 'S' }> = [];
    for (let i = 0; i < accepted.length - 1; i++) {
      const diff = accepted[i + 1].sPar - accepted[i].sPar;
      const kind: 'L' | 'S' = diff >= (ux + uy) * 0.49 ? 'L' : 'S';
      steps.push({ pos: accepted[i].sPar, nextPos: accepted[i + 1].sPar, kind });
    }

    // 計算 1D 離散傅立葉結構因子 |S(q_∥)|^2
    const qSamples = 260;
    const qRange = 16;
    const spectrum = new Float32Array(qSamples);
    const N = accepted.length;
    if (N > 0) {
      for (let k = 0; k < qSamples; k++) {
        const q = (k / (qSamples - 1)) * qRange;
        let re = 0;
        let im = 0;
        for (let j = 0; j < N; j++) {
          const ph = q * accepted[j].sPar;
          re += Math.cos(ph);
          im -= Math.sin(ph);
        }
        spectrum[k] = (re * re + im * im) / (N * N);
      }
    }

    const slope = Math.tan(theta);
    const isGolden = Math.abs(slope - 1 / PHI) < 0.015 || Math.abs(slope - PHI) < 0.02;
    const isSilver = Math.abs(slope - (Math.SQRT2 - 1)) < 0.015;
    const isRationalSimple =
      Math.abs(slope - 1) < 0.015 ||
      Math.abs(slope - 0.5) < 0.015 ||
      Math.abs(slope - 2 / 3) < 0.015 ||
      Math.abs(slope - 0.6) < 0.015;

    return {
      theta,
      ux,
      uy,
      nx,
      ny,
      halfW,
      accepted,
      steps,
      spectrum,
      qRange,
      slope,
      isGolden,
      isSilver,
      isRationalSimple,
      sequenceString: steps
        .slice(0, 18)
        .map((s) => s.kind)
        .join(''),
    };
  }, [sliceAngleDeg, windowScale]);

  // 繪製左面板 (實空間點陣 或 2D→1D 高維切分投影幾何)
  useEffect(() => {
    const canvas = leftCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const cssW = 360;
    const cssH = 320;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#050914';
    ctx.fillRect(0, 0, cssW, cssH);

    const cx = cssW / 2;
    const cy = cssH / 2 + 8;

    if (mode !== 'cut_project_1d') {
      const pxPerUnit = 122 / Math.max(sampleRadius, 4);

      // 圓形取樣視窗底框
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, sampleRadius * pxPerUnit + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();

      // 1. 填色密鋪磚塊（脂肪菱形／瘦菱形／正方形）
      for (const tile of structure.tiles) {
        if (tile.points.length < 3) continue;
        ctx.beginPath();
        tile.points.forEach((pt, idx) => {
          const sx = cx + pt.x * pxPerUnit;
          const sy = cy - pt.y * pxPerUnit;
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        if (tile.kind === 'fat') {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.13)';
        } else if (tile.kind === 'thin') {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
        } else if (tile.kind === 'square') {
          ctx.fillStyle = 'rgba(34, 211, 238, 0.10)';
        } else {
          ctx.fillStyle = 'rgba(52, 211, 153, 0.10)';
        }
        ctx.fill();
      }

      // 2. 鍵結／地磚邊線
      ctx.strokeStyle =
        mode === 'amorphous'
          ? 'rgba(148, 163, 184, 0.28)'
          : mode === 'quasicrystal'
          ? 'rgba(125, 211, 252, 0.42)'
          : 'rgba(148, 163, 184, 0.40)';
      ctx.lineWidth = mode === 'quasicrystal' ? 1.05 : 1.1;
      ctx.beginPath();
      for (const [p1, p2] of structure.bonds) {
        ctx.moveTo(cx + p1.x * pxPerUnit, cy - p1.y * pxPerUnit);
        ctx.lineTo(cx + p2.x * pxPerUnit, cy - p2.y * pxPerUnit);
      }
      ctx.stroke();

      // 3. 實空間原子格點
      const dotR = sampleRadius > 6.8 ? 2.4 : 2.9;
      for (const pt of structure.atoms) {
        const sx = cx + pt.x * pxPerUnit;
        const sy = cy - pt.y * pxPerUnit;
        ctx.beginPath();
        ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
        ctx.fillStyle =
          mode === 'quasicrystal'
            ? '#f8fafc'
            : mode === 'periodic'
            ? '#38bdf8'
            : '#cbd5e1';
        ctx.fill();
      }

      // 左圖標題
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11.5px sans-serif';
      ctx.textAlign = 'left';
      const titleText =
        mode === 'periodic'
          ? periodicType === 'square'
            ? '實空間：四方週期晶格 (n = 4)'
            : '實空間：六方週期晶格 (n = 6)'
          : mode === 'quasicrystal'
          ? quasicrystalType === 'penrose_10'
            ? '實空間：Penrose 雙菱形準晶 (5D→2D 對偶)'
            : '實空間：Ammann–Beenker 八重準晶 (4D→2D)'
          : '實空間：短程互斥非晶態玻璃';
      ctx.fillText(titleText, 12, 20);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10.5px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`N = ${structure.atoms.length} 點`, cssW - 12, 20);

      if (mode === 'quasicrystal') {
        ctx.textAlign = 'left';
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText(
          quasicrystalType === 'penrose_10'
            ? '藍：胖菱形 (72°) ／ 金：瘦菱形 (36°)，無平移週期'
            : '青：正方形 ／ 金：45° 菱形，來自 Z⁴ 八邊形視窗投影',
          12,
          cssH - 10
        );
      }
    } else {
      // Mode 4 左圖：2D Z^2 母晶格與切分投影帶 (Cut-and-Project)
      const { ux, uy, nx, ny, halfW, accepted } = cutProject1D;
      const scale = 15.5;

      // 繪製接受帶狀區域 (Acceptance Strip)
      const L = 16;
      const p1 = { x: -L * ux + halfW * nx, y: -L * uy + halfW * ny };
      const p2 = { x: L * ux + halfW * nx, y: L * uy + halfW * ny };
      const p3 = { x: L * ux - halfW * nx, y: L * uy - halfW * ny };
      const p4 = { x: -L * ux - halfW * nx, y: -L * uy - halfW * ny };

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx + p1.x * scale, cy - p1.y * scale);
      ctx.lineTo(cx + p2.x * scale, cy - p2.y * scale);
      ctx.lineTo(cx + p3.x * scale, cy - p3.y * scale);
      ctx.lineTo(cx + p4.x * scale, cy - p4.y * scale);
      ctx.closePath();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.restore();

      // 物理子空間 E_parallel
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx - L * ux * scale, cy + L * uy * scale);
      ctx.lineTo(cx + L * ux * scale, cy - L * uy * scale);
      ctx.stroke();

      // 2D 週期方格網點 Z^2
      for (let ix = -11; ix <= 11; ix++) {
        for (let iy = -10; iy <= 10; iy++) {
          const sx = cx + ix * scale;
          const sy = cy - iy * scale;
          if (sx < 6 || sx > cssW - 6 || sy < 28 || sy > cssH - 22) continue;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
          ctx.fill();
        }
      }

      // 帶內格點與正交投影虛線
      for (const pt of accepted) {
        const sx = cx + pt.ix * scale;
        const sy = cy - pt.iy * scale;
        const projX = cx + pt.sPar * ux * scale;
        const projY = cy - pt.sPar * uy * scale;

        ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(projX, projY);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(projX, projY, 3.0, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
      }

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11.5px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('2D 週期母晶格 Z² → 1D 切片投影視角', 12, 20);

      ctx.fillStyle = '#fbbf24';
      ctx.font = '10.5px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`tan θ = ${cutProject1D.slope.toFixed(4)}`, cssW - 12, 20);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('藍帶內格點正交投影至黃線 E∥，形成一維原子鏈', 12, cssH - 8);
    }
  }, [mode, periodicType, quasicrystalType, sampleRadius, structure, cutProject1D]);

  // 繪製右面板 (二維繞射結構因子 |S(q)|^2 或 一維切分投影繞射譜)
  useEffect(() => {
    const canvas = rightCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const cssW = 360;
    const cssH = 320;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#030610';
    ctx.fillRect(0, 0, cssW, cssH);

    if (mode !== 'cut_project_1d' && diffraction) {
      const gridSize = 112;
      const plotSize = 250;
      const left = (cssW - plotSize) / 2;
      const top = 34;

      // 將 112x112 float 陣列寫入 offscreen imageData 再平滑縮放至 250x250 區域
      const offCanvas = document.createElement('canvas');
      offCanvas.width = gridSize;
      offCanvas.height = gridSize;
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        const img = offCtx.createImageData(gridSize, gridSize);
        const data = img.data;
        const { grid, maxOffCenter } = diffraction;
        const normRef = Math.max(maxOffCenter, 0.03);

        for (let iy = 0; iy < gridSize; iy++) {
          const qy = -qMax + ((2 * iy) / (gridSize - 1)) * qMax;
          for (let ix = 0; ix < gridSize; ix++) {
            const qx = -qMax + ((2 * ix) / (gridSize - 1)) * qMax;
            const q2 = qx * qx + qy * qy;
            const idx = iy * gridSize + ix;
            let raw = grid[idx];

            // 中心透射斑遮罩 (Beam Stop) 避免 q=0 掩蓋布拉格斑點動態範圍
            if (q2 < 1.35 * 1.35) {
              raw = 0;
            }

            // 對數＋冪次壓縮映射：突出離散鋒利布拉格亮斑同時保留次級諧波峰
            const scaled = Math.log1p(28 * (raw / normRef)) / Math.log1p(28);
            const val = Math.pow(Math.min(1, Math.max(0, scaled)), 1.35);

            const pIdx = idx * 4;
            if (mode === 'quasicrystal') {
              // 電鏡螢光青－金白高亮色階
              data[pIdx] = Math.round(6 + val * 245);
              data[pIdx + 1] = Math.round(10 + Math.pow(val, 0.85) * 235);
              data[pIdx + 2] = Math.round(24 + Math.pow(val, 0.65) * 231);
            } else if (mode === 'periodic') {
              data[pIdx] = Math.round(6 + Math.pow(val, 1.3) * 210);
              data[pIdx + 1] = Math.round(12 + Math.pow(val, 0.8) * 240);
              data[pIdx + 2] = Math.round(26 + Math.pow(val, 0.65) * 229);
            } else {
              // 非晶態玻璃：柔和琥珀／藍灰瀰散環
              data[pIdx] = Math.round(10 + val * 225);
              data[pIdx + 1] = Math.round(12 + val * 165);
              data[pIdx + 2] = Math.round(22 + val * 110);
            }
            data[pIdx + 3] = 255;
          }
        }
        offCtx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offCanvas, left, top, plotSize, plotSize);
      }

      const cx = left + plotSize / 2;
      const cy = top + plotSize / 2;

      // 外框與旋轉對稱角度刻度線
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(left, top, plotSize, plotSize);

      const nFold =
        mode === 'periodic'
          ? periodicType === 'square'
            ? 4
            : 6
          : mode === 'quasicrystal'
          ? quasicrystalType === 'penrose_10'
            ? 10
            : 8
          : 0;

      if (nFold > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.32)';
        ctx.lineWidth = 1;
        const rInner = plotSize * 0.455;
        const rOuter = plotSize * 0.495;
        for (let k = 0; k < nFold; k++) {
          const ang = (2 * Math.PI * k) / nFold;
          ctx.beginPath();
          ctx.moveTo(cx + rInner * Math.cos(ang), cy - rInner * Math.sin(ang));
          ctx.lineTo(cx + rOuter * Math.cos(ang), cy - rOuter * Math.sin(ang));
          ctx.stroke();
        }
        ctx.restore();
      }

      // 中心透射光束遮擋片 (Beam Stop) 標記
      ctx.beginPath();
      ctx.arc(cx, cy, (1.35 / qMax) * (plotSize / 2), 0, Math.PI * 2);
      ctx.fillStyle = '#030610';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11.5px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('倒空間結構因子 |S(q)|² (即時計算)', 12, 20);

      ctx.fillStyle = mode === 'quasicrystal' ? '#fbbf24' : '#38bdf8';
      ctx.font = '10.5px monospace';
      ctx.textAlign = 'right';
      const symLabel =
        nFold === 10
          ? '10-fold 十重對稱峰'
          : nFold === 8
          ? '8-fold 八重對稱峰'
          : nFold === 4
          ? '4-fold 布拉格峰'
          : nFold === 6
          ? '6-fold 布拉格峰'
          : '各向同性瀰散環';
      ctx.fillText(symLabel, cssW - 12, 20);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `qₓ, qᵧ ∈ [−${qMax.toFixed(1)}, +${qMax.toFixed(1)}] · 對數增強並遮蔽 q=0 透射斑`,
        cssW / 2,
        cssH - 10
      );
    } else {
      // Mode 4 右圖：投影 1D L/S 鏈 + 1D 結構因子 |S(q_∥)|^2
      const { steps, spectrum, qRange, isGolden, isSilver, isRationalSimple } = cutProject1D;

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11.5px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('投影一維鏈 L/S 序列與一維繞射譜 |S(q∥)|²', 12, 20);

      // 1. 頂部一維投影鏈示意 (y = 42..96)
      const chainLeft = 22;
      const chainW = cssW - 44;
      const chainY = 66;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(chainLeft - 6, 36, chainW + 12, 62);
      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(chainLeft - 6, 36, chainW + 12, 62);

      const minPos = cutProject1D.accepted[0]?.sPar ?? -8;
      const maxPos = cutProject1D.accepted[cutProject1D.accepted.length - 1]?.sPar ?? 8;
      const span = Math.max(1e-3, maxPos - minPos);

      for (const st of steps) {
        const x1 = chainLeft + ((st.pos - minPos) / span) * chainW;
        const x2 = chainLeft + ((st.nextPos - minPos) / span) * chainW;
        ctx.strokeStyle = st.kind === 'L' ? '#38bdf8' : '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, chainY);
        ctx.lineTo(x2, chainY);
        ctx.stroke();

        if (x2 - x1 > 10) {
          ctx.fillStyle = st.kind === 'L' ? '#7dd3fc' : '#fde68a';
          ctx.font = 'bold 9.5px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(st.kind, (x1 + x2) / 2, chainY - 8);
        }
      }

      for (const pt of cutProject1D.accepted) {
        const x = chainLeft + ((pt.sPar - minPos) / span) * chainW;
        ctx.beginPath();
        ctx.arc(x, chainY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `序列片段：${cutProject1D.sequenceString || '—'}`,
        chainLeft,
        90
      );

      // 2. 下方一維結構因子 |S(q_∥)|^2 曲線 (y = 122..282)
      const plotL = 32;
      const plotR = cssW - 16;
      const plotT = 122;
      const plotB = 282;
      const plotW = plotR - plotL;
      const plotH = plotB - plotT;

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotL, plotT);
      ctx.lineTo(plotL, plotB);
      ctx.lineTo(plotR, plotB);
      ctx.stroke();

      ctx.strokeStyle = isGolden || isSilver ? '#fbbf24' : '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let k = 0; k < spectrum.length; k++) {
        const x = plotL + (k / (spectrum.length - 1)) * plotW;
        // q=0 附近以平方根增強展示非零諧波峰
        const val = Math.min(1, Math.pow(spectrum[k], 0.55));
        const y = plotB - val * (plotH - 8);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('q∥ = 0', plotL, plotB + 14);
      ctx.textAlign = 'right';
      ctx.fillText(`q∥ = ${qRange}`, plotR, plotB + 14);

      ctx.textAlign = 'center';
      ctx.fillStyle = isGolden ? '#fbbf24' : isRationalSimple ? '#38bdf8' : '#cbd5e1';
      ctx.font = 'bold 10.5px sans-serif';
      ctx.fillText(
        isGolden
          ? '黃金斜率 (1/φ)：非週期 Fibonacci 鏈 → 密集且尖銳的準週期峰'
          : isSilver
          ? '白銀斜率 (√2−1)：非週期八重 1D 投影 → 尖銳準週期峰'
          : isRationalSimple
          ? '有理斜率 p/q：投影序列嚴格週期重複 → 等距週期布拉格峰'
          : '一般斜率：觀察投影序列重複週期與峰位變化',
        cssW / 2,
        cssH - 8
      );
    }
  }, [mode, periodicType, quasicrystalType, qMax, diffraction, cutProject1D]);

  const statusMeta = useMemo(() => {
    if (mode === 'periodic') {
      return {
        badge: periodicType === 'square' ? 'C₄ 晶體學允許' : 'C₆ 晶體學允許',
        symmetry: periodicType === 'square' ? 'C₄ (4 重旋轉)' : 'C₆ (6 重旋轉)',
        periodicity: '具備平移週期性',
        diffractionNote: '等距離散布拉格尖峰',
        summary:
          periodicType === 'square'
            ? '四方晶格滿足晶體學限制定理 (2 cos(2π/4) = 0 ∈ ℤ)，實空間完整無縫密鋪，倒空間呈現純淨 4 重離散布拉格峰。'
            : '六方蜂巢／三角晶格滿足晶體學限制定理 (2 cos(2π/6) = 1 ∈ ℤ)，實空間無縫密鋪，倒空間呈現純淨 6 重離散布拉格峰。',
      };
    }
    if (mode === 'quasicrystal') {
      return {
        badge: quasicrystalType === 'penrose_10' ? 'C₅/C₁₀ 打破限制定理' : 'C₈ 打破限制定理',
        symmetry:
          quasicrystalType === 'penrose_10' ? 'C₁₀ (十重／五重長程取向)' : 'C₈ (八重長程取向)',
        periodicity: '非週期 · 準週期長程有序',
        diffractionNote: '非週期卻現鋒利布拉格斑',
        summary:
          quasicrystalType === 'penrose_10'
            ? '由 5 維超立方體切分投影（等價於胖瘦雙菱形非週期置換）生成。實空間絕不平移重複，但即時計算之傅立葉結構因子仍湧現嚴格 10 重對稱的鋒利布拉格亮斑。'
            : '由 4 維整數晶格 Z⁴ 以正八邊形視窗切分投影生成。正方形與 45° 菱形在平面內永不週期重複，倒空間卻出現嚴格 8 重旋轉對稱的離散布拉格尖峰。',
      };
    }
    if (mode === 'amorphous') {
      return {
        badge: '短程排斥 · 無長程對稱',
        symmetry: '無旋轉對稱 (統計各向同性)',
        periodicity: '非晶無序態',
        diffractionNote: '模糊瀰散環 (Amorphous Halo)',
        summary:
          '保留相鄰原子的短程最小間距排斥，但完全缺乏長程取向對稱與準週期序。繞射圖譜隨即喪失離散亮點，退化為近似圓對稱的模糊光暈環。',
      };
    }
    return {
      badge: '高維空間切分投影 (2D → 1D)',
      symmetry: `斜率 tan θ = ${cutProject1D.slope.toFixed(4)}`,
      periodicity: cutProject1D.isGolden || cutProject1D.isSilver ? '無理斜率：Fibonacci/白銀準晶' : '依斜率有理／無理性切換',
      diffractionNote: '高維倒晶格投影成密集峰',
      summary:
        '將 2 維週期方格帶狀投影至 1 維物理軸 E∥：當斜率是有理數 p/q 時產出週期重複鏈；一旦調至黃金比例 1/φ ≈ 0.6180 等無理數，投影窗口永不重複卻鎖定出準週期布拉格峰。',
    };
  }, [mode, periodicType, quasicrystalType, cutProject1D]);

  return (
    <div className="my-8 w-full max-w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-3.5 sm:p-5 text-slate-100 shadow-2xl">
      {/* 標題與對稱狀態標籤 */}
      <div className="flex flex-col gap-3 border-b border-slate-700/80 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold tracking-wide text-cyan-300">
              準晶繞射與高維切分投影實驗室
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              實空間座標即時計算二維傅立葉結構因子 |S(q)|² = |∑ e<sup>−iq·rⱼ</sup>|²，直擊十重布拉格亮斑如何誕生
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center self-start rounded-full border border-amber-500/35 bg-amber-950/50 px-2.5 py-1 font-mono text-[11px] font-semibold text-amber-300">
            {statusMeta.badge}
          </span>
        </div>

        {/* 四模式切換按鈕列 */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {(
            [
              { id: 'periodic', label: '週期晶體 (n=4/6)' },
              { id: 'quasicrystal', label: '準晶 (10重/8重)' },
              { id: 'amorphous', label: '非晶態玻璃' },
              { id: 'cut_project_1d', label: '2D→1D 切分投影' },
            ] as const
          ).map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition text-center ${
                  active
                    ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400/50'
                    : 'border border-slate-700/80 bg-slate-950/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* 次級晶體／投影預設切換 */}
        {mode === 'periodic' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">晶系對稱：</span>
            <button
              type="button"
              onClick={() => setPeriodicType('square')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                periodicType === 'square'
                  ? 'bg-sky-500/25 text-sky-300 ring-1 ring-sky-400/50'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              四方晶格 (n = 4)
            </button>
            <button
              type="button"
              onClick={() => setPeriodicType('hexagonal')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                periodicType === 'hexagonal'
                  ? 'bg-sky-500/25 text-sky-300 ring-1 ring-sky-400/50'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              六方晶格 (n = 6)
            </button>
          </div>
        )}

        {mode === 'quasicrystal' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">準晶類型：</span>
            <button
              type="button"
              onClick={() => setQuasicrystalType('penrose_10')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                quasicrystalType === 'penrose_10'
                  ? 'bg-amber-500/25 text-amber-300 ring-1 ring-amber-400/50'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              Penrose 十重對稱 (5D→2D)
            </button>
            <button
              type="button"
              onClick={() => setQuasicrystalType('ammann_8')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                quasicrystalType === 'ammann_8'
                  ? 'bg-amber-500/25 text-amber-300 ring-1 ring-amber-400/50'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              Ammann–Beenker 八重對稱 (4D→2D)
            </button>
          </div>
        )}

        {mode === 'cut_project_1d' && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400">快速斜率：</span>
            <button
              type="button"
              onClick={() => setSliceAngleDeg(45)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sky-300 hover:bg-slate-800"
            >
              有理 1/1 (45.0°)
            </button>
            <button
              type="button"
              onClick={() => setSliceAngleDeg((Math.atan(3 / 5) * 180) / Math.PI)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sky-300 hover:bg-slate-800"
            >
              有理近似 3/5 (30.96°)
            </button>
            <button
              type="button"
              onClick={() => setSliceAngleDeg(GOLDEN_ANGLE_DEG)}
              className="rounded-md border border-amber-500/40 bg-amber-950/40 px-2 py-1 text-amber-300 hover:bg-amber-900/40"
            >
              黃金比例 1/φ ({GOLDEN_ANGLE_DEG.toFixed(2)}°)
            </button>
            <button
              type="button"
              onClick={() => setSliceAngleDeg(SILVER_ANGLE_DEG)}
              className="rounded-md border border-cyan-500/40 bg-cyan-950/40 px-2 py-1 text-cyan-300 hover:bg-cyan-900/40"
            >
              白銀比例 √2−1 (22.50°)
            </button>
          </div>
        )}
      </div>

      {/* 雙視圖 Canvas：左實空間 / 右倒空間 */}
      <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
          <canvas ref={leftCanvasRef} className="block w-full h-auto rounded-lg" />
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2">
          <canvas ref={rightCanvasRef} className="block w-full h-auto rounded-lg" />
        </div>
      </div>

      {/* 即時觀測讀數面板 */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">採樣格點數 N</div>
          <div className="mt-1 font-mono text-sm sm:text-base font-bold text-cyan-300">
            {mode === 'cut_project_1d' ? `${cutProject1D.accepted.length} 投影點` : `${structure.atoms.length} 原子`}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">對稱與幾何指標</div>
          <div className="mt-1 text-xs sm:text-sm font-bold text-amber-300 leading-snug">
            {statusMeta.symmetry}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">空間平移序</div>
          <div className="mt-1 text-xs font-semibold text-slate-200 leading-snug">
            {statusMeta.periodicity}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
          <div className="text-[11px] text-slate-400">繞射譜特徵</div>
          <div className="mt-1 text-xs font-semibold text-emerald-300 leading-snug">
            {statusMeta.diffractionNote}
          </div>
        </div>
      </div>

      {/* 互動滑桿控制列 */}
      {mode !== 'cut_project_1d' ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">實空間晶粒取樣半徑 R</span>
              <span className="font-mono font-bold text-cyan-300">
                R = {sampleRadius.toFixed(1)} a₀ (N = {structure.atoms.length})
              </span>
            </div>
            <input
              type="range"
              min={3.8}
              max={7.8}
              step={0.4}
              value={sampleRadius}
              onChange={(e) => setSampleRadius(parseFloat(e.target.value))}
              className="mt-2 w-full accent-cyan-500"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>小尺度 (峰寬較寬)</span>
              <span>大尺度 (布拉格峰更銳利)</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">倒空間觀測半徑 q<sub>max</sub></span>
              <span className="font-mono font-bold text-amber-300">
                ±{qMax.toFixed(1)} a₀⁻¹
              </span>
            </div>
            <input
              type="range"
              min={7.0}
              max={14.0}
              step={0.5}
              value={qMax}
              onChange={(e) => setQMax(parseFloat(e.target.value))}
              className="mt-2 w-full accent-amber-500"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>放大內圈亮斑</span>
              <span>展開高階 φ 倍率環</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">投影切片傾角 θ</span>
              <span className="font-mono font-bold text-amber-300">
                {sliceAngleDeg.toFixed(2)}° (tan θ = {cutProject1D.slope.toFixed(4)})
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={75}
              step={0.1}
              value={sliceAngleDeg}
              onChange={(e) => setSliceAngleDeg(parseFloat(e.target.value))}
              className="mt-2 w-full accent-amber-500"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>15°</span>
              <span>31.72° (1/φ) · 45° (1/1)</span>
              <span>75°</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">高維投影視窗寬度倍率 W</span>
              <span className="font-mono font-bold text-cyan-300">
                {windowScale.toFixed(2)} × 標準帶寬
              </span>
            </div>
            <input
              type="range"
              min={0.65}
              max={1.45}
              step={0.05}
              value={windowScale}
              onChange={(e) => setWindowScale(parseFloat(e.target.value))}
              className="mt-2 w-full accent-cyan-500"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>窄帶 (稀疏投影)</span>
              <span>1.00 標準 Z² 投影</span>
              <span>寬帶 (出現極短間距)</span>
            </div>
          </div>
        </div>
      )}

      {/* 物理機制解說與必須明確標註之有限尺度邊界聲明 */}
      <div className="mt-4 space-y-2 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-300">
        <p>
          <strong className="text-cyan-300">物理判讀：</strong>
          {statusMeta.summary}
        </p>
        <p className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
          計算邊界註記：實空間有限尺度點陣（數百個格點）之離散結構因子計算，真實準晶宏觀樣本之布拉格峰寬度將更趨近極窄 δ 函數。
        </p>
      </div>
    </div>
  );
};
