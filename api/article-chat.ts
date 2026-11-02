import { handleArticleChat, checkRateLimit } from './_lib/ragEngine';

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

  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'local';

  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: '請求過於頻繁，請稍候再試。' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { articleId, query, history } = body;

    if (!articleId || typeof articleId !== 'string') {
      return res.status(400).json({ error: '缺少 articleId 參數' });
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: '缺少 query 參數' });
    }

    // Limit input lengths
    const sanitizedQuery = query.slice(0, 250);
    const sanitizedHistory = Array.isArray(history)
      ? history.slice(-6).map((h: any) => ({
          role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: String(h.content || '').slice(0, 250),
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
  }
}
