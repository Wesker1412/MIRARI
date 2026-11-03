/**
 * MIRARI 日期與台灣時區 (Asia/Taipei) 統一管理工具
 * 
 * 核心準則：
 * 1. 站內文章發布日期一律以 Asia/Taipei 計算與呈現。
 * 2. 嚴格區分學術論文發表日期 (journalReference) 與 MIRARI 站內文章發布日期 (publishedDate)。
 * 3. 預排程之未來文章 (publishedDate > 台灣當前日期) 絕不提前公開。
 * 4. 已經實際發布之文章絕不因未來日期異常被誤判。
 */

const TAIPEI_TIMEZONE = 'Asia/Taipei';

/**
 * 取得指定時間在台灣時區 (Asia/Taipei) 之 YYYY-MM-DD 日期字串
 */
export function getTaipeiDateString(dateInput: Date | string | number = new Date()): string {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    // 預防無效日期，預設為當前台灣時間
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TAIPEI_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * 判斷文章是否已正式發布可供公開讀者瀏覽
 * 
 * 通過條件：
 * 1. 文章狀態必須為 'published'
 * 2. 發布日期 publishedDate 必須存在且不大於當前台灣時區日期（杜絕預排程文章提前洩漏）
 */
export function isArticlePublished(
  article: { status?: string; publishedDate?: string },
  referenceDate: Date | string = new Date()
): boolean {
  if (!article || article.status !== 'published') {
    return false;
  }

  if (!article.publishedDate) {
    return false;
  }

  const todayTaipei = getTaipeiDateString(referenceDate);
  // YYYY-MM-DD 格式可直接進行字典序比較
  return article.publishedDate <= todayTaipei;
}

/**
 * 依發布日期由新到舊排序文章（日期相同時依 ID 穩定排序）
 */
export function sortArticlesByDateDescending<T extends { publishedDate?: string; id?: string }>(
  articles: T[]
): T[] {
  return [...articles].sort((a, b) => {
    const dateA = a.publishedDate || '';
    const dateB = b.publishedDate || '';
    if (dateB !== dateA) {
      return dateB.localeCompare(dateA);
    }
    return (a.id || '').localeCompare(b.id || '');
  });
}
