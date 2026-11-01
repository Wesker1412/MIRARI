import React, { useState } from 'react';
import {
  ArrowLeft,
  Share2,
  Info,
  BookOpen,
  ChevronRight,
  Compass,
} from 'lucide-react';
import type { Article } from '../../types';
import { TransitSimulator } from './TransitSimulator';
import { CompanionDock } from '../mascot/CompanionDock';

interface ArticleViewProps {
  article: Article;
  onBackToHome: () => void;
  onOpenArticleBySlug: (slug: string) => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  article,
  onBackToHome,
  onOpenArticleBySlug,
}) => {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Smooth scroll and highlight handler
  const handleNavigateToKnowledge = (targetElementId: string) => {
    setHighlightedId(targetElementId);

    const elem = document.getElementById(targetElementId);
    if (elem) {
      const yOffset = -90; // offset for sticky header
      const y = elem.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });

      // Remove highlight after 4 seconds
      setTimeout(() => {
        setHighlightedId(null);
      }, 4000);
    }
  };

  return (
    <div className="min-h-screen bg-mirari-bg text-mirari-text pb-32">
      {/* Sticky Article Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-mirari-border/80 bg-mirari-bg/85 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToHome}
            className="flex items-center space-x-1.5 text-xs font-mono text-mirari-muted hover:text-white transition px-2.5 py-1.5 rounded-lg border border-transparent hover:border-mirari-border"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回雜誌首頁</span>
          </button>
          <div className="h-4 w-[1px] bg-mirari-border hidden sm:block" />
          <span className="font-serif text-sm font-semibold text-white tracking-wide truncate max-w-[200px] sm:max-w-md hidden sm:inline-block">
            {article.title}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <span className="font-mono text-[11px] text-mirari-amber bg-mirari-amber/15 px-2.5 py-1 rounded-full border border-mirari-amber/30">
            {article.issueNumber}
          </span>
          <button
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert('已複製文章連結至剪貼簿！');
              }
            }}
            className="p-1.5 text-mirari-muted hover:text-white rounded-lg border border-mirari-border/60 hover:border-mirari-muted transition"
            title="分享文章"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Editorial Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
        {/* Article Meta Header */}
        <div className="space-y-4 pb-8 border-b border-mirari-border">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-mirari-cyan/15 px-3 py-1 font-mono text-xs text-mirari-cyan border border-mirari-cyan/30">
              宇宙與天文 · COSMOS
            </span>
            <span className="rounded-full bg-mirari-surface px-3 py-1 font-mono text-xs text-mirari-muted border border-mirari-border">
              互動科普特輯
            </span>
            <span className="font-mono text-xs text-mirari-dim ml-auto">
              發表日期：{article.publishedDate}
            </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.15]">
            {article.title}
          </h1>

          <p className="font-serif text-lg sm:text-2xl text-mirari-muted font-light leading-relaxed">
            {article.subtitle}
          </p>

          <div className="flex flex-wrap items-center justify-between pt-4 text-xs text-mirari-dim font-mono border-t border-mirari-border/40 gap-4">
            <div className="flex items-center space-x-4">
              <span>撰文：MIRARI 天文編輯組</span>
              <span>科學審訂：系外行星研究員</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>學術格式引用代碼：MIRARI-2026-EXOPLANET-01</span>
            </div>
          </div>
        </div>

        {/* Lead In / Abstract Paragraph */}
        <div className="my-8 rounded-2xl border-l-4 border-mirari-amber bg-mirari-card/40 p-6 sm:p-8 backdrop-blur-sm">
          <p className="font-serif text-base sm:text-lg text-mirari-text leading-relaxed italic">
            「在千億顆閃爍的星辰中，有些微弱的光芒每隔數天或數月，就會極為規律地黯淡數個小時，隨後再度復原。這不是恆星本身的疲憊，而是一顆孤獨運行的世界，剛剛自我們與它的母恆星之間無聲穿過。」
          </p>
        </div>

        {/* Knowledge Map Quick Bar */}
        <div className="mb-10 rounded-2xl border border-mirari-border/70 bg-mirari-surface/60 p-4">
          <div className="flex items-center space-x-2 text-xs font-mono text-mirari-muted mb-2.5">
            <Compass className="w-3.5 h-3.5 text-mirari-amber" />
            <span className="font-semibold uppercase tracking-wider text-white">
              本篇結構化知識地圖 (Knowledge Anchors)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {article.knowledgePoints.map((kp) => (
              <button
                key={kp.id}
                onClick={() => handleNavigateToKnowledge(kp.targetElementId)}
                className={`text-xs px-3 py-1.5 rounded-xl border transition flex items-center space-x-1.5 ${
                  highlightedId === kp.targetElementId
                    ? 'bg-mirari-amber text-mirari-bg border-mirari-amber font-bold shadow-lg'
                    : 'bg-mirari-bg/80 text-mirari-muted border-mirari-border hover:border-mirari-cyan/60 hover:text-white'
                }`}
              >
                <span>{kp.title}</span>
                <ChevronRight className="w-3 h-3 opacity-60" />
              </button>
            ))}
          </div>
        </div>

        {/* ─── PART 1: 幾何巧合與凌日定義 ──────────────────────────── */}
        <article className="space-y-8 text-base sm:text-lg leading-relaxed font-sans text-mirari-text/95">
          <section id="kp-transit-concept" className={`space-y-4 p-4 rounded-xl transition-all duration-700 ${
            highlightedId === 'kp-transit-concept' ? 'knowledge-highlight' : ''
          }`}>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide border-b border-mirari-border/60 pb-2">
              一、千億星辰中的幾何巧合
            </h2>
            <p>
              在太陽系之外，尋找系外行星（Exoplanet）最直觀的困難在於：恆星實在太過耀眼，而圍繞它公轉的行星不但體積微小，本身更不發光，僅僅反射極為微弱的星光。若將太陽比作一座高功率探照燈，地球就像在數公里外圍繞探照燈飛舞的一隻極微小飛蛾。直接以光學望遠鏡拍攝行星的「直接成像法」，在絕大多數情況下都會被母恆星的強烈光暈徹底淹沒。
            </p>
            <p>
              然而，幾何學為我們留下了一扇不可思議的視窗。如果一個系外行星系統的公轉軌道平面，<strong>恰好幾乎與我們地球觀測者的視線平行</strong>，那麼在公轉的某一特定相位，行星就會直接穿過恆星圓盤與我們之間。
            </p>
            <div className="my-6 rounded-xl border border-mirari-cyan/30 bg-mirari-cyan/5 p-5 text-sm">
              <span className="font-mono text-xs uppercase tracking-wider text-mirari-cyan block font-bold mb-1">
                幾何先驗條件 · GEOMETRIC TRANSIT PROBABILITY
              </span>
              <p className="text-mirari-text/90 leading-relaxed">
                並非所有系外行星都能從地球上看到凌日。一條半徑為 a 的圓軌道凌日幾何機率大約為：
                <span className="block my-2 font-mono text-center text-mirari-cyan font-bold text-base">
                  P_transit ≈ (R* + Rp) / a ≈ R* / a
                </span>
                對於緊貼恆星運行的「熱木星」（軌道半徑僅 0.05 AU），凌日機率可達 10%；但對於距離類太陽恆星 1 AU 的類地行星，凌日機率驟降至僅約 0.5%。這正是為什麼克卜勒（Kepler）太空望遠鏡必須同時盯著十萬顆恆星，才能捕捉到成千上萬次的凌日事件。
              </p>
            </div>
          </section>

          {/* ─── PART 2: 互動實驗室 (Transit Simulator) ─────────── */}
          <section className="space-y-4 pt-4">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide border-b border-mirari-border/60 pb-2">
              二、親手量測：恆星光度曲線模擬
            </h2>
            <p>
              凌日最直接的物理觀測量是「光度曲線」（Light Curve）——即恆星光通量隨時間變化的連續記錄。
              在下方由 MIRARI 設計的互動天文實驗室中，你可以自由切換不同行星尺度，或親手拖動滑桿，觀察恆星空間投影與即時光度變化的嚴密物理對應關係。
            </p>

            {/* Embedded Interactive Transit Simulator */}
            <div className={`transition-all duration-700 ${
              highlightedId === 'kp-transit-simulator' ? 'knowledge-highlight' : ''
            }`}>
              <TransitSimulator />
            </div>
          </section>

          {/* ─── PART 3: 核心推導：凌日深度與半徑公式 ─────────────── */}
          <section
            id="kp-transit-depth"
            className={`space-y-4 p-4 rounded-xl transition-all duration-700 ${
              highlightedId === 'kp-transit-depth' ? 'knowledge-highlight' : ''
            }`}
          >
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide border-b border-mirari-border/60 pb-2">
              三、凌日深度：從星光變暗推求行星半徑
            </h2>
            <p>
              在最基本的均勻圓盤模型中，恆星被視為一個表面亮度處處相等的圓形發光盤面，其總光通量正比於其可見圓盤面積：
              <span className="font-mono text-mirari-amber font-semibold"> $F_0 \propto \pi R_*^2$</span>。
            </p>
            <p>
              當一個半徑為 $R_p$ 的不透光行星圓盤完全進入恆星盤面內時，它所遮擋的光通量即為它自身的投影截面積：
              <span className="font-mono text-mirari-amber font-semibold"> $\Delta F \propto \pi R_p^2$</span>。
            </p>

            {/* Mathematical Derivation Card */}
            <div className="my-6 rounded-2xl border border-mirari-amber/40 bg-mirari-card/70 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-mirari-amber font-bold uppercase tracking-wider">
                  CORE FORMULA · 核心物理公式
                </span>
                <span className="text-[11px] font-mono text-mirari-dim">
                  TRANSIT DEPTH EQUATION
                </span>
              </div>

              <div className="py-4 text-center border-y border-mirari-border/70 bg-mirari-bg/60 rounded-xl">
                <div className="font-mono text-xl sm:text-2xl font-bold text-mirari-amber tracking-wider">
                  ΔF / F₀ = (R_p / R_*)²
                </div>
                <div className="mt-1 text-xs font-mono text-mirari-dim">
                  凌日深度 (Transit Depth) = 行星半徑與恆星半徑比值的平方
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs leading-relaxed pt-2">
                <div className="bg-mirari-surface p-3.5 rounded-xl border border-mirari-border">
                  <span className="font-bold text-white block mb-1">木星型行星（Jupiter-like）</span>
                  <p className="text-mirari-muted">
                    木星半徑約為太陽的 1/10 ($R_p / R_* \approx 0.1$)。代入公式後，凌日深度約為 $(0.1)^2 = 0.01$，即恆星亮度會下降約 <strong>1.0%</strong>（10,000 ppm）。這在地面中型望遠鏡即可清晰辨識。
                  </p>
                </div>
                <div className="bg-mirari-surface p-3.5 rounded-xl border border-mirari-border">
                  <span className="font-bold text-white block mb-1">地球型岩石行星（Earth-like）</span>
                  <p className="text-mirari-muted">
                    地球半徑僅為太陽的 1/109 ($R_p / R_* \approx 0.0091$)。代入公式後，凌日深度僅為 $(0.0091)^2 \approx 0.000084$，即恆星亮度僅微幅下降 <strong>0.0084%</strong>（84 ppm）。唯有在太空無大氣抖動的環境下才能精確鎖定。
                  </p>
                </div>
              </div>
            </div>

            <p>
              這解答了一個初學者常有的直覺疑問：<strong>「為什麼行星半徑只是變成 2 倍，星光變暗幅度卻會變成 4 倍？」</strong> 原因正是因為光度下降量取決於二維<strong>截面積</strong>（平方關係），而非一維長度！
            </p>
          </section>

          {/* ─── PART 4: 簡化模型假設與周邊昏暗效應 ───────────────── */}
          <section
            id="kp-limb-darkening"
            className={`space-y-4 p-4 rounded-xl transition-all duration-700 ${
              highlightedId === 'kp-limb-darkening' ? 'knowledge-highlight' : ''
            }`}
          >
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide border-b border-mirari-border/60 pb-2">
              四、科學的嚴謹性：簡化假設與「周邊昏暗效應」
            </h2>
            <p>
              在許多科普讀物中，恆星被簡化為一塊發光紙板，使得光度曲線看起來像一個剛硬的「平底箱型」（Boxcar shape）。然而，若你檢視克卜勒或韋伯望遠鏡的真實觀測曲線，會發現底部並不是一條平線，而是呈現一條優美的 <strong>U 型圓弧</strong>。
            </p>

            <div className="my-4 rounded-2xl border border-mirari-border bg-mirari-surface/90 p-5 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-mono text-mirari-cyan">
                <Info className="w-4 h-4" />
                <span className="font-bold">恆星大氣光學深度：為何邊緣看起來比中心暗？</span>
              </div>
              <p className="text-sm text-mirari-muted leading-relaxed">
                恆星是一個高溫氣體等離子體球，並沒有固態表面。當我們直視恆星中心時，視線（Line of Sight）垂直切入，能穿透到較深、溫度較高、輻射強度較強的光球深層；而當視線切向恆星邊緣（Limb）時，由於幾何斜切，光線穿透相同光學深度所對應的物理深度較淺，我們看見的是較高層、溫度較低、輻射較弱的氣體層。
              </p>
              <p className="text-sm text-mirari-muted leading-relaxed">
                這種<strong>「中心亮、邊緣暗」</strong>的現象稱為<strong>周邊昏暗效應（Limb Darkening）</strong>。因此，當行星從邊緣剛進入盤面時，遮蔽的是較暗的區域；當它行進至盤面正中心時，遮蔽的是最明亮的核心，導致恆星光通量在中央食時刻達到最低點，產生平滑的 U 型曲線。
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-mirari-dim space-y-1.5">
              <span className="font-bold text-mirari-amber block">
                MIRARI 編輯部重要提示：簡化模型 ≠ 完整真實物理
              </span>
              <p>
                本文章之互動模擬器提供了「均勻圓盤簡化模型」與「周邊昏暗物理模型」的切換。在實際天體物理前沿研究中，行星軌道偏心率（Eccentricity）、恆星自轉引發的重力昏暗（Gravity Darkening）、恆星黑子（Starspots）以及行星大氣的微米級折射，都會在光度曲線上留下極微小的殘差特徵。科學的進展正是建立在對這些殘差的不斷解析之上。
              </p>
            </div>
          </section>

          {/* ─── PART 5: 延伸前瞻：凌日大氣透射光譜 ───────────────── */}
          <section
            id="kp-spectroscopy"
            className={`space-y-4 p-4 rounded-xl transition-all duration-700 ${
              highlightedId === 'kp-spectroscopy' ? 'knowledge-highlight' : ''
            }`}
          >
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide border-b border-mirari-border/60 pb-2">
              五、超越幾何：用星光穿透外星大氣
            </h2>
            <p>
              凌日法的威力遠不止於測量行星半徑。當行星掠過恆星前方時，其周圍薄薄的大氣層也會被背後的恆星光芒照亮。
            </p>
            <p>
              如果大氣中含有水蒸氣（$H_2O$）、二氧化碳（$CO_2$）或甲烷（$CH_4$），這些分子會在特定的紅外線波長產生強烈吸收。結果是：在特定波長下，行星的大氣層顯得「不透明」，使得測得的行星半徑在該波長下看似微幅變大，凌日深度隨之加深！
            </p>
            <p>
              透過測量<strong>不同波長下的微小凌日深度差異</strong>，韋伯太空望遠鏡（JWST）得以為數百光年外的異星繪製出「透射吸收光譜」（Transmission Spectrum），在未曾踏足該星球半步的前提下，直接探測異星大氣的雲層結構與化學組成。
            </p>
          </section>

          {/* ─── Academic Citations & Sources ─────────────────────── */}
          <section className="pt-8 mt-12 border-t border-mirari-border space-y-4">
            <div className="flex items-center space-x-2 text-xs font-mono text-mirari-muted uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-mirari-cyan" />
              <span>學術參考文獻與可信來源 (Peer-Reviewed References)</span>
            </div>

            <ol className="list-decimal list-inside space-y-2.5 text-xs text-mirari-dim font-mono">
              <li className="leading-relaxed">
                <span className="text-mirari-muted font-semibold">Charbonneau, D., et al. (2000).</span>{' '}
                "Detection of Planetary Transits Across a Sun-like Star." <em>The Astrophysical Journal Letters</em>, 529(1), L45.
              </li>
              <li className="leading-relaxed">
                <span className="text-mirari-muted font-semibold">Seager, S., & Mallén-Ornelas, G. (2003).</span>{' '}
                "A Unique Solution of Planet and Star Parameters from an Extrasolar Planet Transit Light Curve." <em>The Astrophysical Journal</em>, 585(2), 1038.
              </li>
              <li className="leading-relaxed">
                <span className="text-mirari-muted font-semibold">Mandel, K., & Agol, E. (2002).</span>{' '}
                "Analytic Light Curves for Planetary Transit Searches." <em>The Astrophysical Journal Letters</em>, 580(2), L171.
              </li>
              <li className="leading-relaxed">
                <span className="text-mirari-muted font-semibold">NASA Exoplanet Archive (2026).</span>{' '}
                Confirmed Transiting Planets Database, California Institute of Technology.
              </li>
            </ol>
          </section>
        </article>
      </main>

      {/* Floating 3D Mascot Reading Companion Dock */}
      <CompanionDock
        knowledgePoints={article.knowledgePoints}
        onNavigateToKnowledge={handleNavigateToKnowledge}
        onOpenArticleBySlug={onOpenArticleBySlug}
      />
    </div>
  );
};
