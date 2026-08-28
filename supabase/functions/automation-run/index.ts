import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Automation-Secret",
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const automationSecret = Deno.env.get("AUTOMATION_SECRET")!;
const supabase = createClient(supabaseUrl, serviceKey);

async function invoke(name: string, body: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "X-Automation-Secret": automationSecret,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || result.success === false) {
    throw new Error(result.error || `${name} failed (${response.status})`);
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  if (!automationSecret || req.headers.get("X-Automation-Secret") !== automationSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const websiteUrl = body.website_url || "https://gamecastle.store";
    const dailyLimit = Math.min(Math.max(Number(body.daily_limit || 3), 1), 8);

    const fetched = await invoke("fetch-articles", { website_url: websiteUrl, max_urls: 100 });
    const { data: publishedToday } = await supabase
      .from("pin_campaigns")
      .select("id", { count: "exact" })
      .eq("status", "published")
      .gte("updated_at", new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString());

    const remaining = Math.max(0, dailyLimit - (publishedToday?.length || 0));
    if (remaining === 0) {
      return new Response(JSON.stringify({ success: true, fetched: fetched.newCount || 0, published: 0, message: "Daily safety limit reached" }), { headers: corsHeaders });
    }

    const { data: ready } = await supabase
      .from("pin_campaigns")
      .select("id")
      .eq("status", "ready")
      .order("created_at", { ascending: true })
      .limit(remaining);

    const queue = [...(ready || [])];
    if (queue.length < remaining) {
      const { data: articles } = await supabase
        .from("articles")
        .select("id")
        .eq("status", "new")
        .order("fetched_at", { ascending: true })
        .limit(remaining - queue.length);
      for (const article of articles || []) {
        const generated = await invoke("generate-pin", { article_id: article.id });
        if (generated.campaign?.id) queue.push({ id: generated.campaign.id });
      }
    }

    let published = 0;
    const errors: string[] = [];
    for (const campaign of queue.slice(0, remaining)) {
      try {
        await invoke("publish-pin", { campaign_id: campaign.id });
        published++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    return new Response(JSON.stringify({ success: true, fetched: fetched.newCount || 0, published, errors }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: corsHeaders });
  }
});
