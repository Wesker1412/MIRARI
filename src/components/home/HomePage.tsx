import React, { useState } from 'react';
import {
  ArrowRight,
  Sliders,
  Telescope,
  Atom,
  FlaskConical,
  Dna,
  Binary,
  Brain,
  Cpu,
  X,
  Clock,
} from 'lucide-react';
import type { Article, DomainId } from '../../types';
import { DOMAINS } from '../../data/domains';
import { ARTICLES } from '../../data/articles';
import { MirariMascot3D } from '../mascot/MirariMascot3D';
import { AIExplorer } from './AIExplorer';

interface HomePageProps {
  onSelectArticle: (article: Article) => void;
  onExploreDomain: (domainId: DomainId) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onSelectArticle, onExploreDomain }) => {
  const [selectedDomain, setSelectedDomain] = useState<DomainId | 'all'>('all');
  const [prepArticleModal, setPrepArticleModal] = useState<Article | null>(null);

  const coverArticle = ARTICLES.find((a) => a.category === 'cover')!;
  const researchArticles = ARTICLES.filter((a) => a.category === 'research');
  const classicArticles = ARTICLES.filter((a) => a.category === 'classic');
  const seriesArticle = ARTICLES.find((a) => a.category === 'series')!;

  const handleArticleClick = (article: Article) => {
    if (article.status === 'published') {
      onSelectArticle(article);
    } else {
      setPrepArticleModal(article);
    }
  };

  const getDomainIcon = (iconName: string) => {
    switch (iconName) {
      case 'Telescope':
        return <Telescope className="w-4 h-4" />;
      case 'Atom':
        return <Atom className="w-4 h-4" />;
      case 'FlaskConical':
        return <FlaskConical className="w-4 h-4" />;
      case 'Dna':
        return <Dna className="w-4 h-4" />;
      case 'Binary':
        return <Binary className="w-4 h-4" />;
      case 'Brain':
        return <Brain className="w-4 h-4" />;
      case 'Cpu':
        return <Cpu className="w-4 h-4" />;
      default:
        return <Atom className="w-4 h-4" />;
    }
  };

  // Filtered articles
  const filteredArticles =
    selectedDomain === 'all'
      ? ARTICLES
      : ARTICLES.filter((a) => a.domainId === selectedDomain);

  return (
    <div className="min-h-screen bg-mirari-paper text-mirari-ink">
      {/* ─── Top Editorial Masthead ───────────────────────────────── */}
      <header className="border-b border-mirari-line bg-mirari-paper/95 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-baseline space-x-4">
              <span className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-mirari-ink">
                MIRARI
              </span>
              <span className="text-xs text-mirari-dim hidden sm:inline-block font-sans border-l border-mirari-line pl-3">
                探索科學的互動數位雜誌
              </span>
            </div>

            <nav className="flex items-center space-x-4 sm:space-x-6 text-xs font-sans text-mirari-muted">
              <a href="#cover-story" className="hover:text-mirari-ink transition">
                精選專題
              </a>
              <a href="#research-monitor" className="hover:text-mirari-ink transition">
                研究追蹤
              </a>
              <a href="#classic-foundations" className="hover:text-mirari-ink transition">
                經典物理
              </a>
              <a href="#science-domains" className="hover:text-mirari-ink transition hidden sm:inline-block">
                七大領域
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* ─── Cover Feature Spread (Hero Magazine Cover) ────────────── */}
      <section id="cover-story" className="border-b border-mirari-line py-10 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left: Headline Narrative */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center space-x-2 text-xs font-sans text-mirari-amber font-semibold tracking-wider">
                <span>精選專題</span>
                <span className="text-mirari-dim">·</span>
                <span className="text-mirari-muted">宇宙與天文</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-mirari-ink leading-[1.15]">
                {coverArticle.title}
              </h1>

              <p className="font-serif text-lg sm:text-xl text-mirari-muted leading-relaxed font-normal">
                {coverArticle.subtitle}
              </p>

              <p className="text-sm sm:text-base text-mirari-muted/90 leading-relaxed font-sans line-clamp-3">
                {coverArticle.leadParagraph}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => onSelectArticle(coverArticle)}
                  className="inline-flex items-center space-x-2.5 rounded-xl bg-mirari-ink px-6 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-black active:scale-95 transition"
                >
                  <Sliders className="w-4 h-4 text-mirari-amber" />
                  <span>進入互動閱讀</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="text-xs text-mirari-dim font-sans">
                  包含恆星空間投影與即時光度模擬
                </div>
              </div>
            </div>

            {/* Right: Graphic Astronomical Spread + Small Mascot Emblem */}
            <div className="lg:col-span-5 relative">
              <div
                onClick={() => onSelectArticle(coverArticle)}
                className="group relative rounded-3xl bg-mirari-space p-6 sm:p-8 cursor-pointer shadow-xl overflow-hidden border border-mirari-spaceBorder transition-all duration-300 hover:border-mirari-amber/40"
              >
                {/* Visual Starfield */}
                <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-6 border-b border-white/10 pb-3">
                  <span>TRANSIT OBSERVATION</span>
                  <span className="text-amber-400">ΔF / F₀ = (Rp/R*)²</span>
                </div>

                {/* Graphic Transit Visual */}
                <div className="relative h-48 rounded-2xl bg-gradient-to-tr from-mirari-spacePlate to-slate-900 border border-white/10 flex items-center justify-center overflow-hidden">
                  {/* Star */}
                  <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-100 shadow-[0_0_40px_rgba(245,158,11,0.5)] flex items-center justify-center relative">
                    {/* Planet shadow passing */}
                    <div className="w-6 h-6 rounded-full bg-black border border-sky-400/80 absolute -left-2 shadow-md" />
                  </div>
                  {/* Transit line */}
                  <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-sky-400/30" />
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-400 font-sans">
                  <span>點選直接體驗幾何光度實驗</span>
                  <span className="text-white group-hover:text-amber-400 flex items-center space-x-1 font-medium transition">
                    <span>開始探索</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Ambient Floating Mascot Emblem */}
              <div className="absolute -bottom-6 -right-4 w-20 h-20 sm:w-24 sm:h-24 pointer-events-none select-none">
                <MirariMascot3D size="companion" state="idle" interactive={false} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Natural Language Exploration Strip ─────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AIExplorer onSelectArticle={handleArticleClick} />
      </section>

      {/* ─── Research Monitor (最新研究追蹤) ───────────────────────── */}
      <section id="research-monitor" className="py-12 border-t border-mirari-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between mb-8 pb-4 border-b border-mirari-line gap-2">
            <div>
              <span className="text-xs uppercase tracking-wider text-mirari-cobalt font-sans font-semibold block">
                學術研究追蹤
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mirari-ink">
                近期期刊解讀
              </h2>
            </div>
            <span className="text-xs text-mirari-dim font-sans">
              由編輯部整理之學術文獻深度摘要（專題籌備中）
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {researchArticles.map((article) => (
              <article
                key={article.id}
                onClick={() => handleArticleClick(article)}
                className="group rounded-2xl border border-mirari-line bg-white p-6 flex flex-col justify-between hover:border-mirari-border hover:shadow-md transition cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-sans font-medium text-mirari-cobalt">
                      {article.journalReference?.journal} · {article.journalReference?.year}
                    </span>
                    <span className="text-[11px] text-mirari-dim bg-mirari-paper px-2 py-0.5 rounded border border-mirari-line">
                      企劃中
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-mirari-ink group-hover:text-mirari-amber transition line-clamp-2 leading-snug">
                    {article.title}
                  </h3>

                  <p className="text-xs text-mirari-muted line-clamp-3 leading-relaxed">
                    {article.summary}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-mirari-line/60 flex items-center justify-between text-xs text-mirari-dim">
                  <span>查看題綱概要</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-mirari-ink" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Classic Foundations (經典科普) ─────────────────────────── */}
      <section id="classic-foundations" className="py-12 border-t border-mirari-line bg-mirari-surfaceAlt/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between mb-8 pb-4 border-b border-mirari-line gap-2">
            <div>
              <span className="text-xs uppercase tracking-wider text-mirari-amber font-sans font-semibold block">
                思想實驗與基石
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-mirari-ink">
                經典物理與科學本質
              </h2>
            </div>
            <span className="text-xs text-mirari-dim font-sans">
              具有長期探索價值的科學核心課題
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {classicArticles.map((article) => (
              <article
                key={article.id}
                onClick={() => handleArticleClick(article)}
                className="group rounded-2xl border border-mirari-line bg-white p-6 flex flex-col justify-between hover:border-mirari-border hover:shadow-md transition cursor-pointer"
              >
                <div className="space-y-3">
                  <span className="text-xs font-sans text-mirari-amber font-medium block">
                    {article.topicBadge}
                  </span>

                  <h3 className="font-serif text-lg font-bold text-mirari-ink group-hover:text-mirari-amber transition line-clamp-2 leading-snug">
                    {article.title}
                  </h3>

                  <p className="text-xs text-mirari-muted line-clamp-3 leading-relaxed">
                    {article.summary}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-mirari-line/60 flex items-center justify-between text-xs text-mirari-dim">
                  <span>查看選題方向</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-mirari-ink" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Seven Scientific Domains (七大領域索引) ─────────────────── */}
      <section id="science-domains" className="py-14 border-t border-mirari-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
            <h2 className="font-serif text-3xl font-bold text-mirari-ink">
              七大科學領域
            </h2>
            <p className="text-xs sm:text-sm text-mirari-muted font-sans">
              橫跨深空天體、微觀量子至大腦感知的知識體系。
            </p>
          </div>

          {/* Domain Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {DOMAINS.map((domain) => (
              <div
                key={domain.id}
                onClick={() => {
                  setSelectedDomain(domain.id === selectedDomain ? 'all' : domain.id);
                  onExploreDomain(domain.id);
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedDomain === domain.id
                    ? 'border-mirari-amber bg-white shadow-md ring-1 ring-mirari-amber/20'
                    : 'border-mirari-line bg-white hover:border-mirari-border hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="p-2 rounded-xl bg-mirari-paper text-mirari-ink border border-mirari-line">
                      {getDomainIcon(domain.iconName)}
                    </span>
                    <span className="text-[11px] font-mono text-mirari-dim">
                      {domain.nameEn}
                    </span>
                  </div>

                  <h3 className="font-serif text-base font-bold text-mirari-ink">
                    {domain.nameZh}
                  </h3>

                  <p className="mt-1 text-xs text-mirari-muted line-clamp-2 leading-relaxed font-sans">
                    {domain.tagline}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-mirari-line/60 text-[11px] font-sans text-mirari-dim flex items-center justify-between">
                  <span>{selectedDomain === domain.id ? '篩選中' : '檢視專案'}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>

          {/* Filtered view if domain clicked */}
          {selectedDomain !== 'all' && (
            <div className="mt-8 p-6 rounded-2xl bg-white border border-mirari-line space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans text-mirari-ink font-semibold">
                  【{DOMAINS.find((d) => d.id === selectedDomain)?.nameZh}】領域文章：
                </span>
                <button
                  onClick={() => setSelectedDomain('all')}
                  className="text-xs text-mirari-dim hover:text-mirari-ink underline"
                >
                  清除篩選
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredArticles.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => handleArticleClick(art)}
                    className="p-4 rounded-xl border border-mirari-line hover:border-mirari-border transition cursor-pointer bg-mirari-paper"
                  >
                    <div className="flex items-center justify-between mb-1 text-[11px]">
                      <span className="text-mirari-amber font-medium">{art.topicBadge}</span>
                      <span className="text-mirari-dim">
                        {art.status === 'published' ? '可閱讀' : '籌備中'}
                      </span>
                    </div>
                    <h4 className="font-serif text-sm font-bold text-mirari-ink line-clamp-1">
                      {art.title}
                    </h4>
                    <p className="mt-1 text-xs text-mirari-muted line-clamp-2">
                      {art.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── Curated Series ─────────────────────────────────────────── */}
      <section className="py-12 border-t border-mirari-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-mirari-line bg-white p-6 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs uppercase tracking-wider text-mirari-amber font-semibold block">
                系列專題
              </span>
              <h3 className="font-serif text-2xl font-bold text-mirari-ink">
                {seriesArticle.title}
              </h3>
              <p className="text-sm text-mirari-muted leading-relaxed font-sans">
                {seriesArticle.summary}
              </p>
            </div>
            <button
              onClick={() => handleArticleClick(seriesArticle)}
              className="shrink-0 px-5 py-2.5 rounded-xl border border-mirari-line bg-mirari-paper hover:bg-mirari-surfaceAlt text-xs font-sans font-medium text-mirari-ink transition flex items-center space-x-1.5"
            >
              <span>查看系列規劃</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-mirari-line py-8 bg-mirari-paper text-xs text-mirari-dim font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-serif font-bold text-mirari-ink text-sm">MIRARI</span>
            <span>· 探索科學的互動數位雜誌</span>
          </div>
          <div>
            © 2026 MIRARI. 版權所有。
          </div>
        </div>
      </footer>

      {/* ─── In Preparation Article Modal ───────────────────────────── */}
      {prepArticleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-mirari-ink/30 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-mirari-border shadow-2xl p-6 sm:p-8 space-y-4">
            <button
              onClick={() => setPrepArticleModal(null)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-mirari-dim hover:text-mirari-ink hover:bg-mirari-surfaceAlt transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 text-xs font-sans text-mirari-amber font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>選題籌備中</span>
            </div>

            <h3 className="font-serif text-xl sm:text-2xl font-bold text-mirari-ink">
              {prepArticleModal.title}
            </h3>

            <p className="font-serif text-sm text-mirari-muted leading-relaxed">
              {prepArticleModal.subtitle}
            </p>

            <div className="p-4 rounded-xl bg-mirari-paper border border-mirari-line text-xs text-mirari-muted space-y-2 leading-relaxed">
              <strong className="text-mirari-ink block">選題規劃概要：</strong>
              <p>{prepArticleModal.leadParagraph}</p>
              {prepArticleModal.journalReference && (
                <p className="text-mirari-dim font-mono pt-1">
                  參考文獻來源：{prepArticleModal.journalReference.journal} ({prepArticleModal.journalReference.year})
                </p>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                onClick={() => setPrepArticleModal(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-sans text-mirari-muted hover:text-mirari-ink transition"
              >
                關閉
              </button>
              <button
                onClick={() => {
                  setPrepArticleModal(null);
                  onSelectArticle(coverArticle);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-mirari-ink text-white text-xs font-sans font-medium hover:bg-black transition flex items-center justify-center space-x-1.5"
              >
                <span>先看精選互動特輯《當星光暗了一點》</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
