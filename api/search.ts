import { handleGlobalSearch, checkRateLimit } from './_lib/ragEngine.js';

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

  // 1. 公開 API 防濫用：阻斷無 User-Agent 或爬蟲掃描請求
  const userAgent = (req.headers['user-agent'] as string || '').toLowerCase();
  if (/curl|python|wget|postman|scrapy|httpclient/i.test(userAgent)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 2. 並發上限 (Concurrency Limit)
  if (activeConcurrentRequests >= MAX_CONCURRENT_REQUESTS) {
    return res.status(429).json({ error: '伺服器正忙，請稍候再試。' });
  }

  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'local';

  // 3. 請求頻率限制
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: '請求過於頻繁，請稍候再試。' });
  }

  activeConcurrentRequests++;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: '缺少 query 查詢參數' });
    }

    // 4. 輸入長度硬性上限 (防止超長 Payload 攻擊)
    if (query.trim().length > 100) {
      return res.status(400).json({ error: '查詢長度超過 100 字元上限。' });
    }

    const sanitizedQuery = query.trim().slice(0, 100);
    const searchResult = await handleGlobalSearch({ query: sanitizedQuery });

    return res.status(200).json(searchResult);
  } catch (err) {
    console.error('[API /api/search Error]:', err);
    return res.status(500).json({ error: '伺服器檢索異常，請稍候再試。' });
  } finally {
    activeConcurrentRequests--;
  }
}
