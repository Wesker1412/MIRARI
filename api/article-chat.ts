import { handleArticleChat, checkRateLimit } from './_lib/ragEngine.js';

let activeConcurrentRequests = 0;
const MAX_CONCURRENT_REQUESTS = 6;

export default async function handler(req: any, res: any) {
  // CORS Headers for safety
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. 客戶端標頭初階衛生過濾（過濾常見預設腳本標頭；注意：UA 易被偽造，非主要防禦手段）
  const userAgent = (req.headers['user-agent'] as string || '').toLowerCase();
  if (/curl|python|wget|postman|scrapy|httpclient/i.test(userAgent)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 2. 容器層並發上限 (Concurrency Limit，防止單一實例被突發連線灌爆)
  if (activeConcurrentRequests >= MAX_CONCURRENT_REQUESTS) {
    return res.status(429).json({ error: '伺服器正忙，請稍候再試。' });
  }

  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'local';

  // 3. 容器內部 IP 頻率輔助檢查（真正的入口限流由 Vercel Edge Firewall 提供）
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: '請求過於頻繁，請稍候再試。' });
  }

  activeConcurrentRequests++;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { articleId, query, history } = body;

    if (!articleId || typeof articleId !== 'string' || articleId.length > 60) {
      return res.status(400).json({ error: '缺少或無效的 articleId 參數' });
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: '缺少 query 參數' });
    }

    // 4. 輸入長度硬性上限
    if (query.trim().length > 100) {
      return res.status(400).json({ error: '問題長度超過 100 字元上限。' });
    }

    const sanitizedQuery = query.trim().slice(0, 100);
    const sanitizedHistory = Array.isArray(history)
      ? history.slice(-4).map((h: any) => ({
          role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: String(h.content || '').trim().slice(0, 100),
        }))
      : [];

    const chatResult = await handleArticleChat({
      articleId: String(articleId),
      query: sanitizedQuery,
      history: sanitizedHistory,
    });

    return res.status(200).json(chatResult);
  } catch (err) {
    console.error('[API /api/article-chat Error]:', err);
    return res.status(500).json({ error: '伺服器問答異常，請稍候再試。' });
  } finally {
    activeConcurrentRequests--;
  }
}
