// ─── Scientific Topics (可自由擴充的多對多主題體系) ─────────────
export interface Topic {
  id: string; // 穩定唯一 ID，如 'topic-astrophysics'
  slug: string;
  nameZh: string;
  nameEn: string;
  tagline: string;
  description: string;
  isFeatured?: boolean; // 是否為首頁焦點推薦主題
  isActive: boolean; // 可隨時啟用/停用，不需更動前端元件
  order?: number;
}

// ─── Content Formats (文章內容形式，與學科獨立) ──────────────────
export type ContentFormat =
  | 'interactive_simulation' // 互動實驗與動手模擬
  | 'research_brief' // 前沿學術期刊解讀
  | 'longform_essay' // 深度科學特輯與思想實驗
  | 'visual_story'; // 圖文數據專題

// ─── Editorial Series (系列專題關係) ───────────────────────────
export interface Series {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  status: 'planning' | 'ongoing' | 'completed';
  featuredArticleId?: string;
  totalPlannedArticles?: number;
}

export type ArticleStatus = 'published' | 'in_preparation' | 'archived';

export interface KnowledgePoint {
  id: string;
  title: string;
  concept: string;
  summary: string;
  targetElementId: string;
  relatedQuestions: string[];
}

// ─── Article Core (文章本體) ───────────────────────────────────
export interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string;

  // 多科學主題關聯 (Many-to-Many Topics)
  topicIds: string[];

  // 內容呈現形式
  format: ContentFormat;
  formatBadgeText: string;

  // 發布與編輯狀態
  status: ArticleStatus;
  publishedDate?: string;

  // 編輯部策展標記 (非排他性：一篇文章可同時是精選、研究解讀或屬於某系列)
  isEditorialCover?: boolean;
  isEditorialPick?: boolean;
  isResearchHighlight?: boolean;
  isClassicFoundation?: boolean;

  // 系列專題關聯
  seriesId?: string;
  seriesOrder?: number;

  summary: string;
  leadParagraph: string;
  tags: string[];

  // 學術論文參照 (可選)
  journalReference?: {
    journal: string;
    year: number;
    doi?: string;
  };

  knowledgePoints: KnowledgePoint[];
}

export type MascotState = 'idle' | 'thinking' | 'excited' | 'pointing';

export interface AIRecommendation {
  query: string;
  curatorReply: string;
  recommendedArticles: Article[];
  suggestedTags: string[];
}
