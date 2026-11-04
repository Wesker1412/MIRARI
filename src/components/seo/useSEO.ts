import { useEffect } from 'react';
import { SITE_CONFIG } from '../../config/site';

export interface SEOMetadata {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  publishedTime?: string;
  authors?: string[];
}

const DEFAULT_DESC =
  'MIRARI 是一本探索科學前沿的互動數位雜誌，結合可驗證原文證據與動態模擬實驗。';

function updateMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function updateLinkTag(rel: string, href: string) {
  let element = document.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

export function useSEO(meta?: SEOMetadata) {
  useEffect(() => {
    // 1. Document Title
    const fullTitle = meta?.title ? `${meta.title} | ${SITE_CONFIG.name}` : SITE_CONFIG.name;
    document.title = fullTitle;

    // 2. Meta Description
    const description = meta?.description || DEFAULT_DESC;
    updateMetaTag('name', 'description', description);

    // 3. Robots Indexing Control (依 SITE_CONFIG 全站集中設定，內容累積階段統一 noindex)
    if (SITE_CONFIG.preventIndexing) {
      updateMetaTag('name', 'robots', 'noindex, nofollow');
    } else {
      updateMetaTag('name', 'robots', 'index, follow');
    }

    // 4. Canonical URL
    const canonical =
      meta?.canonicalUrl ||
      (typeof window !== 'undefined'
        ? window.location.href
        : `${SITE_CONFIG.canonicalOrigin}/`);
    updateLinkTag('canonical', canonical);

    // 5. Open Graph
    updateMetaTag('property', 'og:site_name', SITE_CONFIG.name);
    updateMetaTag('property', 'og:title', fullTitle);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:url', canonical);
    updateMetaTag('property', 'og:type', meta?.ogType || 'website');

    // 6. Twitter Card
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', fullTitle);
    updateMetaTag('name', 'twitter:description', description);

    if (meta?.publishedTime) {
      updateMetaTag('property', 'article:published_time', meta.publishedTime);
    }
  }, [meta?.title, meta?.description, meta?.canonicalUrl, meta?.ogType, meta?.publishedTime]);
}

