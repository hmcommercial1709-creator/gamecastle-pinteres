/*
# Pinterest Automation Dashboard Tables

## Overview
Creates the core tables for a Pinterest automation system that:
1. Fetches articles from gamecastle.store
2. Generates Arabic cinematic anime content with AI images
3. Publishes pins to Pinterest automatically

## New Tables

### articles
- Stores fetched articles from gamecastle.store
- `id` (uuid, primary key)
- `title` (text) - article title
- `url` (text, unique) - article URL
- `excerpt` (text) - short description
- `content` (text) - full article content
- `image_url` (text) - original article image
- `fetched_at` (timestamptz) - when the article was fetched
- `status` (text) - 'new', 'processed', 'published'

### pin_campaigns
- Stores generated Pinterest pin content for each article
- `id` (uuid, primary key)
- `article_id` (uuid, FK to articles) - linked article
- `arabic_title` (text) - generated Arabic title
- `arabic_description` (text) - generated Arabic description
- `image_url` (text) - generated AI anime image URL
- `hashtags` (text[]) - array of viral hashtags
- `board_id` (text) - Pinterest board ID
- `pin_id` (text) - Pinterest pin ID after publishing
- `status` (text) - 'draft', 'generating', 'ready', 'publishing', 'published', 'failed'
- `error_message` (text) - error details if failed
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### settings
- Stores Pinterest API configuration
- `id` (uuid, primary key)
- `pinterest_access_token` (text) - Pinterest API token
- `pinterest_board_id` (text) - default board ID
- `pinterest_username` (text) - Pinterest username
- `auto_publish` (boolean, default false)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## Security
- RLS enabled on all tables
- Single-tenant app (no auth) - anon + authenticated can CRUD
- All data is intentionally shared/public within this dashboard
*/

CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text UNIQUE NOT NULL,
  excerpt text,
  content text,
  image_url text,
  fetched_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'new'
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_articles" ON articles;
CREATE POLICY "anon_select_articles" ON articles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_articles" ON articles;
CREATE POLICY "anon_insert_articles" ON articles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_articles" ON articles;
CREATE POLICY "anon_update_articles" ON articles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_articles" ON articles;
CREATE POLICY "anon_delete_articles" ON articles FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS pin_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
  arabic_title text,
  arabic_description text,
  image_url text,
  hashtags text[] DEFAULT '{}',
  board_id text,
  pin_id text,
  status text NOT NULL DEFAULT 'draft',
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pin_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_campaigns" ON pin_campaigns;
CREATE POLICY "anon_select_campaigns" ON pin_campaigns FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_campaigns" ON pin_campaigns;
CREATE POLICY "anon_insert_campaigns" ON pin_campaigns FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_campaigns" ON pin_campaigns;
CREATE POLICY "anon_update_campaigns" ON pin_campaigns FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_campaigns" ON pin_campaigns;
CREATE POLICY "anon_delete_campaigns" ON pin_campaigns FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pinterest_access_token text,
  pinterest_board_id text,
  pinterest_username text,
  auto_publish boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_settings" ON settings;
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON pin_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_article_id ON pin_campaigns(article_id);
