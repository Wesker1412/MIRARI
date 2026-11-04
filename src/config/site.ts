/**
 * MIRARI 全站營運與展示設定
 */
export const SITE_CONFIG = {
  name: 'MIRARI',
  tagline: '探索科學的互動數位雜誌',
  description:
    'MIRARI 是一本探索科學前沿的互動數位雜誌，結合可驗證原文證據與可操作的動態模擬實驗。',
  canonicalOrigin: 'https://mirari-henna.vercel.app',
  locale: 'zh-Hant',

  // ─── 搜尋引擎索引全站控制開關 ────────────────────────────────────
  // 內容累積階段設為 true (noindex, nofollow)，防止未成熟頁面被過早收錄。
  // 未來正式對外公開營運時只需切換為 false，無需逐篇修改文章。
  preventIndexing: true,

  // ─── 自主創作排程設定資訊 ────────────────────────────────────────
  autonomousEditorial: {
    cronExpression: '0 1 * * *', // 每日 UTC 01:00 (台灣時間 09:00)
    targetArticlesPerRun: 3,
    primaryModel: 'gemini-2.5-pro',
    timezone: 'Asia/Taipei (UTC+8)',
  },
};
