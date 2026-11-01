import React from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { getArticleBySlug } from '../../data/articles';
import { ArticleView } from '../article/ArticleView';
import { NotFoundPage } from './NotFoundPage';
import { UnpublishedNoticePage } from './UnpublishedNoticePage';

export interface RouteContextType {
  activeSentenceId: string | null;
  activeSecondaryId: string | null;
  evidenceNote: string | null;
  handleClearHighlight: () => void;
  handleOpenArticleBySlug: (slug: string) => void;
}

export const ArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const context = useOutletContext<RouteContextType>();

  const article = slug ? getArticleBySlug(slug) : undefined;

  // 1. 不存在之篇章坐標：顯示真正的 404 狀態，不默默返回首頁
  if (!article) {
    return (
      <NotFoundPage
        title="404 · 篇章坐標未找到"
        message={`您所探尋的科學篇章坐標「${slug || ''}」目前不存在或已重新編目。`}
        slug={slug}
      />
    );
  }

  // 2. 未發布之篇章：嚴格阻擋直接輸入網址公開閱讀正文
  if (article.status !== 'published') {
    return <UnpublishedNoticePage article={article} />;
  }

  // 3. 正式發布之文章：完整正文、動態互動模擬與原文定位伴讀
  return (
    <ArticleView
      article={article}
      onBackToHome={() => navigate('/')}
      onOpenArticleBySlug={(targetSlug) => navigate(`/articles/${targetSlug}`)}
      activeSentenceId={context?.activeSentenceId ?? null}
      activeSecondaryId={context?.activeSecondaryId ?? null}
      evidenceNote={context?.evidenceNote ?? null}
      onClearHighlight={context?.handleClearHighlight ?? (() => {})}
    />
  );
};
