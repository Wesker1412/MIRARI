export type DomainId = 
  | 'cosmos'
  | 'physics'
  | 'chemistry'
  | 'earth-life'
  | 'math-computing'
  | 'mind-human'
  | 'tech-engineering';

export interface Domain {
  id: DomainId;
  nameZh: string;
  nameEn: string;
  tagline: string;
  description: string;
  iconName: string;
  accentColor: string;
  articleCount: number;
}

export type ArticleCategory = 'cover' | 'research' | 'classic' | 'series';

export interface KnowledgePoint {
  id: string;
  title: string;
  concept: string;
  summary: string;
  targetElementId: string;
  relatedQuestions: string[];
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: ArticleCategory;
  domainId: DomainId;
  publishedDate: string;
  issueNumber: string;
  coverImage?: string;
  isInteractive: boolean;
  isEditorialDemo?: boolean; // For research briefings not yet peer-verified
  journalReference?: {
    journal: string;
    doi: string;
    year: number;
  };
  summary: string;
  leadParagraph: string;
  tags: string[];
  knowledgePoints: KnowledgePoint[];
}

export type MascotState = 'idle' | 'thinking' | 'excited' | 'pointing';

export interface AIRecommendation {
  query: string;
  curatorReply: string;
  recommendedArticles: Article[];
  suggestedTags: string[];
}
