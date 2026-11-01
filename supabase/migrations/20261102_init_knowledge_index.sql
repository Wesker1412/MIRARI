-- ========================================================================
-- MIRARI 知識庫與語意向量架構 (PostgreSQL + pgvector for Supabase)
-- 獨立資料庫架構設計，支援增量更新、版本比對、快取重用與精確文字對照
-- ========================================================================

-- 1. 啟用 pgvector 擴充套件
create extension if not exists vector;

-- 2. 文章主檔資料表 (Articles Registry)
create table if not exists public.articles (
  id text primary key,                           -- 穩定唯一 ID (如 'art-exoplanet-transit')
  slug text not null unique,                     -- 獨立 URL slug
  version integer not null default 1,            -- 文章版號 (防止舊版本覆蓋新版本)
  title text not null,
  subtitle text not null default '',
  status text not null check (status in ('published', 'in_preparation', 'archived')),
  published_date text,
  format text not null,
  format_badge_text text not null,
  topic_ids text[] not null default '{}',
  tags text[] not null default '{}',
  content_hash text not null,                    -- 全文 SHA-256 雜湊
  metadata jsonb not null default '{}'::jsonb,   -- 作者、參考文獻、系列關聯等完整詮釋資料
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. 文章語意文字區塊表 (Article Chunks)
-- 儲存具備章節上下文的段落級區塊，用於語意檢索
create table if not exists public.article_chunks (
  id text primary key,                           -- 格式: {article_id}-{chunk_hash8}
  article_id text not null references public.articles(id) on delete cascade,
  section_id text not null,
  section_title text not null,
  chunk_index integer not null,
  content text not null,                         -- 純淨正文文字 (排除裝飾性 UI 與程式碼)
  content_hash text not null,                    -- 區塊專屬 SHA-256 雜湊 (用於增量更新)
  char_start integer not null,
  char_end integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_article_chunks_article_id on public.article_chunks(article_id);
create index if not exists idx_article_chunks_content_hash on public.article_chunks(content_hash);

-- 4. 區塊向量索引表 (Chunk Embeddings)
-- 支援不同模型版本切換，如 text-embedding-004 (768 維) 或 text-embedding-3-small (1536 維)
create table if not exists public.chunk_embeddings (
  id bigserial primary key,
  chunk_id text not null references public.article_chunks(id) on delete cascade,
  article_id text not null references public.articles(id) on delete cascade,
  embedding vector(768) not null,                -- 預設使用 768 維 (可依模型調整)
  model_version text not null,                   -- 紀錄模型版本 (如 'text-embedding-004')
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(chunk_id, model_version)
);

create index if not exists idx_chunk_embeddings_chunk_id on public.chunk_embeddings(chunk_id);
-- HNSW 向量索引，支援極速餘弦相似度查詢
create index if not exists idx_chunk_embeddings_hnsw on public.chunk_embeddings 
using hnsw (embedding vector_cosine_ops);

-- 5. 原文證據句子索引表 (Sentence Evidence Index)
-- 由正式文章自動產生，MIRARI 伴讀問答用於精準比對原文句子與文字範圍
create table if not exists public.article_sentences (
  sentence_id text primary key,                  -- 穩定唯一 ID (如 sent-{hash8})
  article_id text not null references public.articles(id) on delete cascade,
  chunk_id text not null references public.article_chunks(id) on delete cascade,
  section_id text not null,
  section_title text not null,
  paragraph_index integer not null,
  exact_quote text not null,                     -- 原文精準字串 (不可截斷)
  char_start integer not null,
  char_end integer not null,
  content_hash text not null,
  context_note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_article_sentences_article_id on public.article_sentences(article_id);

-- 6. 發布與增量同步日誌 (Index Sync Log)
-- 紀錄每次文章發布或修改時的處理狀態，支援重試與版本並行保護
create table if not exists public.index_sync_log (
  id bigserial primary key,
  article_id text not null,
  article_version integer not null,
  content_hash text not null,
  status text not null check (status in ('pending', 'indexed', 'failed')),
  total_chunks integer not null default 0,
  embedded_chunks integer not null default 0,
  reused_chunks integer not null default 0,      -- 未修改內容重用原有向量的數量
  model_version text not null,
  error_message text,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone
);

create index if not exists idx_index_sync_log_article on public.index_sync_log(article_id, article_version);

-- 7. 語意向量相似度搜尋 RPC 函式 (Match Article Chunks)
create or replace function public.match_article_chunks (
  query_embedding vector(768),
  match_threshold float default 0.65,
  match_count int default 5,
  filter_article_id text default null,
  filter_status text default 'published'
)
returns table (
  chunk_id text,
  article_id text,
  section_id text,
  section_title text,
  content text,
  similarity float
)
language plpgsql
stable
as $$
begin
  return query
  select
    c.id as chunk_id,
    c.article_id,
    c.section_id,
    c.section_title,
    c.content,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.chunk_embeddings e
  join public.article_chunks c on c.id = e.chunk_id
  join public.articles a on a.id = c.article_id
  where
    (filter_article_id is null or c.article_id = filter_article_id)
    and (filter_status is null or a.status = filter_status)
    and 1 - (e.embedding <=> query_embedding) >= match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
