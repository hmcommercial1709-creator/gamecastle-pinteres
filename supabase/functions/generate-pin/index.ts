import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
  "أقوى خلفيات الأنمي التي لم تتراها من قبل... 🔥",
  "اكتشف المفاجأة الأسطورية التي ينتظرها كل عشاق الأنمي! ⚡",
  "هذه الخلفيات ستجعلك تعيد المشاهدة مراراً... لا تفوّتها! 🎮",
  "اللحظة التي طال انتظارها وصلت! اكتشف ما خفي عنك... ✨",
  "أمرٌ أسطوري ينتظره عشاق الأنمي والجيمينج... شاهد الآن! 🎌",
  "خلفيات خرافية ستنقلك لعالم آخر من الإبداع... 🌟",
  "ما رآه الجميع ولم يلاحظه أحد... اكتشف السر الآن! 🗡️",
  "أقوى تصاميم الأنمي على الإطلاق... جاهزة لك! 💫",
  "لن تصدق ما تم إصداره للتو... عش الأسطورة بنفسك! 🏆",
  "الخلفية التي سيتحدث عنها الجميع... كن أول من يكتشفها! 🌌",
];

const DESC_TEMPLATES = [
  "استعد لدخول عالم من الإثارة البصرية المطلقة! هذه الخلفيات ليست مجرد صور، بل بوابة نحو عوالم الأنمي الأسطورية التي طالما حلمت بها. كل تفصيل صُمم بعناية فائقة ليمنحك تجربة بصرية لا تُنسى. 🎮✨\n\nلا تدع هذه الفرصة تفوتك! اضغط على الرابط الآن واكتشف المجموعة الكاملة على GameCastle. 🔗👇",
  "هل أنت مستعد لاكتشاف ما لم يراه أحد من قبل؟ هذه المجموعة الأسطورية من خلفيات الأنمي ستعيد تعريف مفهوم الجمال في عالمك الرقمي. دقة عالية، ألوان مذهلة، وتصاميم تأسر القلوب. 🗡️🔥\n\nالكمية محدودة! زر GameCastle الآن واحصل على مجموعتك قبل نفادها. ⚡",
  "عشوق الأنمي... هذا ما كنت تنتظره! مجموعة استثنائية من الخلفيات السينمائية بجودة 4K فائقة الدقة. كل خلفية تحكي قصة، كل لقطة تنبض بالحياة. لا تكتمل مجموعتك بدونها. 🌟\n\nاضغط هنا وانتقل إلى GameCastle لتكتشف الكنز المخفي! 🎌",
  "الأنمي ليس مجرد مشاهدة، بل أسلوب حياة! وهذه الخلفيات تعكس ذلك بكل معنى الكلمة. تصاميم تجمع بين الفن والشغف والإبداع، مخصصة لكل من ينبض قلبه حباً لعالم الأنمي. 💫\n\nلا تفوّت اللحظة! زر الموقع الآن واختر خلفيتك المفضلة. 🔗",
  "ماذا لو أخبرتك أن هناك عالماً كاملاً من الإبداع ينتظرك؟ هذه الخلفيات السينمائية المذهلة ستنقلك إلى أبعاد جديدة من الجمال الفني. جودة استثنائية وتفاصيل تأسر الأنظار. 🏆\n\nاكتشف المزيد على GameCastle وكن جزءاً من المجتمع! 🎮",
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
  return `${template}\n\n"${cleanTitle}"`;
}

function generateArabicDescription(articleUrl: string): string {
  const template = pickRandom(DESC_TEMPLATES);
  const hashtags = pickHashtags(8);
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
    const imageUrl = await generateAnimeImage(article.title);
    const hashtags = pickHashtags(15);

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
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
