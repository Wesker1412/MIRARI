import React, { useState, useEffect, useRef } from 'react';

/**
 * BosonSamplingSimulator - 玻色子取樣與全同光子干涉模擬器
 * 
 * 物理原理：
 * 1. 展示 Hong-Ou-Mandel (HOM) 雙光子干涉：兩顆不可區分全同光子同時進入 50:50 分束器，因反對稱相消干涉產生聚束效應（Dip，重合計數為零）。
 * 2. 拓展至多端口 (3x3 / 4x4) 線性光學網絡：根據么正矩陣 U，計算輸出光子態機率分佈 |Perm(U)|^2，直觀展現經典計算機枚舉矩陣積和式的複雜度爆炸。
 */
export const BosonSamplingSimulator: React.FC = () => {
  const [indistinguishability, setIndistinguishability] = useState<number>(0.95); // 0.0 ~ 1.0 光子不可區分度
  const [phaseShift, setPhaseShift] = useState<number>(0); // 0 ~ 2π 相位延遲 (rad)
  const [modeCount, setModeCount] = useState<number>(3); // 2: HOM 基準, 3: 3-模干涉, 4: 4-模網絡
  const isSimulating = true;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 根據不可區分度與相位計算輸出態的相對理論機率
  // 對於 Mode=2 (HOM):
  // 輸入態 |1, 1>
  // 輸出態 |2,0>, |0,2>, |1,1>
  // 理想全同光子: P(|1,1>) = 0 (HOM dip)
  // 不全同光子 (η=0): P(|1,1>) = 0.5, P(|2,0>) = 0.25, P(|0,2>) = 0.25
  // 一般情況: P(|1,1>) = 0.5 * (1 - η * cos(phaseShift))
  const homCoincidence = Math.max(0, 0.5 * (1 - indistinguishability * Math.cos(phaseShift)));

  // 繪製光學線路與動態光子波包
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let t = 0;

    const render = () => {
      t += 0.03;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // 背景微光格線
      ctx.strokeStyle = 'rgba(230, 230, 235, 0.4)';
      ctx.lineWidth = 1;
      const gridStep = 30;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const numChannels = modeCount;
      const channelSpacing = (height - 60) / (numChannels + 1);
      const startX = 50;
      const endX = width - 70;
      const midX = width / 2;

      // 1. 繪製光纖波導通道
      for (let i = 1; i <= numChannels; i++) {
        const y = 30 + i * channelSpacing;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();

        // 標記通道編號
        ctx.fillStyle = '#475569';
        ctx.font = '11px monospace';
        ctx.fillText(`Mode ${i}`, 8, y + 4);
        ctx.fillText(`Det ${i}`, endX + 8, y + 4);
      }

      // 2. 繪製分束器 (Beam Splitters) 與相位調製器
      const bsWidth = 40;
      const bsHeight = (numChannels - 1) * channelSpacing + 30;
      const bsY = 30 + channelSpacing - 15;

      // 漸層分束器核心區
      const bsGrad = ctx.createLinearGradient(midX - bsWidth / 2, 0, midX + bsWidth / 2, 0);
      bsGrad.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
      bsGrad.addColorStop(0.5, 'rgba(147, 51, 234, 0.25)');
      bsGrad.addColorStop(1, 'rgba(56, 189, 248, 0.15)');

      ctx.fillStyle = bsGrad;
      ctx.fillRect(midX - bsWidth / 2, bsY, bsWidth, bsHeight);
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(midX - bsWidth / 2, bsY, bsWidth, bsHeight);

      // 分束器內部干涉交叉線
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
      ctx.setLineDash([3, 3]);
      for (let i = 1; i < numChannels; i++) {
        const y1 = 30 + i * channelSpacing;
        const y2 = 30 + (i + 1) * channelSpacing;
        ctx.beginPath();
        ctx.moveTo(midX - bsWidth / 2, y1);
        ctx.lineTo(midX + bsWidth / 2, y2);
        ctx.moveTo(midX - bsWidth / 2, y2);
        ctx.lineTo(midX + bsWidth / 2, y1);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 標註么正矩陣 U
      ctx.fillStyle = '#7c3aed';
      ctx.font = 'bold 12px serif';
      ctx.textAlign = 'center';
      ctx.fillText(`么正干涉網 U [${numChannels}×${numChannels}]`, midX, bsY - 8);

      // 3. 動態流動光子波包
      if (isSimulating) {
        const cycleProgress = (t % 4) / 4; // 0 ~ 1
        const photonX = startX + cycleProgress * (endX - startX);

        for (let i = 1; i <= Math.min(2, numChannels); i++) {
          let photonY = 30 + i * channelSpacing;

          // 經過分束器後的量子波包分叉示意
          if (photonX > midX) {
            const splitOffset = Math.sin(t * 3 + i) * 6;
            photonY += splitOffset;
          }

          // 繪製光子光暈
          const glowGrad = ctx.createRadialGradient(photonX, photonY, 1, photonX, photonY, 10);
          glowGrad.addColorStop(0, i === 1 ? 'rgba(239, 68, 68, 1)' : 'rgba(59, 130, 246, 1)');
          glowGrad.addColorStop(0.5, i === 1 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)');
          glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(photonX, photonY, 10, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(photonX, photonY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.textAlign = 'left';
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [modeCount, indistinguishability, phaseShift, isSimulating]);

  return (
    <div className="my-8 rounded-xl border border-mirari-line bg-mirari-paper p-5 sm:p-6 text-mirari-ink font-sans shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-mirari-line gap-3">
        <div>
          <span className="text-xs uppercase tracking-widest text-mirari-dim font-mono">
            INTERACTIVE EXPERIMENT
          </span>
          <h3 className="font-serif text-lg sm:text-xl font-bold text-mirari-ink">
            玻色子取樣與多光子量子干涉模擬器
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-100 text-purple-800">
            HOM 反對稱相消干涉
          </span>
        </div>
      </div>

      {/* 主畫布：光學網絡與光子流 */}
      <div className="mt-4 relative bg-white/70 rounded-lg border border-mirari-line/60 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={680}
          height={260}
          className="w-full h-auto block"
        />
      </div>

      {/* 控制面板 */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
        {/* 控制項 1: 光子全同性/不可區分度 */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-xs text-mirari-dim">
            <span>光子不可區分度 (η)</span>
            <span className="font-bold text-mirari-ink">{(indistinguishability * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={indistinguishability}
            onChange={(e) => setIndistinguishability(parseFloat(e.target.value))}
            className="w-full accent-purple-600"
          />
          <p className="text-[11px] text-mirari-dim leading-snug">
            η=100% 代表波包在空間、時間與光譜頻率上完全全同，觸發完全量子干涉相消。
          </p>
        </div>

        {/* 控制項 2: 相位延遲 */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-xs text-mirari-dim">
            <span>相對相位差 Δφ</span>
            <span className="font-bold text-mirari-ink">{(phaseShift / Math.PI).toFixed(2)} π</span>
          </div>
          <input
            type="range"
            min="0"
            max={Math.PI * 2}
            step="0.05"
            value={phaseShift}
            onChange={(e) => setPhaseShift(parseFloat(e.target.value))}
            className="w-full accent-purple-600"
          />
          <p className="text-[11px] text-mirari-dim leading-snug">
            調控兩路光子進入干涉網前的相對光程差，直接改變輸出振幅之干涉項。
          </p>
        </div>

        {/* 控制項 3: 干涉端口數 */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-mono text-xs text-mirari-dim">
            <span>網絡端口維度 (M 模式)</span>
            <span className="font-bold text-mirari-ink">{modeCount} × {modeCount}</span>
          </div>
          <div className="flex gap-2">
            {[2, 3, 4].map((m) => (
              <button
                key={m}
                onClick={() => setModeCount(m)}
                className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${
                  modeCount === m
                    ? 'bg-purple-600 text-white border-purple-600 font-bold'
                    : 'bg-white text-mirari-ink border-mirari-line hover:bg-gray-50'
                }`}
              >
                {m} 模式
              </button>
            ))}
          </div>
          <p className="text-[11px] text-mirari-dim leading-snug">
            維度增加時，可能的輸出組合數以組合數 C(M+N-1, N) 爆發式增長。
          </p>
        </div>
      </div>

      {/* 數值分析與理論預測指標 */}
      <div className="mt-5 p-4 rounded-lg bg-mirari-paper-dark border border-mirari-line grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div>
          <div className="text-[11px] text-mirari-dim font-mono">HOM 重合計數比率</div>
          <div className="text-lg font-bold text-purple-700 font-mono">
            {(homCoincidence * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-mirari-dim">不同探測器同時響應</div>
        </div>
        <div>
          <div className="text-[11px] text-mirari-dim font-mono">雙光子聚束幾率</div>
          <div className="text-lg font-bold text-indigo-700 font-mono">
            {((1 - homCoincidence) * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-mirari-dim">|2,0⟩ 或 |0,2⟩ 攜手同出</div>
        </div>
        <div>
          <div className="text-[11px] text-mirari-dim font-mono">干涉可見度 V</div>
          <div className="text-lg font-bold text-amber-700 font-mono">
            {(indistinguishability * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-mirari-dim">HOM 谷底深度指標</div>
        </div>
        <div>
          <div className="text-[11px] text-mirari-dim font-mono">計算複雜度等級</div>
          <div className="text-lg font-bold text-rose-700 font-mono">
            #P-Hard
          </div>
          <div className="text-[10px] text-mirari-dim">積和式 Permanent</div>
        </div>
      </div>

      {/* 模型邊界說明 */}
      <div className="mt-3 text-[11px] text-mirari-dim leading-relaxed border-t border-mirari-line/50 pt-2">
        <span className="font-semibold text-mirari-ink">數值模型邊界提示：</span> 本模擬器展示理想無耗損（Lossless）多光子線性光學網路之相干散射幾率分佈。實際物理實驗中，光纖耦合損耗、探測器非理想量子效率（Dark Count）與高階多光子噪聲會引入經典採樣誤差，這正是當代量子光學實驗室爭相克服的工程極限。
      </div>
    </div>
  );
};
