import { handleGlobalSearch, checkRateLimit } from './_lib/ragEngine';

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
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: '缺少 query 查詢參數' });
    }

    // Limit input length to 250 characters
    const sanitizedQuery = query.slice(0, 250);
    const searchResult = await handleGlobalSearch({ query: sanitizedQuery });

    return res.status(200).json(searchResult);
  } catch (err) {
    console.error('[API /api/search Error]:', err);
    return res.status(500).json({ error: '伺服器檢索異常，請稍候再試。' });
  }
}
