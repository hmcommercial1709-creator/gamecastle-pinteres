import { supabase } from "@/lib/supabase";
import type { Article, PinCampaign, Settings } from "@/types";

export async function fetchArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("fetched_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchCampaigns(): Promise<PinCampaign[]> {
  const { data, error } = await supabase
    .from("pin_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchSettings(): Promise<Settings | null> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  const existing = await fetchSettings();

  if (existing) {
    const { data, error } = await supabase
      .from("settings")
      .update({
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("settings")
    .insert(settings)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCampaign(
  id: string,
  updates: Partial<PinCampaign>
): Promise<PinCampaign> {
  const { data, error } = await supabase
    .from("pin_campaigns")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from("pin_campaigns").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) throw error;
}
