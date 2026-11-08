import React, { useState, useEffect, useRef } from 'react';

/**
 * RibozymeKineticsSimulator - 核酶自催化剪切與 RNA 世界化學動力學模擬器
 * 
 * 物理與生物化學原理：
 * 1. 核酶二級結構與活性口袋：單鏈 RNA 透過自互補鹼基配對折疊出髮夾環、三向接頭與假結，形成專一性催化反應口袋。
 * 2. 輔因子活化：Mg2+ 等二價金屬離子屏蔽磷酸骨架負電荷斥力，誘發精確立體折疊，並作為路易斯酸直接參與磷酸二酯鍵轉酯剪切反應。
 * 3. 米氏動力學與自催化複製：v = (k_cat * [E]_0 * [S]) / (K_M + [S])，k_cat 受 Mg2+ 濃度協同調控。
 */
export const RibozymeKineticsSimulator: React.FC = () => {
  const [mgConcentration, setMgConcentration] = useState<number>(10); // 0 ~ 50 mM Mg2+
  const [substrateConc, setSubstrateConc] = useState<number>(50); // 5 ~ 200 μM RNA 底物
  const [temperature, setTemperature] = useState<number>(37); // 20 ~ 65 °C

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 輔因子活化模型：Mg2+ 協同結合 (Hill 系數 n=2, K_half = 5 mM)
  const mgFactor = Math.pow(mgConcentration, 2) / (Math.pow(5, 2) + Math.pow(mgConcentration, 2));

  // 溫度影響：最適溫 37-45°C，高溫熱解折疊變性
  const tempFactor = Math.exp(-Math.pow(temperature - 42, 2) / 250);

  // 表觀催化常數 k_obs (min^-1)
  const kObs = 1.8 * mgFactor * tempFactor;
  // 米氏常數 K_M (μM)
  const kM = 25;
  // 初期反應速率 v0 (μM/min)
  const initialVelocity = (kObs * 5.0 * substrateConc) / (kM + substrateConc);

  // 動態繪製反應進程曲線與核酶催化構象
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.02;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const leftW = width * 0.45;

      // ─────────────────────── 左側：錘頭狀核酶立體結構與剪切示意 ───────────────────────
      const centerX = leftW / 2;
      const centerY = height / 2;

      // 繪製 RNA 髮夾結構骨架 (Stem I, II, III)
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Stem I (左上)
      ctx.beginPath();
      ctx.moveTo(centerX - 60, centerY - 50);
      ctx.lineTo(centerX - 15, centerY - 10);
      ctx.stroke();

      // Stem II (正下)
      ctx.beginPath();
      ctx.moveTo(centerX, centerY + 10);
      ctx.lineTo(centerX, centerY + 65);
      ctx.stroke();

      // Stem III (右上)
      ctx.beginPath();
      ctx.moveTo(centerX + 15, centerY - 10);
      ctx.lineTo(centerX + 60, centerY - 50);
      ctx.stroke();

      // 核心催化三向接頭 (Catalytic Core Loop)
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 16, 0, Math.PI * 2);
      ctx.stroke();

      // 繪製底物 RNA 鏈 (紅橘色，正在被剪切的位置)
      const cleavageProgress = Math.sin(t * 3);
      const isCleaving = mgConcentration > 3 && temperature < 55;

      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX - 40, centerY - 35);
      if (isCleaving && cleavageProgress > 0.5) {
        // 剪切斷開瞬間
        ctx.lineTo(centerX - 4, centerY - 15);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX + 6, centerY - 15);
        ctx.lineTo(centerX + 40, centerY - 35);
        ctx.stroke();

        // 剪切活性亮點
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(centerX, centerY - 15, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 完整結合態
        ctx.lineTo(centerX, centerY - 15);
        ctx.lineTo(centerX + 40, centerY - 35);
        ctx.stroke();
      }

      // 繪製 Mg2+ 輔因子結合球
      const mgCount = Math.min(4, Math.floor(mgConcentration / 8) + 1);
      ctx.fillStyle = '#3b82f6';
      for (let i = 0; i < mgCount; i++) {
        const angle = t * 1.5 + (i * Math.PI * 2) / mgCount;
        const orbitR = 24;
        const mgX = centerX + Math.cos(angle) * orbitR;
        const mgY = centerY + Math.sin(angle) * orbitR;

        ctx.beginPath();
        ctx.arc(mgX, mgY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mgX, mgY);
        ctx.lineTo(centerX, centerY);
        ctx.stroke();
      }

      // 左側標籤
      ctx.fillStyle = '#0f172a';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        isCleaving ? '活性構象：Mg²⁺ 誘導自催化轉酯剪切' : '非活性構象：缺少輔因子或熱變性',
        centerX,
        height - 15
      );

      // ─────────────────────── 右側：產物累積動力學曲線 [P](t) ───────────────────────
      const gLeft = leftW + 40;
      const gRight = width - 25;
      const gTop = 30;
      const gBottom = height - 40;
      const gW = gRight - gLeft;
      const gH = gBottom - gTop;

      // 坐標軸
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gLeft, gTop);
      ctx.lineTo(gLeft, gBottom);
      ctx.lineTo(gRight, gBottom);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('0', gLeft, gBottom + 14);
      ctx.fillText('10 min', gLeft + gW * 0.33, gBottom + 14);
      ctx.fillText('20 min', gLeft + gW * 0.66, gBottom + 14);
      ctx.fillText('30 min', gRight, gBottom + 14);

      ctx.textAlign = 'right';
      ctx.fillText('剪切產物 [P] (μM)', gLeft - 6, gTop + 8);
      ctx.fillText('時間 (min)', gRight, gBottom + 25);

      // 繪製產物曲線：[P](t) = [S]0 * (1 - exp(-k_obs * t))
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const totalTime = 30; // 30 分鐘
      for (let m = 0; m <= totalTime; m += 0.5) {
        const prod = substrateConc * (1 - Math.exp(-kObs * (m / 5)));
        const px = gLeft + (m / totalTime) * gW;
        const py = gBottom - (prod / 100) * gH;

        if (m === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, Math.max(gTop, py));
        }
      }
      ctx.stroke();

      // 標註初始斜率 v0
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      const tanX = Math.min(totalTime, 10);
      const tanY = gBottom - ((initialVelocity * (tanX / 5)) / 100) * gH;
      ctx.beginPath();
      ctx.moveTo(gLeft, gBottom);
      ctx.lineTo(gLeft + (tanX / totalTime) * gW, Math.max(gTop, tanY));
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.textAlign = 'left';
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [mgConcentration, substrateConc, temperature, kObs, initialVelocity]);

  return (
    <div className="my-8 rounded-xl border border-mirari-line bg-mirari-paper p-5 sm:p-6 text-mirari-ink font-sans shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-mirari-line gap-3">
        <div>
          <span className="text-xs uppercase tracking-widest text-mirari-dim font-mono">
            INTERACTIVE EXPERIMENT
          </span>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-mirari-ink">
            核酶自催化剪切動力學與 Mg²⁺ 輔因子微調模擬器
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-100 text-emerald-800">
            Hammerhead 轉酯反應微分方程數值解
          </span>
        </div>
      </div>

      {/* 畫布 */}
      <div className="mt-4 relative bg-white/70 rounded-lg border border-mirari-line/60 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={680}
          height={260}
          className="w-full h-auto block"
        />
      </div>

      {/* 控制滑桿 */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
        {/* 控制項 1: Mg2+ 濃度 */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-xs text-mirari-dim">
            <span>[Mg²⁺] 二價金屬輔因子</span>
            <span className="font-bold text-mirari-ink">{mgConcentration} mM</span>
          </div>
          <input
            type="range"
            min="0"
            max="40"
            step="1"
            value={mgConcentration}
            onChange={(e) => setMgConcentration(parseInt(e.target.value))}
            className="w-full accent-emerald-600"
          />
          <p className="text-[11px] text-mirari-dim leading-snug">
            Mg²⁺ 屏蔽骨架排斥並作為親電催化劑；缺少 Mg²⁺ 時反應近乎完全凍結。
          </p>
        </div>

        {/* 控制項 2: RNA 底物濃度 */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-xs text-mirari-dim">
            <span>RNA 底物濃度 [S]</span>
            <span className="font-bold text-mirari-ink">{substrateConc} μM</span>
          </div>
          <input
            type="range"
            min="10"
            max="150"
            step="5"
            value={substrateConc}
            onChange={(e) => setSubstrateConc(parseInt(e.target.value))}
            className="w-full accent-emerald-600"
          />
          <p className="text-[11px] text-mirari-dim leading-snug">
            調控米氏催化受質飽和度，觀察初期轉化速率 v0 與終態產量。
          </p>
        </div>

        {/* 控制項 3: 反應溫度 */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-xs text-mirari-dim">
            <span>反應溫度 T</span>
            <span className="font-bold text-mirari-ink">{temperature} °C</span>
          </div>
          <input
            type="range"
            min="20"
            max="65"
            step="1"
            value={temperature}
            onChange={(e) => setTemperature(parseInt(e.target.value))}
            className="w-full accent-emerald-600"
          />
          <p className="text-[11px] text-mirari-dim leading-snug">
            適度升溫加速分子碰撞；但若超過 50°C，RNA 二級結構將熱解變性失去活性。
          </p>
        </div>
      </div>

      {/* 狀態數值面板 */}
      <div className="mt-5 p-4 rounded-lg bg-mirari-paper-dark border border-mirari-line grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div>
          <div className="text-[11px] text-mirari-dim font-mono">催化速率常數 k_obs</div>
          <div className="text-lg font-bold text-emerald-700 font-mono">
            {kObs.toFixed(3)} min⁻¹
          </div>
          <div className="text-[10px] text-mirari-dim">表觀一級反應常數</div>
        </div>
        <div>
          <div className="text-[11px] text-mirari-dim font-mono">初期速率 v₀</div>
          <div className="text-lg font-bold text-teal-700 font-mono">
            {initialVelocity.toFixed(2)} μM/min
          </div>
          <div className="text-[10px] text-mirari-dim">米氏雙分子轉化速度</div>
        </div>
        <div>
          <div className="text-[11px] text-mirari-dim font-mono">金屬活化比率</div>
          <div className="text-lg font-bold text-blue-700 font-mono">
            {(mgFactor * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-mirari-dim">Hill 協同結合飽和度</div>
        </div>
        <div>
          <div className="text-[11px] text-mirari-dim font-mono">二級結構穩定性</div>
          <div className="text-lg font-bold text-amber-700 font-mono">
            {(tempFactor * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-mirari-dim">熱力學構象維持比率</div>
        </div>
      </div>

      {/* 邊界提示 */}
      <div className="mt-3 text-[11px] text-mirari-dim leading-relaxed border-t border-mirari-line/50 pt-2">
        <span className="font-semibold text-mirari-ink">生化邊界說明：</span> 本模擬採用典型錘頭狀核酶（Hammerhead Ribozyme）試管內（in vitro）轉酯自剪切動力學模型。生命起源前真實的原始地質環境中，RNA 易受高溫水解與紫外線分解，且缺乏蛋白質外殼保護，如何自發演化出長鏈聚合酶（RNA Replicase）活性仍是當代起源生物學的未解之謎。
      </div>
    </div>
  );
};
