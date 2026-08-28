import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { assertAdmin } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const VIRAL_HASHTAGS = [
  "AnimeWallpaper",
  "SoloLeveling",
  "OnePiece",
  "AnimeArt",
  "GamingCommunity",
  "AnimeGirl",
  "Otaku",
  "MangaArt",
  "AnimeAesthetic",
  "Weeb",
  "AnimeFan",
  "Cosplay",
  "GamingLife",
  "AnimeLover",
  "Naruto",
  "DemonSlayer",
  "JujutsuKaisen",
  "AnimeEdit",
  "4KWallpaper",
  "AnimeBackground",
];

const TITLE_TEMPLATES = [
  "Complete Guide: {title}",
  "Everything Anime Fans Need to Know About {title}",
  "The Ultimate {title} Guide",
  "Save This Anime Guide: {title}",
  "Explore {title} on GameCastle",
];

const DESC_TEMPLATES = [
  "A clear, fan-friendly guide with the essential details in one place. Read the complete article on GameCastle and save this Pin for later.",
  "Looking for a useful anime guide without the filler? Explore the full breakdown, related recommendations, and more on GameCastle.",
  "Discover the complete guide for anime fans, with practical answers and related resources. Visit GameCastle to continue reading.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickHashtags(count: number): string[] {
  const shuffled = [...VIRAL_HASHTAGS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateArabicTitle(articleTitle: string): string {
  const template = pickRandom(TITLE_TEMPLATES);
  const cleanTitle = articleTitle.replace(/[<>]/g, "").trim();
  return template.replace("{title}", cleanTitle).substring(0, 100);
}

function generateArabicDescription(articleUrl: string): string {
  const template = pickRandom(DESC_TEMPLATES);
  const hashtags = pickHashtags(5);
  const hashtagStr = hashtags.map((h) => `#${h}`).join(" ");
  return `${template}\n\n${articleUrl}\n\n${hashtagStr}`;
}

async function generateAnimeImage(articleTitle: string): Promise<string> {
  const styleKeywords = [
    "cinematic anime",
    "ultra HD 4K",
    "dramatic lighting",
    "epic composition",
    "vibrant colors",
    "detailed background",
    "anime movie quality",
    "studio quality render",
  ];

  const prompt = `cinematic anime wallpaper, ${articleTitle}, ${styleKeywords.join(", ")}, masterpiece, trending on artstation, 8k resolution`;

  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1350&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

  return pollinationsUrl;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    await assertAdmin(req);
    const { article_id, regenerate } = await req.json();

    if (!article_id) {
      return new Response(
        JSON.stringify({ success: false, error: "article_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", article_id)
      .maybeSingle();

    if (articleError || !article) {
      return new Response(
        JSON.stringify({ success: false, error: "Article not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!regenerate) {
      const { data: existingCampaign } = await supabase
        .from("pin_campaigns")
        .select("*")
        .eq("article_id", article_id)
        .neq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingCampaign) {
        return new Response(
          JSON.stringify({
            success: true,
            campaign: existingCampaign,
            message: "Existing campaign found",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const arabicTitle = generateArabicTitle(article.title);
    const arabicDescription = generateArabicDescription(article.url);
    const imageUrl = article.image_url || await generateAnimeImage(article.title);
    const hashtags = pickHashtags(5);

    const { data: campaign, error: campaignError } = await supabase
      .from("pin_campaigns")
      .insert({
        article_id: article_id,
        arabic_title: arabicTitle,
        arabic_description: arabicDescription,
        image_url: imageUrl,
        hashtags,
        status: "ready",
      })
      .select()
      .single();

    if (campaignError) {
      throw new Error(`Failed to create campaign: ${campaignError.message}`);
    }

    await supabase
      .from("articles")
      .update({ status: "processed" })
      .eq("id", article_id);

    return new Response(
      JSON.stringify({
        success: true,
        campaign,
        message: "Pin content generated successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const status = errorMsg === "Unauthorized" ? 401 : 500;
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
