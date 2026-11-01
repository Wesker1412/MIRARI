import React, { useState } from 'react';
import { ArrowLeft, Share2, BookOpen } from 'lucide-react';
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

  const handleNavigateToKnowledge = (targetElementId: string) => {
    setHighlightedId(targetElementId);

    const elem = document.getElementById(targetElementId);
    if (elem) {
      const yOffset = -80;
      const y = elem.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });

      setTimeout(() => {
        setHighlightedId(null);
      }, 3500);
    }
  };

  return (
    <div className="min-h-screen bg-mirari-paper text-mirari-ink pb-32">
      {/* ─── Top Editorial Nav ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-mirari-line bg-mirari-paper/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToHome}
            className="flex items-center space-x-1.5 text-xs font-sans text-mirari-muted hover:text-mirari-ink transition px-2.5 py-1.5 rounded-lg border border-mirari-line hover:border-mirari-border"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>首頁</span>
          </button>
          <div className="h-4 w-[1px] bg-mirari-line hidden sm:block" />
          <span className="font-serif text-sm font-semibold text-mirari-ink truncate max-w-[240px] sm:max-w-md hidden sm:inline-block">
            {article.title}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert('已複製文章連結至剪貼簿');
              }
            }}
            className="p-1.5 text-mirari-dim hover:text-mirari-ink rounded-lg border border-mirari-line hover:border-mirari-border transition"
            title="分享文章"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ─── Article Reading Spine ─────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
        {/* Header */}
        <header className="space-y-4 pb-8 border-b border-mirari-line">
          <div className="flex items-center space-x-2 text-xs font-sans text-mirari-amber">
            <span className="font-semibold tracking-wider">宇宙與天文</span>
            <span className="text-mirari-dim">·</span>
            <span className="text-mirari-dim">系外行星觀測</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-mirari-ink leading-[1.2]">
            {article.title}
          </h1>

          <p className="font-serif text-lg sm:text-xl text-mirari-muted font-normal leading-relaxed">
            {article.subtitle}
          </p>

          <div className="flex flex-wrap items-center justify-between pt-4 text-xs text-mirari-dim border-t border-mirari-line/60 gap-3">
            <div className="flex items-center space-x-3">
              <span>文／MIRARI 科學組</span>
              <span>·</span>
              <span>審訂／系外行星研究員</span>
            </div>
            <span>精選專題</span>
          </div>
        </header>

        {/* Lead In / Abstract */}
        <div className="my-8 pl-5 border-l-2 border-mirari-amber py-1">
          <p className="font-serif text-base sm:text-lg text-mirari-ink leading-relaxed italic">
            「在千億顆閃爍的星辰中，有些微弱的光芒每隔數天或數月，就會極為規律地黯淡數個小時，隨後再度復原。這不是恆星本身的疲憊，而是一顆孤獨運行的世界，剛剛自我們與它的母恆星之間無聲穿過。」
          </p>
        </div>

        {/* Article Body */}
        <article className="space-y-8 text-base sm:text-[17px] leading-[1.85] font-sans text-mirari-ink">
          {/* Section 1 */}
          <section
            id="kp-transit-concept"
            className={`space-y-4 p-4 rounded-xl transition-all duration-700 ${
              highlightedId === 'kp-transit-concept' ? 'knowledge-highlight' : ''
            }`}
          >
            <h2 className="font-serif text-2xl font-bold text-mirari-ink tracking-tight pt-2">
              一、千億星辰中的幾何巧合
            </h2>
            <p>
              在太陽系之外，尋找系外行星（Exoplanet）最直觀的困難在於：恆星實在太過耀眼，而圍繞它公轉的行星不但體積微小，本身更不發光，僅僅反射極為微弱的星光。若將母恆星比作高功率探照燈，行星就像在數公里外圍繞探照燈飛舞的微小飛蛾。直接以光學望遠鏡拍攝行星的直接成像法，在絕大多數情況下都會被強烈光暈淹沒。
            </p>
            <p>
              然而，幾何學為我們留下了一扇精密的視窗。如果一個系外行星系統的公轉軌道平面，<strong>恰好幾乎與我們地球觀測者的視線平行</strong>，那麼在公轉的某一特定相位，行星就會直接穿過恆星圓盤與我們之間。這項現象即被稱為「凌日」（Transit）。
            </p>
            <div className="my-5 rounded-xl border border-mirari-line bg-white p-5 text-sm space-y-2">
              <span className="font-sans text-xs uppercase tracking-wider text-mirari-amber font-semibold block">
                幾何凌日機率
              </span>
              <p className="text-mirari-muted leading-relaxed">
                並非所有系外行星都能從地球上看到凌日。一條半徑為 a 的圓軌道凌日幾何機率大約為：
              </p>
              <div className="py-2 text-center font-mono text-mirari-ink font-semibold">
                P_transit ≈ (R_* + R_p) / a ≈ R_* / a
              </div>
              <p className="text-mirari-muted leading-relaxed">
                對於緊貼恆星運行的熱木星（軌道半徑僅 0.05 AU），凌日機率可達 10%；但對於距離類太陽恆星 1 AU 的類地行星，凌日機率驟降至僅約 0.5%。這正是為什麼克卜勒（Kepler）望遠鏡必須同時監測數以十萬計的恆星，才能捕捉到足夠多的凌日事件。
              </p>
            </div>
          </section>

          {/* Section 2: Simulator */}
          <section className="space-y-4 pt-2">
            <h2 className="font-serif text-2xl font-bold text-mirari-ink tracking-tight">
              二、親手量測：恆星光度曲線模擬
            </h2>
            <p>
              凌日最直接的物理觀測量是「光度曲線」（Light Curve）——即恆星光通量隨時間變化的連續記錄。
              在下方互動實驗中，你可以切換不同行星尺度或手動拖動滑桿，觀察恆星空間投影與即時光度變化的嚴密對應：
            </p>

            <div className={`transition-all duration-700 ${
              highlightedId === 'kp-transit-simulator' ? 'knowledge-highlight' : ''
            }`}>
              <TransitSimulator />
            </div>
          </section>

          {/* Section 3: Depth and Radius */}
          <section
            id="kp-transit-depth"
            className={`space-y-4 p-4 rounded-xl transition-all duration-700 ${
              highlightedId === 'kp-transit-depth' ? 'knowledge-highlight' : ''
            }`}
          >
            <h2 className="font-serif text-2xl font-bold text-mirari-ink tracking-tight pt-2">
              三、凌日深度：從星光變暗推求行星半徑
            </h2>
            <p>
              在最基本的均勻圓盤模型中，恆星被視為一個表面亮度處處相等的圓形發光盤面，其總光通量正比於其可見圓盤面積：$F_0 \propto \pi R_*^2$。
            </p>
            <p>
              當一個半徑為 $R_p$ 的不透光行星圓盤完全進入恆星盤面內時，它所遮擋的光通量即為自身投影截面積：$\Delta F \propto \pi R_p^2$。
            </p>

            {/* Core Formula Card */}
            <div className="my-6 rounded-2xl border border-mirari-line bg-white p-6 shadow-sm space-y-4">
              <span className="font-sans text-xs uppercase tracking-wider text-mirari-amber font-semibold block">
                核心物理關係
              </span>

              <div className="py-4 text-center border-y border-mirari-line bg-mirari-paper rounded-xl">
                <div className="font-mono text-xl sm:text-2xl font-bold text-mirari-ink tracking-wider">
                  ΔF / F₀ = (R_p / R_*)²
                </div>
                <div className="mt-1 text-xs text-mirari-dim">
                  凌日深度 (Transit Depth) = 行星半徑與恆星半徑比值的平方
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs leading-relaxed pt-1">
                <div className="bg-mirari-paper p-3.5 rounded-xl border border-mirari-line">
                  <span className="font-bold text-mirari-ink block mb-1">木星型行星（Jupiter-like）</span>
                  <p className="text-mirari-muted">
                    木星半徑約為太陽的 1/10 ($R_p / R_* \approx 0.1$)。代入公式後，凌日深度約為 $(0.1)^2 = 0.01$，即恆星亮度會下降約 <strong>1.0%</strong>（10,000 ppm）。這在地面中型望遠鏡即可清晰辨識。
                  </p>
                </div>
                <div className="bg-mirari-paper p-3.5 rounded-xl border border-mirari-line">
                  <span className="font-bold text-mirari-ink block mb-1">地球型岩石行星（Earth-like）</span>
                  <p className="text-mirari-muted">
                    地球半徑僅為太陽的 1/109 ($R_p / R_* \approx 0.0091$)。代入公式後，凌日深度僅約 <strong>0.0084%</strong>（84 ppm），唯有在太空無大氣擾動的環境下才能精確鎖定。
                  </p>
                </div>
              </div>
            </div>

            <p>
              這說明了為何<strong>「行星半徑只是變成 2 倍，星光變暗幅度卻會變成 4 倍」</strong>：因為光度下降量取決於二維<strong>截面積</strong>（平方關係），而非一維長度。
            </p>
          </section>

          {/* Section 4: Limb Darkening */}
          <section
            id="kp-limb-darkening"
            className={`space-y-4 p-4 rounded-xl transition-all duration-700 ${
              highlightedId === 'kp-limb-darkening' ? 'knowledge-highlight' : ''
            }`}
          >
            <h2 className="font-serif text-2xl font-bold text-mirari-ink tracking-tight pt-2">
              四、觀測細節：恆星周邊昏暗效應
            </h2>
            <p>
              若仔細檢視克卜勒或韋伯望遠鏡的真實觀測曲線，會發現底部並不是一條平直線，而是呈現一條圓滑的 <strong>U 型曲線</strong>。
            </p>

            <div className="my-4 rounded-xl border border-mirari-line bg-white p-5 space-y-2">
              <span className="font-sans text-xs font-semibold text-mirari-ink block">
                恆星大氣光學厚度：為何邊緣看起來比中心暗？
              </span>
              <p className="text-sm text-mirari-muted leading-relaxed">
                恆星是由高溫電漿構成的球體，並無固態表面。當我們直視恆星中心時，視線垂直切入，能穿透到較深、溫度較高、輻射強度較強的光球深層；而當視線切向恆星邊緣時，由於斜向穿透，光線到達相同光學厚度所對應的物理深度較淺，我們看見的是較高層、溫度較低的氣體層。
              </p>
              <p className="text-sm text-mirari-muted leading-relaxed">
                這種<strong>「中心亮、邊緣暗」</strong>的現象稱為<strong>周邊昏暗效應（Limb Darkening）</strong>。因此，當行星穿過恆星正中心時遮擋了最明亮的核心，導致恆星光通量在中央食時刻達到最低點，產生平滑的 U 型曲線。
              </p>
            </div>
          </section>

          {/* Section 5: Spectroscopy */}
          <section
            id="kp-spectroscopy"
            className={`space-y-4 p-4 rounded-xl transition-all duration-700 ${
              highlightedId === 'kp-spectroscopy' ? 'knowledge-highlight' : ''
            }`}
          >
            <h2 className="font-serif text-2xl font-bold text-mirari-ink tracking-tight pt-2">
              五、延伸：用星光穿透外星大氣
            </h2>
            <p>
              凌日法的潛力不僅止於測量幾何半徑。當行星掠過恆星前方時，其外緣稀薄的大氣層也會被背後的恆星光芒穿透。
            </p>
            <p>
              如果大氣中含有水蒸氣（$H_2O$）、二氧化碳（$CO_2$）或甲烷（$CH_4$），這些分子會在特定紅外波長產生吸收。在這些波長下，行星大氣顯得不透明，使得行星看起來微幅「變大」，凌日深度加深。透過分析不同波長下的凌日深度微差，韋伯太空望遠鏡（JWST）得以為數百光年外的世界繪製出「透射光譜」，揭示外星大氣的化學組成。
            </p>
          </section>

          {/* References */}
          <section className="pt-8 mt-12 border-t border-mirari-line space-y-3">
            <div className="flex items-center space-x-2 text-xs font-sans text-mirari-dim">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="font-semibold uppercase tracking-wider">參考文獻</span>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-xs text-mirari-muted font-mono leading-relaxed">
              <li>
                Charbonneau, D., et al. (2000). "Detection of Planetary Transits Across a Sun-like Star." <em>The Astrophysical Journal Letters</em>, 529(1), L45.
              </li>
              <li>
                Seager, S., & Mallén-Ornelas, G. (2003). "A Unique Solution of Planet and Star Parameters from an Extrasolar Planet Transit Light Curve." <em>The Astrophysical Journal</em>, 585(2), 1038.
              </li>
              <li>
                Mandel, K., & Agol, E. (2002). "Analytic Light Curves for Planetary Transit Searches." <em>The Astrophysical Journal Letters</em>, 580(2), L171.
              </li>
              <li>
                NASA Exoplanet Archive (2024). Confirmed Transiting Planets Database.
              </li>
            </ol>
          </section>
        </article>
      </main>

      {/* ─── Minimalist 3D Mascot Reading Companion ─────────────────── */}
      <CompanionDock
        knowledgePoints={article.knowledgePoints}
        onNavigateToKnowledge={handleNavigateToKnowledge}
        onOpenArticleBySlug={onOpenArticleBySlug}
      />
    </div>
  );
};
