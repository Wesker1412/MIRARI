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

/**
 * ─── Major Editorial Categories (兩大主要編輯分類，互斥且與學科標籤獨立) ───
 * 
 * 1. scientific_principles (顯示名稱：科普探索)
 *    收錄一般科普、經典科學知識、科學現象、數學原理、理論解釋及思想實驗。
 *    主要目的是讓讀者理解科學，而非追逐最新消息。不限制物理學，也不要求每篇一定具有思想實驗。
 * 
 * 2. journal_interpretation (顯示名稱：研究動態)
 *    定位為最新科學發現、重要研究成果、研發技術突破及具有話題性的科學事件。
 *    以新聞時效性、科學價值與話題性作為選題依據。
 *    涵蓋最新學術研究、重大科學發現、技術研發突破、科學機構重要成果與公眾關注事件。
 *    不要求每篇都必須以單篇同儕審查論文為主題，但必須核對可信來源，清楚區分同行審查、預印本與機構待驗證成果，嚴禁誇大。
 * 
 * 分類判斷原則：
 * - 主要在解釋某個科學知識或原理 -> scientific_principles
 * - 主要在報導或解讀近期科學發現、研究成果、技術突破或科學事件 -> journal_interpretation
 */
export type EditorialCategory = 'scientific_principles' | 'journal_interpretation';

// ─── Article Core (文章本體) ───────────────────────────────────
export interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string;

  // 主要編輯分類 (必須且只能有其中一個主要分類)
  editorialCategory: EditorialCategory;

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

// ─── Article Author & Citation Metadata ────────────────────────
export interface ArticleAuthor {
  name: string;
  role: string;
}

export interface CitationReference {
  id: string;
  citation: string;
  doi?: string;
  url?: string;
}

// ─── Automated Original Text Evidence (無人工編寫句子清單) ────────
export interface SentenceEvidence {
  sentenceId: string;
  articleId: string;
  sectionId: string;
  sectionTitle: string;
  paragraphIndex: number;
  exactQuote: string;
  charStart: number;
  charEnd: number;
  contentHash: string;
  contextNote?: string;
}

export interface ArticleSection {
  id: string;
  title: string;
  level: number;
  paragraphs: string[];
  sentences: SentenceEvidence[];
  formulas: string[];
  interactiveComponentId?: string;
}

// ─── Article Document (包含解析後正文結構的完整模型) ─────────────
export interface ArticleDocument extends Article {
  version: number;
  contentHash: string;
  authors: ArticleAuthor[];
  references: CitationReference[];
  quoteLead?: string;
  interactiveComponent?: string;
  sections: ArticleSection[];
  totalWordCount?: number;
  lastIndexedAt?: string;

  // ─── 未來讀者評價與自主編輯部演進預留欄位 ─────────────────────
  narrativeStyle?: NarrativeStyle;
  interactiveType?: InteractiveExperimentType;
  creationModel?: string;
  feedbackId?: string;
  createdAt?: string;
}

// ─── 寫作風格與互動類型分類（供自主編輯部分析與演進）────────────
export type NarrativeStyle =
  | 'depth_narrative' // 深度故事與科學歷史敘事
  | 'first_principles' // 第一性原理推演與現象分析
  | 'thought_experiment' // 思想實驗與極限邊界探討
  | 'math_derivation' // 嚴謹數學模型與動力學方程
  | 'research_interpretation'; // 學術期刊前沿觀測解讀

export type InteractiveExperimentType =
  | 'geometric_optics' // 幾何遮蔽與光度投影
  | 'phase_space' // 混沌相空間與數值積分
  | 'circuit_oscilloscope' // 電生理離子通道與示波器
  | 'particle_system' // 分子碰撞與統計物理模擬
  | 'data_explorer' // 實證觀測數據互動
  | 'neural_raster' // 神經發火率與記憶編碼
  | 'carrier_dynamics' // 能帶結構與光電載子復合
  | 'clock_feedback' // 頻率共振與核時鐘鎖定
  | 'brownian_ratchet' // 布朗棘輪與微觀非平衡態步進
  | 'turbulence_cascade' // 湍流能量串級與能譜冪律
  | 'weak_lensing'; // 微弱重力透鏡與宇宙剪切質量圖

// ─── 讀者評價預留結構（本輪不實作 UI，預留模型定義）──────────────
export interface ReaderFeedbackMetric {
  articleId: string;
  feedbackId: string;
  timestamp: string;
  clarityRating?: number; // 概念清晰度 (1-5)
  interactiveRating?: number; // 實驗趣味與操作啟發 (1-5)
  scientificRigorVote?: boolean; // 科學嚴謹性認可
  reportedErrorsCount?: number; // 錯誤回報次數
}

export interface SearchIndexEntry {
  articleId: string;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  status: ArticleStatus;
  topicIds: string[];
  tags: string[];
  editorialCategory: EditorialCategory;
  formatBadgeText: string;
  isEditorialCover?: boolean;
  isEditorialPick?: boolean;
  isResearchHighlight?: boolean;
  isClassicFoundation?: boolean;
  tokens: string[];
  contentHash: string;
}

// ─── MIRARI Mascot & Recommendation ─────────────────────────────
export type MascotState = 'idle' | 'thinking' | 'excited' | 'pointing';

export type RecommendationMatchLevel = 'direct' | 'partial' | 'none';

export interface AIRecommendation {
  query: string;
  curatorReply: string;
  recommendedArticles: Article[];
  suggestedTags: string[];
  matchLevel?: RecommendationMatchLevel;
}

export interface ArticleKnowledgePoint {
  id: string;
  label: string;
  suggestedQuestion: string;
  keywords: string[];
  plainExplanation: string;
  anchorSentenceId: string;
}

export interface ArticleKnowledgeConfig {
  articleId: string;
  slug: string;
  title: string;
  knowledgePoints: ArticleKnowledgePoint[];
}

export interface EvidenceSearchResult {
  query: string;
  answer: string;
  confidence?: number;
  evidence: SentenceEvidence | null;
  secondaryEvidence?: SentenceEvidence | null;
  matchedKnowledgePoint?: ArticleKnowledgePoint | null;
  recommendedArticles?: Article[];
  isRecommendation?: boolean;
}
