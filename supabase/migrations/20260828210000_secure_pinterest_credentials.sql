/* Pinterest credentials must live in Supabase Edge Function secrets, never public tables. */
UPDATE settings SET pinterest_access_token = NULL WHERE pinterest_access_token IS NOT NULL;

ALTER TABLE settings DROP COLUMN IF EXISTS pinterest_access_token;

DROP POLICY IF EXISTS "anon_select_articles" ON articles;
DROP POLICY IF EXISTS "anon_insert_articles" ON articles;
DROP POLICY IF EXISTS "anon_update_articles" ON articles;
DROP POLICY IF EXISTS "anon_delete_articles" ON articles;
DROP POLICY IF EXISTS "anon_select_campaigns" ON pin_campaigns;
DROP POLICY IF EXISTS "anon_insert_campaigns" ON pin_campaigns;
DROP POLICY IF EXISTS "anon_update_campaigns" ON pin_campaigns;
DROP POLICY IF EXISTS "anon_delete_campaigns" ON pin_campaigns;
DROP POLICY IF EXISTS "anon_select_settings" ON settings;
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
DROP POLICY IF EXISTS "anon_delete_settings" ON settings;

CREATE POLICY "admin_select_articles" ON articles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_insert_articles" ON articles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin_update_articles" ON articles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_delete_articles" ON articles FOR DELETE TO authenticated USING (true);
CREATE POLICY "admin_select_campaigns" ON pin_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_insert_campaigns" ON pin_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin_update_campaigns" ON pin_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_delete_campaigns" ON pin_campaigns FOR DELETE TO authenticated USING (true);
CREATE POLICY "admin_select_settings" ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_insert_settings" ON settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin_update_settings" ON settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_delete_settings" ON settings FOR DELETE TO authenticated USING (true);

COMMENT ON TABLE settings IS
  'Non-secret dashboard preferences only. PINTEREST_ACCESS_TOKEN, PINTEREST_BOARD_ID and AUTOMATION_SECRET are Edge Function secrets.';
