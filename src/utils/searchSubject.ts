import type { Article } from '../types/index.ts';

const SUBJECT_TERMS: Readonly<Record<string, readonly string[]>> = {
  電學: ['動作電位', '光電轉換', '分數量子霍爾效應', '神經形態晶片'],
  電磁學: ['光電轉換', '分數量子霍爾效應'],
  電生理: ['動作電位', '單神經元記錄'],
  天文: ['天文物理', '暗物質'],
  遺傳學: ['族群遺傳學', '中性演化理論'],
  熱力學: ['熱力學第二定律', '統計物理'],
  流體力學: ['湍流', '納維-斯托克斯'],
  量子力學: ['分數量子霍爾效應', '量子計量'],
};

export function getSearchSubject(query: string): string {
  return query.trim()
    .replace(/[\s？?！!。]+$/u, '')
    .replace(/^(?:請問[，,\s]*)?(?:(?:我)?(?:想找|想看|想讀|想了解|想知道|想閱讀)|(?:可以)?(?:幫我|請)?(?:找找|找|推薦|介紹)|有沒有|有哪些|有什麼)\s*(?:一些|一點)?\s*(?:關於|有關)?\s*/u, '')
    .replace(/\s*(?:的?相關(?:的)?|方面(?:的)?|(?:的))?\s*(?:科學文章|文章|篇章|內容|資料|主題|知識|相關)(?:嗎|呢)?$/u, '')
    .replace(/\s*(?:的?相關的?|方面的?)(?:嗎|呢)?$/u, '')
    .trim();
}

export function getSubjectMatch(article: Article, subject: string): number {
  if (subject.length < 2) return 0;
  const normalized = subject.toLowerCase();
  const tags = article.tags || [];
  if (article.title.toLowerCase().includes(normalized) ||
      tags.some((tag) => tag.toLowerCase() === normalized)) return 12;
  const terms = Object.hasOwn(SUBJECT_TERMS, subject) ? SUBJECT_TERMS[subject] : [];
  const rank = terms.findIndex((term) => tags.includes(term));
  return rank < 0 ? 0 : 10 - rank;
}
