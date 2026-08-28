import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { campaign_id, access_token, board_id } = await req.json();

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ success: false, error: "campaign_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Pinterest access token is required. Add it in Settings.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("pin_campaigns")
      .select("*, articles!inner(url, title)")
      .eq("id", campaign_id)
      .maybeSingle();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetBoardId = board_id || campaign.board_id;

    if (!targetBoardId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No board ID specified. Add a Pinterest board ID in Settings or on the campaign.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("pin_campaigns")
      .update({ status: "publishing", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", campaign_id);

    const articleUrl = campaign.articles?.url || "https://gamecastle.store";

    const pinData: Record<string, unknown> = {
      board_id: targetBoardId,
      title: (campaign.arabic_title || "").substring(0, 100),
      description: (campaign.arabic_description || "").substring(0, 500),
      link: articleUrl,
      media_source: {
        source_type: "image_url",
        url: campaign.image_url,
      },
    };

    const response = await fetch("https://api.pinterest.com/v5/pins", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pinData),
    });

    const result = await response.json();

    if (!response.ok) {
      const errMsg =
        result?.message ||
        result?.detail ||
        `Pinterest API error (${response.status})`;

      await supabase
        .from("pin_campaigns")
        .update({
          status: "failed",
          error_message: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({ success: false, error: errMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("pin_campaigns")
      .update({
        status: "published",
        pin_id: result.id || result.data?.id || null,
        board_id: targetBoardId,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign_id);

    await supabase
      .from("articles")
      .update({ status: "published" })
      .eq("id", campaign.article_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Pin published successfully on Pinterest!",
        pin_id: result.id || result.data?.id,
        pin_url: result.url || result.data?.url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
