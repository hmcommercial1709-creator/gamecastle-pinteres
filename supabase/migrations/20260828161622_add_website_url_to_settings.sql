/*
# Add website_url column to settings table

## Changes
- Adds `website_url` (text) column to the `settings` table
- Defaults to 'https://gamecastle.store' so the dashboard has a pre-filled website link
- No security changes needed (RLS already enabled with anon+authenticated CRUD policies)

## Important Notes
1. Uses IF NOT EXISTS guard to be idempotent
2. Non-destructive: only adds a column, no data loss
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'website_url'
  ) THEN
    ALTER TABLE settings ADD COLUMN website_url text DEFAULT 'https://gamecastle.store';
  END IF;
END $$;
