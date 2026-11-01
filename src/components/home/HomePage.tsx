import React, { useState } from 'react';
import {
  ArrowRight,
  Sliders,
  Compass,
  Telescope,
  Atom,
  FlaskConical,
  Dna,
  Binary,
  Brain,
  Cpu,
  Layers,
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
  const [mascotMood, setMascotMood] = useState<'idle' | 'thinking' | 'excited'>('idle');

  const coverArticle = ARTICLES.find((a) => a.category === 'cover')!;
  const researchArticles = ARTICLES.filter((a) => a.category === 'research');
  const classicArticles = ARTICLES.filter((a) => a.category === 'classic');

  // Filtered domain articles
  const filteredArticles =
    selectedDomain === 'all'
      ? ARTICLES
      : ARTICLES.filter((a) => a.domainId === selectedDomain);

  // Icon map for domain cards
  const getDomainIcon = (iconName: string) => {
    switch (iconName) {
      case 'Telescope':
        return <Telescope className="w-5 h-5" />;
      case 'Atom':
        return <Atom className="w-5 h-5" />;
      case 'FlaskConical':
        return <FlaskConical className="w-5 h-5" />;
      case 'Dna':
        return <Dna className="w-5 h-5" />;
      case 'Binary':
        return <Binary className="w-5 h-5" />;
      case 'Brain':
        return <Brain className="w-5 h-5" />;
      case 'Cpu':
        return <Cpu className="w-5 h-5" />;
      default:
        return <Compass className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-mirari-bg text-mirari-text">
      {/* ─── Top Editorial Masthead ───────────────────────────────── */}
      <header className="border-b border-mirari-border/70 bg-mirari-bg/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top metadata strip */}
          <div className="flex items-center justify-between py-2 text-[11px] font-mono text-mirari-dim border-b border-mirari-border/40">
            <div className="flex items-center space-x-3">
              <span>ISSN 2026-MIRARI</span>
              <span>·</span>
              <span>VOL. 01 — 創刊號</span>
              <span>·</span>
              <span className="text-mirari-amber font-medium">繁體中文數位科學雜誌</span>
            </div>
            <div className="hidden sm:flex items-center space-x-4">
              <span>LATIN: <em>mirari</em> (驚嘆·探索未知)</span>
              <span>·</span>
              <span>DIGITAL SCIENCE EDITORIAL</span>
            </div>
          </div>

          {/* Brand Logo & Global Navigation */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-baseline space-x-3">
              <span className="font-serif text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                MIRARI
              </span>
              <span className="font-sans text-xs tracking-widest text-mirari-amber font-semibold uppercase">
                ミラリ
              </span>
              <span className="hidden md:inline-block text-xs text-mirari-muted font-light pl-2 border-l border-mirari-border">
                讓每個人都能親自探索科學，而不只是被動接收知識。
              </span>
            </div>

            <nav className="flex items-center space-x-1 sm:space-x-3 text-xs font-mono">
              <a
                href="#cover-feature"
                className="px-2.5 py-1.5 rounded-lg text-mirari-muted hover:text-white transition"
              >
                本期封面
              </a>
              <a
                href="#latest-research"
                className="px-2.5 py-1.5 rounded-lg text-mirari-muted hover:text-white transition"
              >
                最新研究
              </a>
              <a
                href="#classic-science"
                className="px-2.5 py-1.5 rounded-lg text-mirari-muted hover:text-white transition"
              >
                經典科普
              </a>
              <a
                href="#science-domains"
                className="px-2.5 py-1.5 rounded-lg text-mirari-muted hover:text-white transition hidden sm:inline-block"
              >
                七大領域
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* ─── Hero Showcase: 3D Mascot MIRARI + Editorial Introduction ─ */}
      <section className="relative overflow-hidden border-b border-mirari-border/70 py-12 sm:py-20 bg-gradient-to-b from-mirari-surface/40 via-mirari-bg to-mirari-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Brand Philosophy & Editorial Stance */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center space-x-2 rounded-full border border-mirari-border bg-mirari-card/80 px-3.5 py-1 text-xs font-mono text-mirari-muted">
                <span className="w-2 h-2 rounded-full bg-mirari-cyan animate-pulse" />
                <span>新世代數位科學雜誌 · 現代編輯設計 × 互動實驗</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12]">
                親手觸碰物理的規律，<br />
                在星光與方程式中感受驚嘆。
              </h1>

              <p className="font-sans text-base sm:text-lg text-mirari-muted font-light leading-relaxed max-w-2xl">
                MIRARI 融合<strong>深度科普敘事</strong>、<strong>學術論文前沿解讀</strong>與
                <strong>HTML 互動實驗室</strong>。我們拒絕千篇一律的 AI 模板與空洞的聊天框——以科學本身為主角，讓你在指尖親歷宇宙與物質的奧妙。
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => onSelectArticle(coverArticle)}
                  className="flex items-center space-x-2.5 rounded-xl bg-gradient-to-r from-mirari-amber via-amber-500 to-amber-600 px-6 py-3.5 text-sm font-semibold text-mirari-bg shadow-xl hover:brightness-110 active:scale-95 transition"
                >
                  <Sliders className="w-4 h-4" />
                  <span>進入本期封面互動實驗</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <a
                  href="#ai-explorer"
                  className="flex items-center space-x-2 rounded-xl border border-mirari-border bg-mirari-surface/80 px-5 py-3.5 text-sm font-medium text-white hover:border-mirari-cyan/60 hover:bg-mirari-card transition"
                >
                  <Compass className="w-4 h-4 text-mirari-cyan" />
                  <span>自然語言策展導覽</span>
                </a>
              </div>
            </div>

            {/* Right Column: 3D Mascot MIRARI Hero Display */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
              <div
                className="relative cursor-pointer group"
                onClick={() => {
                  setMascotMood(mascotMood === 'idle' ? 'excited' : 'idle');
                }}
                title="點擊與 MIRARI 互動！"
              >
                {/* 3D Mascot Canvas */}
                <MirariMascot3D size="hero" state={mascotMood} interactive={true} />

                {/* Interactive Mascot Speech Bubble */}
                <div className="absolute -bottom-2 sm:bottom-0 left-1/2 -translate-x-1/2 rounded-2xl border border-mirari-border/80 bg-mirari-surface/90 px-4 py-2 text-xs font-mono text-white shadow-xl backdrop-blur-md whitespace-nowrap flex items-center space-x-2 pointer-events-none group-hover:border-mirari-amber transition">
                  <span className="text-mirari-amber">✨</span>
                  <span>我是 MIRARI！點我互動或在文章中找我陪讀</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── A. Natural Language AI Explorer ──────────────────────── */}
      <section id="ai-explorer" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AIExplorer onSelectArticle={onSelectArticle} />
      </section>

      {/* ─── B. Feature Cover Story (本期封面文章) ─────────────────── */}
      <section id="cover-feature" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between pb-6 border-b border-mirari-border mb-8">
          <div className="flex items-center space-x-3">
            <span className="h-6 w-1.5 rounded-full bg-mirari-amber" />
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">
              本期封面特輯 · COVER STORY
            </h2>
          </div>
          <span className="font-mono text-xs text-mirari-amber bg-mirari-amber/10 px-3 py-1 rounded-full border border-mirari-amber/30">
            VOL. 01 創刊號深度互動專題
          </span>
        </div>

        {/* Big Editorial Feature Card */}
        <div
          onClick={() => onSelectArticle(coverArticle)}
          className="group relative rounded-3xl border border-mirari-border bg-gradient-to-br from-mirari-card/90 via-mirari-surface to-mirari-bg p-6 sm:p-10 lg:p-12 hover:border-mirari-amber/60 transition duration-500 cursor-pointer shadow-2xl overflow-hidden"
        >
          {/* Subtle cosmic aura background */}
          <div className="absolute top-0 right-0 -z-10 w-96 h-96 rounded-full bg-mirari-amber/5 blur-3xl group-hover:bg-mirari-amber/10 transition-colors duration-700 pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-mirari-cyan/15 px-3 py-1 font-mono text-xs text-mirari-cyan border border-mirari-cyan/30 font-semibold">
                  宇宙與天文 · 系外行星巡天
                </span>
                <span className="rounded-full bg-mirari-amber/15 px-3 py-1 font-mono text-xs text-mirari-amber border border-mirari-amber/30 flex items-center space-x-1">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>內建雙視角天文物理模擬器</span>
                </span>
              </div>

              <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white group-hover:text-mirari-amber transition duration-300 leading-tight">
                {coverArticle.title}
              </h3>

              <p className="font-serif text-base sm:text-lg text-mirari-muted leading-relaxed font-light">
                {coverArticle.subtitle}
              </p>

              <p className="text-sm text-mirari-text/80 line-clamp-3 leading-relaxed">
                {coverArticle.leadParagraph}
              </p>

              {/* Tags & Action */}
              <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-mirari-border/60">
                <div className="flex flex-wrap gap-2 text-xs font-mono text-mirari-dim">
                  {coverArticle.tags.map((t, idx) => (
                    <span key={idx} className="bg-mirari-bg/70 px-2.5 py-1 rounded-lg border border-mirari-border">
                      #{t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center space-x-2 rounded-xl bg-mirari-amber px-5 py-2.5 text-xs sm:text-sm font-semibold text-mirari-bg shadow-md group-hover:scale-105 transition-transform">
                  <span>立即進入互動閱讀</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Right Graphic Preview Widget */}
            <div className="lg:col-span-5 rounded-2xl border border-mirari-border/70 bg-mirari-bg/90 p-5 space-y-3 shadow-inner">
              <div className="flex items-center justify-between text-xs font-mono text-mirari-muted border-b border-mirari-border/50 pb-2">
                <span>SIMULATOR PREVIEW</span>
                <span className="text-mirari-cyan">ΔF = (Rp/R*)²</span>
              </div>

              {/* Mini visual diagram representing transit */}
              <div className="relative h-44 rounded-xl bg-gradient-to-r from-mirari-surface via-mirari-card to-mirari-surface flex items-center justify-center overflow-hidden border border-mirari-border/40">
                {/* Sun */}
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-white shadow-[0_0_30px_rgba(251,191,36,0.6)] flex items-center justify-center relative">
                  {/* Planet passing */}
                  <div className="w-5 h-5 rounded-full bg-mirari-bg border border-mirari-cyan/80 absolute -left-2 shadow-lg" />
                </div>
                {/* Orbit track */}
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-mirari-cyan/30" />
                <div className="absolute bottom-2 right-3 font-mono text-[10px] text-mirari-dim">
                  動態光度曲線同步計算
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono pt-1">
                <div className="bg-mirari-surface p-2 rounded-lg border border-mirari-border/50">
                  <span className="block text-[10px] text-mirari-dim">可調參數</span>
                  <span className="text-mirari-amber font-bold">半徑比 · 撞擊參數</span>
                </div>
                <div className="bg-mirari-surface p-2 rounded-lg border border-mirari-border/50">
                  <span className="block text-[10px] text-mirari-dim">物理模型</span>
                  <span className="text-mirari-cyan font-bold">周邊昏暗效應</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── C. Latest Research (最新研究 — 論文解讀) ──────────────── */}
      <section id="latest-research" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-mirari-border/60">
        <div className="flex items-center justify-between pb-6 border-b border-mirari-border mb-8">
          <div className="flex items-center space-x-3">
            <span className="h-6 w-1.5 rounded-full bg-mirari-cyan" />
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">
                最新研究解讀 · LATEST RESEARCH
              </h2>
              <span className="text-xs text-mirari-dim font-mono">
                頂級期刊論文精選拆解（目前為編輯部示範資料）
              </span>
            </div>
          </div>
          <span className="font-mono text-[11px] text-mirari-muted border border-mirari-border px-3 py-1 rounded-full hidden sm:inline-block">
            PEER REVIEW DIGEST
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {researchArticles.map((article) => (
            <div
              key={article.id}
              onClick={() => onSelectArticle(article)}
              className="group rounded-2xl border border-mirari-border bg-mirari-surface/70 p-6 flex flex-col justify-between hover:border-mirari-cyan/60 hover:bg-mirari-card/80 transition duration-300 cursor-pointer shadow-lg"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-mirari-cyan font-semibold">
                    {article.journalReference?.journal || '學術期刊'}
                  </span>
                  <span className="font-mono text-[10px] text-mirari-dim bg-mirari-bg px-2 py-0.5 rounded border border-mirari-border">
                    {article.journalReference?.year}
                  </span>
                </div>

                <h3 className="font-serif text-xl font-bold text-white group-hover:text-mirari-cyan transition line-clamp-2">
                  {article.title}
                </h3>

                <p className="text-xs text-mirari-muted line-clamp-3 leading-relaxed">
                  {article.summary}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-mirari-border/60 flex items-center justify-between text-xs text-mirari-dim">
                <span className="font-mono">{article.publishedDate}</span>
                <span className="text-mirari-cyan group-hover:translate-x-1 transition-transform flex items-center space-x-1 font-mono">
                  <span>閱讀解讀</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── D. Classic Science (經典科普) ─────────────────────────── */}
      <section id="classic-science" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-mirari-border/60">
        <div className="flex items-center justify-between pb-6 border-b border-mirari-border mb-8">
          <div className="flex items-center space-x-3">
            <span className="h-6 w-1.5 rounded-full bg-violet-400" />
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-wide">
                經典科普典藏庫 · CLASSIC SCIENCE
              </h2>
              <span className="text-xs text-mirari-dim font-mono">
                歷久彌新的基礎科學思想與思想實驗
              </span>
            </div>
          </div>
          <span className="font-mono text-[11px] text-mirari-muted border border-mirari-border px-3 py-1 rounded-full hidden sm:inline-block">
            ENDURING FOUNDATIONS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {classicArticles.map((article) => (
            <div
              key={article.id}
              onClick={() => onSelectArticle(article)}
              className="group rounded-2xl border border-mirari-border bg-mirari-surface/70 p-6 flex flex-col justify-between hover:border-violet-400/60 hover:bg-mirari-card/80 transition duration-300 cursor-pointer shadow-lg"
            >
              <div className="space-y-3">
                <span className="font-mono text-[11px] text-violet-400 font-semibold block">
                  {article.issueNumber}
                </span>

                <h3 className="font-serif text-xl font-bold text-white group-hover:text-violet-300 transition line-clamp-2">
                  {article.title}
                </h3>

                <p className="text-xs text-mirari-muted line-clamp-3 leading-relaxed">
                  {article.summary}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-mirari-border/60 flex items-center justify-between text-xs text-mirari-dim">
                <span className="font-mono">典藏文章</span>
                <span className="text-violet-400 group-hover:translate-x-1 transition-transform flex items-center space-x-1 font-mono">
                  <span>閱讀典藏</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── E. Seven Science Domains (科學領域入口) ───────────────── */}
      <section id="science-domains" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-mirari-border/60">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
          <div className="inline-flex items-center space-x-2 rounded-full border border-mirari-border bg-mirari-surface px-3 py-1 text-xs font-mono text-mirari-muted">
            <Layers className="w-3.5 h-3.5 text-mirari-amber" />
            <span>SEVEN SCIENTIFIC PILLARS · 領域知識樹</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-wide">
            七大科學領域入口
          </h2>
          <p className="text-xs sm:text-sm text-mirari-muted leading-relaxed">
            MIRARI 將跨學科知識劃分為七個互相連通的領域。每個領域皆具備嚴謹的科學脈絡與可視化專題。
          </p>
        </div>

        {/* Domain Filter Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <button
            onClick={() => setSelectedDomain('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition ${
              selectedDomain === 'all'
                ? 'bg-white text-mirari-bg font-bold shadow-md'
                : 'bg-mirari-surface text-mirari-muted border border-mirari-border hover:text-white'
            }`}
          >
            全部顯示 ({ARTICLES.length})
          </button>
          {DOMAINS.map((domain) => (
            <button
              key={domain.id}
              onClick={() => setSelectedDomain(domain.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition flex items-center space-x-1.5 ${
                selectedDomain === domain.id
                  ? 'bg-mirari-amber text-mirari-bg font-bold shadow-md'
                  : 'bg-mirari-surface text-mirari-muted border border-mirari-border hover:text-white'
              }`}
            >
              <span>{domain.nameZh}</span>
            </button>
          ))}
        </div>

        {/* Domain Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {DOMAINS.map((domain) => {
            return (
              <div
                key={domain.id}
                onClick={() => {
                  setSelectedDomain(domain.id);
                  onExploreDomain(domain.id);
                }}
                className={`group rounded-2xl border p-5 transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                  selectedDomain === domain.id
                    ? 'border-mirari-amber bg-mirari-card/90 shadow-xl'
                    : 'border-mirari-border bg-mirari-surface/60 hover:border-mirari-borderLight hover:bg-mirari-card/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="p-2.5 rounded-xl border"
                      style={{
                        backgroundColor: `${domain.accentColor}18`,
                        borderColor: `${domain.accentColor}40`,
                        color: domain.accentColor,
                      }}
                    >
                      {getDomainIcon(domain.iconName)}
                    </div>
                    <span className="font-mono text-xs text-mirari-dim">
                      {domain.articleCount} 篇專案
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-white group-hover:text-mirari-amber transition">
                    {domain.nameZh}
                  </h3>
                  <div className="font-mono text-[10px] text-mirari-dim uppercase tracking-wider mb-2">
                    {domain.nameEn}
                  </div>

                  <p className="text-xs text-mirari-muted line-clamp-2 leading-relaxed">
                    {domain.tagline}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-mirari-border/50 flex items-center justify-between text-[11px] font-mono text-mirari-dim group-hover:text-mirari-text transition">
                  <span>探索領域</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Filtered Articles Drawer if a domain is selected */}
        {selectedDomain !== 'all' && (
          <div className="mt-10 pt-8 border-t border-mirari-border/60 animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-mirari-amber">
                正在檢視【{DOMAINS.find(d => d.id === selectedDomain)?.nameZh}】領域文章（共 {filteredArticles.length} 篇）：
              </span>
              <button
                onClick={() => setSelectedDomain('all')}
                className="text-xs font-mono text-mirari-dim hover:text-white underline"
              >
                清除篩選
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredArticles.map(article => (
                <div
                  key={article.id}
                  onClick={() => onSelectArticle(article)}
                  className="rounded-xl border border-mirari-border bg-mirari-surface/90 p-4 hover:border-mirari-cyan/60 transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-mono text-mirari-cyan block mb-1">
                      {article.issueNumber}
                    </span>
                    <h4 className="font-serif text-base font-bold text-white line-clamp-2">
                      {article.title}
                    </h4>
                    <p className="text-xs text-mirari-muted mt-1.5 line-clamp-2">
                      {article.summary}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-mirari-border/50 flex justify-between items-center text-[11px] font-mono text-mirari-dim">
                    <span>{article.publishedDate}</span>
                    <span className="text-mirari-cyan flex items-center space-x-1">
                      <span>閱讀</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ─── F. Special Series (系列專題) ──────────────────────────── */}
      <section className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-mirari-border/60">
        <div className="rounded-3xl border border-mirari-border bg-gradient-to-r from-mirari-surface via-mirari-card to-mirari-surface p-8 sm:p-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <span className="font-mono text-xs text-mirari-cyan uppercase tracking-wider font-semibold">
                CURATED SERIES · 系列專題
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                《尋找第二個地球：系外行星巡天三十年記》
              </h2>
              <p className="text-sm text-mirari-muted leading-relaxed">
                將關聯文章串聯為完整的科學史詩。本系列涵蓋凌日法、徑向速度法、微引力透鏡法到韋伯大氣光譜分析，全面呈現人類探索宜居行星的壯麗歷程。
              </p>
            </div>
            <button
              onClick={() => onSelectArticle(coverArticle)}
              className="shrink-0 rounded-xl bg-mirari-cyan/15 border border-mirari-cyan/40 px-6 py-3.5 text-xs sm:text-sm font-semibold text-mirari-cyan hover:bg-mirari-cyan/25 transition flex items-center space-x-2"
            >
              <span>閱讀系列首篇《當星光暗了一點》</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── Editorial Colophon & Footer ───────────────────────────── */}
      <footer className="border-t border-mirari-border/80 bg-mirari-surface/60 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-baseline space-x-2">
                <span className="font-serif text-2xl font-bold text-white">MIRARI</span>
                <span className="font-mono text-xs text-mirari-amber font-semibold">ミラリ</span>
              </div>
              <p className="text-xs text-mirari-muted leading-relaxed">
                MIRARI 源自拉丁文 <em>mirari</em>，意為「驚嘆、驚奇、感到不可思議」。
                我們致力於打破單純知識灌輸的傳統新聞框架，以現代編輯設計與 HTML 互動技術，讓每一位讀者皆能在指尖探索真實科學。
              </p>
            </div>

            <div className="md:col-span-3 space-y-2 text-xs font-mono">
              <span className="text-white font-bold block mb-2">內容分類體系</span>
              <div className="text-mirari-dim space-y-1">
                <p>· 本期封面特輯 (Cover Feature)</p>
                <p>· 最新研究解讀 (Peer-Review Digest)</p>
                <p>· 經典科普典藏 (Classic Science)</p>
                <p>· 系列探索專題 (Curated Series)</p>
              </div>
            </div>

            <div className="md:col-span-4 space-y-2 text-xs font-mono">
              <span className="text-white font-bold block mb-2">科學倫理與開源承諾</span>
              <p className="text-mirari-dim leading-relaxed">
                本刊所有互動實驗均標明簡化假設與物理適用邊界。未經驗證之版型示範均明確標記，絕不以虛構研究混充正式新聞。
              </p>
              <div className="pt-2 text-mirari-dim">
                © 2026 MIRARI Digital Science Magazine. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
