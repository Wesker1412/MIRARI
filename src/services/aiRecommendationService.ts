import { ARTICLES } from '../data/articles';
import type { AIRecommendation, Article } from '../types';

export function queryMockAIRecommendation(query: string): AIRecommendation {
  const normalized = query.trim().toLowerCase();

  // Pattern 1: Interactive & Astronomy / Physics
  if (
    normalized.includes('動手') ||
    normalized.includes('操作') ||
    normalized.includes('實驗') ||
    normalized.includes('互動') ||
    normalized.includes('行星') ||
    normalized.includes('星光') ||
    normalized.includes('凌日') ||
    normalized.includes('天文')
  ) {
    const transitArticle = ARTICLES.find((a) => a.id === 'art-exoplanet-transit')!;
    const seriesArticle = ARTICLES.find((a) => a.id === 'art-series-habitable-worlds')!;

    return {
      query,
      curatorReply:
        '太棒了！為你推薦本期創刊號封面互動特輯《當星光暗了一點》。這篇文章配備了精密的 HTML5 / Canvas 天文物理模擬器，你可以親自調節行星半徑與軌道傾角，即時看見光度曲線如何隨幾何遮蔽面積劇烈變化。',
      recommendedArticles: [transitArticle, seriesArticle],
      suggestedTags: ['系外行星', '凌日法', '光度曲線', '互動實驗'],
    };
  }

  // Pattern 2: Black Hole & Spacetime / Early Universe
  if (
    normalized.includes('黑洞') ||
    normalized.includes('韋伯') ||
    normalized.includes('引力') ||
    normalized.includes('重力') ||
    normalized.includes('時空')
  ) {
    const bhArticle = ARTICLES.find((a) => a.id === 'art-jwst-supermassive-blackhole')!;
    const transitArticle = ARTICLES.find((a) => a.id === 'art-exoplanet-transit')!;

    return {
      query,
      curatorReply:
        '為你挑選了最新學術研究解讀《早期宇宙超重黑洞異常吸積特徵》（Nature Astronomy 論文解讀示範），探討大爆炸後僅數億年便超常存在的巨型黑洞之謎。同時也推薦搭配天文領域的封面文章一起閱讀。',
      recommendedArticles: [bhArticle, transitArticle],
      suggestedTags: ['超重黑洞', '早期宇宙', '韋伯望遠鏡', '愛丁頓極限'],
    };
  }

  // Pattern 3: Psychology / Mind / Perception
  if (
    normalized.includes('心理') ||
    normalized.includes('大腦') ||
    normalized.includes('心智') ||
    normalized.includes('時間') ||
    normalized.includes('意識') ||
    normalized.includes('現象')
  ) {
    const brainArticle = ARTICLES.find((a) => a.id === 'art-brain-predictive-coding')!;
    const entropyArticle = ARTICLES.find((a) => a.id === 'art-second-law-entropy')!;

    return {
      query,
      curatorReply:
        '推薦你閱讀神經科學前沿解讀《大腦如何編織時間的幻覺？》。這篇文章深入剖析大腦預測編碼網絡與貝氏推論如何形塑我們對時間流逝的主觀錯覺。若想探索客觀物理的時間向度，也可以延伸閱讀熱力學時間之箭。',
      recommendedArticles: [brainArticle, entropyArticle],
      suggestedTags: ['預測編碼', '主觀時間', '神經科學', '貝氏推論'],
    };
  }

  // Pattern 4: Latest Science Discoveries / Research
  if (
    normalized.includes('最新') ||
    normalized.includes('發現') ||
    normalized.includes('研究') ||
    normalized.includes('論文') ||
    normalized.includes('近期')
  ) {
    const researchArticles = ARTICLES.filter((a) => a.category === 'research');

    return {
      query,
      curatorReply:
        '這是編輯部近期精選的頂級期刊論文解讀專區（涵蓋 Nature Astronomy、Science、Neuron 等發表的前沿觀測與高壓物理實驗）。我們將艱澀的數學與實驗架構拆解為清晰的幾何與圖文脈絡：',
      recommendedArticles: researchArticles,
      suggestedTags: ['論文解讀', '高壓超導', '韋伯巡天', '神經網絡'],
    };
  }

  // Pattern 5: Quantum & Foundations / Epigenetics
  if (
    normalized.includes('量子') ||
    normalized.includes('雙狹縫') ||
    normalized.includes('物理') ||
    normalized.includes('基因') ||
    normalized.includes('生命')
  ) {
    const quantumArticle = ARTICLES.find((a) => a.id === 'art-quantum-erasure')!;
    const entropyArticle = ARTICLES.find((a) => a.id === 'art-second-law-entropy')!;
    const bioArticle = ARTICLES.find((a) => a.id === 'art-epigenetics-dna-memory')!;

    return {
      query,
      curatorReply:
        '為你推薦 MIRARI 經典科普典藏庫。從雙狹縫延遲選擇實驗對物理實在論的震撼考驗，到熱力學第二定律與表觀遺傳分子開關，這些是歷久彌新的科學思想坐標。',
      recommendedArticles: [quantumArticle, entropyArticle, bioArticle],
      suggestedTags: ['量子擦除', '雙狹縫干涉', '熱力學', '表觀遺傳'],
    };
  }

  // Fallback: General inquiry
  const matches = ARTICLES.filter(
    (a) =>
      a.title.includes(query) ||
      a.summary.includes(query) ||
      a.tags.some((t) => t.toLowerCase().includes(normalized))
  );

  const fallbackList: Article[] =
    matches.length > 0 ? matches.slice(0, 3) : [ARTICLES[0], ARTICLES[1], ARTICLES[3]];

  return {
    query,
    curatorReply:
      matches.length > 0
        ? `根據關鍵字「${query}」，MIRARI 編輯部為你挑選了以下最切合的科學專題：`
        : `「${query}」是一個非常迷人的探索課題！目前 MIRARI 編輯部正排審該領域的專題稿件。在此之前，推薦你先從本期焦點《當星光暗了一點》與前沿論文解讀開始探索：`,
    recommendedArticles: fallbackList,
    suggestedTags: fallbackList.flatMap((a) => a.tags).slice(0, 5),
  };
}
