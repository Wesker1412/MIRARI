import { ARTICLES } from '../data/articles';
import type { AIRecommendation, Article } from '../types';

export function queryMockAIRecommendation(query: string): AIRecommendation {
  const normalized = query.trim().toLowerCase();

  // Pattern 1: Interactive & Astronomy / Transit
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
        '推薦閱讀《當星光暗了一點》。這篇專題配有即時幾何與光度模擬器，可以動手調整行星半徑比與軌道幾何，直觀理解行星遮光與光度曲線的平方關係。',
      recommendedArticles: [transitArticle, seriesArticle],
      suggestedTags: ['系外行星', '凌日法', '光度曲線', '克卜勒望遠鏡'],
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
        '針對早期宇宙與黑洞，推薦關注論文解讀《早期宇宙超重黑洞異常吸積特徵》（專題籌備中）。若對深空觀測方法感興趣，也可先閱讀已發布的凌日法特輯。',
      recommendedArticles: [bhArticle, transitArticle],
      suggestedTags: ['超重黑洞', '早期宇宙', '韋伯望遠鏡'],
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
        '在心智與感知領域，推薦關注《大腦如何編織時間的知覺？》（籌備中），探討大腦預測編碼網絡如何形塑主觀時間感。物理層面的時間方向則可參考熱力學熵增專題。',
      recommendedArticles: [brainArticle, entropyArticle],
      suggestedTags: ['預測編碼', '主觀時間', '神經科學'],
    };
  }

  // Pattern 4: Latest Research
  if (
    normalized.includes('最新') ||
    normalized.includes('發現') ||
    normalized.includes('研究') ||
    normalized.includes('論文') ||
    normalized.includes('近期')
  ) {
    const researchArticles = ARTICLES.filter((a) => a.isResearchHighlight);

    return {
      query,
      curatorReply:
        '目前編輯部正在追蹤數項重要期刊研究（涵蓋 Nature Astronomy、Science、Neuron 等發表之天體光譜、高壓物理與神經網絡論文）。以下為籌備中的研究解讀選題：',
      recommendedArticles: researchArticles,
      suggestedTags: ['前沿研究', '高壓超導', '韋伯巡天', '神經網絡'],
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
        ? `找到與「${query}」相關的科學內容：`
        : `「${query}」是相當引人入勝的研究方向。以下為最接近此主題的精選專題與籌備中選題：`,
    recommendedArticles: fallbackList,
    suggestedTags: fallbackList.flatMap((a) => a.tags).slice(0, 4),
  };
}
