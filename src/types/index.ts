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
  | 'data_explorer'; // 實證觀測數據互動

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

export interface AIRecommendation {
  query: string;
  curatorReply: string;
  recommendedArticles: Article[];
  suggestedTags: string[];
}

export interface EvidenceSearchResult {
  query: string;
  answer: string;
  confidence: number;
  evidence: SentenceEvidence | null;
  secondaryEvidence?: SentenceEvidence | null;
}
