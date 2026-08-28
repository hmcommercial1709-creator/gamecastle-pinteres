export interface Article {
  id: string;
  title: string;
  url: string;
  excerpt: string | null;
  content: string | null;
  image_url: string | null;
  fetched_at: string;
  status: "new" | "processed" | "published";
}

export interface PinCampaign {
  id: string;
  article_id: string;
  arabic_title: string | null;
  arabic_description: string | null;
  image_url: string | null;
  hashtags: string[];
  board_id: string | null;
  pin_id: string | null;
  status: "draft" | "generating" | "ready" | "publishing" | "published" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  pinterest_access_token: string | null;
  pinterest_board_id: string | null;
  pinterest_username: string | null;
  website_url: string | null;
  auto_publish: boolean;
}

export interface CampaignWithArticle extends PinCampaign {
  articles?: Pick<Article, "url" | "title">;
}

export const VIRAL_HASHTAGS = [
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
