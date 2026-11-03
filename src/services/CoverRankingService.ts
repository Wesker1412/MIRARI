import type { ArticleDocument } from '../types';
import { isArticlePublished } from '../utils/date';

/**
 * 封面排序權重設定
 * 集中管理各項排名訊號的基礎權重。
 */
export interface CoverRankingWeights {
  recencyWeight: number;
  popularityWeight: number;
  userPreferenceWeight: number;
  topicDiversityWeight: number;
}

export const DEFAULT_COVER_RANKING_WEIGHTS: CoverRankingWeights = {
  recencyWeight: 0.85,
  popularityWeight: 0.0, // 尚未接入真實讀者數據時維持 0.0，不造假
  userPreferenceWeight: 0.0, // 尚未接入真實讀者評分時維持 0.0，不造假
  topicDiversityWeight: 0.15, // 主題多樣性加權，防止單一學科壟斷封面
};

export interface ArticleMetrics {
  readsCount?: number;
  interactiveRuns?: number;
  userLikeRatio?: number;
}

export interface RankedCoverArticle {
  article: ArticleDocument;
  score: number;
  rank: number;
  recencyScore: number;
  diversityBonus: number;
}

/**
 * CoverRankingService
 * 
 * 獨立、客觀且可維護的首頁封面故事排序服務。
 * 候選資格：所有 status === 'published' 且正文完備的文章。
 * 拒絕虛構人氣與隨機洗牌，依客觀訊號進行穩定可解釋的排名。
 */
export class CoverRankingService {
  private weights: CoverRankingWeights;

  constructor(weights: CoverRankingWeights = DEFAULT_COVER_RANKING_WEIGHTS) {
    this.weights = { ...weights };
  }

  /**
   * 計算文章時間新鮮度分數 [0, 1]
   */
  private computeRecencyScore(article: ArticleDocument, allArticles: ArticleDocument[]): number {
    const parseTime = (art: ArticleDocument): number => {
      if (art.createdAt) {
        const t = new Date(art.createdAt).getTime();
        if (!isNaN(t)) return t;
      }
      if (art.publishedDate) {
        const t = new Date(art.publishedDate.replace(/\./g, '-')).getTime();
        if (!isNaN(t)) return t;
      }
      return 0;
    };

    const times = allArticles.map(parseTime);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    if (maxTime === minTime) return 1.0;

    const thisTime = parseTime(article);
    return (thisTime - minTime) / (maxTime - minTime);
  }

  /**
   * 執行封面候選文章排序，最多選出指定數量（預設 5 篇）
   */
  public rankCoverStories(
    articles: ArticleDocument[],
    maxCount: number = 5,
    _metricsMap?: Record<string, ArticleMetrics>
  ): RankedCoverArticle[] {
    // 1. 候選資格過濾：必須為依台灣時區已發布且正文結構完備的文章
    const candidates = articles.filter(
      (a) => isArticlePublished(a) && a.sections && a.sections.length > 0
    );

    if (candidates.length === 0) return [];

    // 2. 計算基礎新鮮度分數
    const scoredCandidates = candidates.map((art) => {
      const recencyScore = this.computeRecencyScore(art, candidates);
      return {
        article: art,
        recencyScore,
        rawTime: art.publishedDate || art.createdAt || '',
      };
    });

    // 3. 初始時間由新到舊排序，同分時依穩定 ID 字母序打破僵局
    scoredCandidates.sort((a, b) => {
      if (b.recencyScore !== a.recencyScore) {
        return b.recencyScore - a.recencyScore;
      }
      return a.article.id.localeCompare(b.article.id);
    });

    // 4. 主題多樣性動態重排（Greedy Diversity Selection）
    // 防止同一個科學主題（例如連續兩篇非線性物理）連續佔滿首位，
    // 優先讓不同學科前沿呈現在封面輪播中。
    const selected: RankedCoverArticle[] = [];
    const usedPrimaryTopics = new Set<string>();
    const remaining = [...scoredCandidates];

    while (selected.length < maxCount && remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        const primaryTopic = item.article.topicIds[0] || 'general';
        const hasTopicClash = usedPrimaryTopics.has(primaryTopic);

        // 主題未重複時享有主題多樣性獎勵
        const diversityBonus = hasTopicClash ? 0.0 : this.weights.topicDiversityWeight;
        const totalScore =
          item.recencyScore * this.weights.recencyWeight + diversityBonus;

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestIdx = i;
        }
      }

      const chosen = remaining.splice(bestIdx, 1)[0];
      const primaryTopic = chosen.article.topicIds[0] || 'general';
      usedPrimaryTopics.add(primaryTopic);

      selected.push({
        article: chosen.article,
        score: Math.round(bestScore * 1000) / 1000,
        rank: selected.length + 1,
        recencyScore: chosen.recencyScore,
        diversityBonus: usedPrimaryTopics.has(primaryTopic)
          ? this.weights.topicDiversityWeight
          : 0,
      });
    }

    return selected;
  }

  /**
   * 靜態便捷方法：直接透過預設服務實例取得封面排名
   */
  public static rankCoverStories(
    articles: ArticleDocument[],
    maxCount: number = 5,
    metricsMap?: Record<string, ArticleMetrics>
  ): RankedCoverArticle[] {
    return coverRankingService.rankCoverStories(articles, maxCount, metricsMap);
  }
}

// 匯出單例服務
export const coverRankingService = new CoverRankingService();
