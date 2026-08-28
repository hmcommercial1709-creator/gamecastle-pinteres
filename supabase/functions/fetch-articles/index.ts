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

interface ArticleItem {
  title: string;
  url: string;
  excerpt: string;
  content: string;
  image_url: string;
}

function extractText(html: string, selector: RegExp): string {
  const match = html.match(selector);
  return match ? match[1].trim() : "";
}

function cleanHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPageContent(url: string): Promise<ArticleItem | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;
    const html = await response.text();

    const title =
      extractText(html, /<title[^>]*>(.*?)<\/title>/i) ||
      extractText(html, /<h1[^>]*>(.*?)<\/h1>/i) ||
      "Untitled Article";

    const ogImage =
      extractText(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
      extractText(html, /<meta\s+name="og:image"\s+content="([^"]+)"/i) ||
      extractText(html, /<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp))"/i) ||
      "";

    const description =
      extractText(html, /<meta\s+name="description"\s+content="([^"]+)"/i) ||
      extractText(html, /<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
      "";

    const content = cleanHtml(html).substring(0, 5000);

    return {
      title: title.replace(/&[^;]+;/g, "").trim(),
      url,
      excerpt: description.replace(/&[^;]+;/g, "").trim() || content.substring(0, 200),
      content,
      image_url: ogImage,
    };
  } catch {
    return null;
  }
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => match[1].trim());
}

async function discoverFromSitemaps(origin: string, hostname: string, maxUrls: number): Promise<string[]> {
  const discovered = new Set<string>();
  const sitemapQueue = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const visited = new Set<string>();

  while (sitemapQueue.length && discovered.size < maxUrls && visited.size < 50) {
    const sitemapUrl = sitemapQueue.shift()!;
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);
    try {
      const response = await fetch(sitemapUrl, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) continue;
      for (const loc of extractLocs(await response.text())) {
        const parsed = new URL(loc);
        if (parsed.hostname.replace(/^www\./, "") !== hostname) continue;
        if (loc.endsWith(".xml")) sitemapQueue.push(loc);
        else if (!/\.(?:jpg|jpeg|png|webp|gif|css|js|xml|pdf)(?:\?|$)/i.test(loc)) discovered.add(loc.replace(/\/$/, ""));
        if (discovered.size >= maxUrls) break;
      }
    } catch {
      // Try the next sitemap candidate.
    }
  }
  return [...discovered];
}

async function fetchArticlesFromSite(websiteUrl: string, maxUrls = 100): Promise<ArticleItem[]> {
  const articles: ArticleItem[] = [];
  const targetUrl = websiteUrl || "https://gamecastle.store";

  let hostname: string;
  try {
    hostname = new URL(targetUrl).hostname.replace(/^www\./, "");
  } catch {
    hostname = "gamecastle.store";
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const sitemapUrls = await discoverFromSitemaps(parsedTarget.origin, hostname, maxUrls);
    if (sitemapUrls.length > 0) {
      const batchSize = 8;
      for (let index = 0; index < sitemapUrls.length; index += batchSize) {
        const results = await Promise.all(sitemapUrls.slice(index, index + batchSize).map((url) => fetchPageContent(url)));
        for (const item of results) if (item && item.title !== "Untitled Article") articles.push(item);
      }
      return articles;
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch site: ${response.status}`);
    }

    const html = await response.text();

    const escapedHost = hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linkRegex = new RegExp(
      `<a[^>]+href="(https?://(?:www\\.)?${escapedHost}/[^"#]+)"`,
      "gi"
    );

    const urls = new Set<string>();
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1].replace(/\/$/, "");
      if (
        !url.includes("/cdn-cgi/") &&
        !url.includes("/wp-admin/") &&
        !url.includes("/wp-login/") &&
        !url.endsWith(".jpg") &&
        !url.endsWith(".png") &&
        !url.endsWith(".css") &&
        !url.endsWith(".js")
      ) {
        urls.add(url);
      }
    }

    const articleUrls = Array.from(urls).slice(0, maxUrls);

    const results = await Promise.all(articleUrls.map((url) => fetchPageContent(url)));
    for (const item of results) {
      if (item && item.title !== "Untitled Article") {
        articles.push(item);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch from ${targetUrl}: ${errorMsg}`);
  }

  return articles;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    await assertAdmin(req);
    const body = await req.json().catch(() => ({}));
    const websiteUrl = body.website_url || "https://gamecastle.store";
    const maxUrls = Math.min(Math.max(Number(body.max_urls || 100), 1), 500);
    const fetchedArticles = await fetchArticlesFromSite(websiteUrl, maxUrls);

    if (fetchedArticles.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No new articles found",
          articles: [],
          newCount: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let newCount = 0;
    const savedArticles = [];

    for (const article of fetchedArticles) {
      const { data: existing } = await supabase
        .from("articles")
        .select("id")
        .eq("url", article.url)
        .maybeSingle();

      if (existing) {
        savedArticles.push({ ...article, id: existing.id, duplicate: true });
        continue;
      }

      const { data, error } = await supabase
        .from("articles")
        .insert({
          title: article.title,
          url: article.url,
          excerpt: article.excerpt,
          content: article.content,
          image_url: article.image_url,
          status: "new",
        })
        .select()
        .single();

      if (!error && data) {
        newCount++;
        savedArticles.push({ ...article, id: data.id, duplicate: false });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Fetched ${fetchedArticles.length} articles, ${newCount} new`,
        articles: savedArticles,
        newCount,
        totalFetched: fetchedArticles.length,
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
