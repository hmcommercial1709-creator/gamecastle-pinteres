import { createClient } from "npm:@supabase/supabase-js@2.57.4";

export async function assertAdmin(req: Request): Promise<void> {
  const automationSecret = Deno.env.get("AUTOMATION_SECRET");
  if (automationSecret && req.headers.get("X-Automation-Secret") === automationSecret) return;

  const authorization = req.headers.get("Authorization");
  const adminEmail = Deno.env.get("ADMIN_EMAIL")?.toLowerCase();
  if (!authorization || !adminEmail) throw new Error("Unauthorized");

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.email?.toLowerCase() !== adminEmail) throw new Error("Unauthorized");
}
