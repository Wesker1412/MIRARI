import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { handleGlobalSearch, handleArticleChat } from './api/_lib/ragEngine.ts';

function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 200;
          return res.end();
        }

        // 1. 公開 API 防濫用：阻斷爬蟲與掃描腳本
        const userAgent = (req.headers['user-agent'] as string || '').toLowerCase();
        if (/curl|python|wget|postman|scrapy|httpclient/i.test(userAgent)) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Forbidden' }));
        }

        if (req.url === '/api/search' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}');
              if (!parsed.query || typeof parsed.query !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: '缺少 query 查詢參數' }));
              }
              if (parsed.query.trim().length > 100) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: '查詢長度超過 100 字元上限。' }));
              }
              const result = await handleGlobalSearch({ query: parsed.query.trim().slice(0, 100) });
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Search Error' }));
            }
          });
          return;
        }

        if (req.url === '/api/article-chat' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}');
              if (!parsed.articleId || typeof parsed.articleId !== 'string' || parsed.articleId.length > 60) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: '缺少或無效的 articleId 參數' }));
              }
              if (!parsed.query || typeof parsed.query !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: '缺少 query 參數' }));
              }
              if (parsed.query.trim().length > 100) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: '問題長度超過 100 字元上限。' }));
              }
              const sanitizedHistory = Array.isArray(parsed.history)
                ? parsed.history.slice(-4).map((h: any) => ({
                    role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
                    content: String(h.content || '').trim().slice(0, 100),
                  }))
                : [];
              const result = await handleArticleChat({
                articleId: parsed.articleId,
                query: parsed.query.trim().slice(0, 100),
                history: sanitizedHistory,
              });
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Chat Error' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApiPlugin()],
});
