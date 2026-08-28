import { useState, useEffect, useCallback } from "react";
import {
  Newspaper,
  Image,
  Settings as SettingsIcon,
  Zap,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Send,
  ExternalLink,
  Copy,
  Sparkles,
  TrendingUp,
  LayoutDashboard,
  AlertCircle,
  Globe,
  Key,
  LayoutGrid,
  Rocket,
  Hash,
} from "lucide-react";
import { supabase, callEdgeFunction } from "@/lib/supabase";
import {
  fetchArticles,
  fetchCampaigns,
  fetchSettings,
  saveSettings,
  updateCampaign,
  deleteCampaign,
  deleteArticle,
} from "@/lib/api";
import type { Article, PinCampaign, Settings } from "@/types";
import { VIRAL_HASHTAGS } from "@/types";

type View = "dashboard" | "articles" | "campaigns" | "settings";

const STATUS_STYLES: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  new: { color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Clock, label: "New" },
  processed: { color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Sparkles, label: "Processed" },
  published: { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2, label: "Published" },
  draft: { color: "bg-slate-500/15 text-slate-400 border-slate-500/30", icon: Clock, label: "Draft" },
  generating: { color: "bg-purple-500/15 text-purple-400 border-purple-500/30", icon: Loader2, label: "Generating" },
  ready: { color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30", icon: Sparkles, label: "Ready" },
  publishing: { color: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: Loader2, label: "Publishing" },
  failed: { color: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle, label: "Failed" },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES["draft"];
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${style.color}`}>
      <Icon className={`w-3 h-3 ${status === "generating" || status === "publishing" ? "animate-spin" : ""}`} />
      {style.label}
    </span>
  );
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [articles, setArticles] = useState<Article[]>([]);
  const [campaigns, setCampaigns] = useState<PinCampaign[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingArticles, setFetchingArticles] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<PinCampaign | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoProgress, setAutoProgress] = useState<{ step: string; current: number; total: number } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [a, c, s] = await Promise.all([
        fetchArticles(),
        fetchCampaigns(),
        fetchSettings(),
      ]);
      setArticles(a);
      setCampaigns(c);
      setSettings(s);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const channel = supabase
      .channel("pinterest-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "articles" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "pin_campaigns" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAll]);

  const handleFetchArticles = async (websiteUrl?: string) => {
    setFetchingArticles(true);
    try {
      const result = await callEdgeFunction("fetch-articles", { website_url: websiteUrl });
      showToast(result.message || `Fetched ${result.newCount} new articles`);
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to fetch articles", "error");
    } finally {
      setFetchingArticles(false);
    }
  };

  const handleGeneratePin = async (articleId: string) => {
    setGeneratingId(articleId);
    try {
      const result = await callEdgeFunction("generate-pin", { article_id: articleId });
      if (result.campaign) {
        showToast("Pin content generated with AI anime visual!");
        await loadAll();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to generate pin", "error");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleRegenerate = async (campaign: PinCampaign) => {
    setGeneratingId(campaign.article_id);
    try {
      const result = await callEdgeFunction("generate-pin", {
        article_id: campaign.article_id,
        regenerate: true,
      });
      if (result.campaign) {
        showToast("Pin content regenerated!");
        await loadAll();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to regenerate", "error");
    } finally {
      setGeneratingId(null);
    }
  };

  const handlePublishPin = async (campaign: PinCampaign) => {
    if (!settings?.pinterest_access_token) {
      showToast("Add your Pinterest access token in Settings first", "error");
      setView("settings");
      return;
    }
    if (!settings?.pinterest_board_id && !campaign.board_id) {
      showToast("Add a Pinterest board ID in Settings first", "error");
      setView("settings");
      return;
    }

    setPublishingId(campaign.id);
    try {
      const result = await callEdgeFunction("publish-pin", {
        campaign_id: campaign.id,
        access_token: settings.pinterest_access_token,
        board_id: settings.pinterest_board_id,
      });
      showToast(result.message || "Pin published successfully!");
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to publish pin", "error");
    } finally {
      setPublishingId(null);
    }
  };

  // Full automation: fetch articles → generate pins → publish all
  const handleAutoGenerateAndPublish = async (websiteUrl: string, token: string, boardId: string) => {
    if (!token) {
      showToast("Enter your Pinterest access token first", "error");
      return;
    }
    if (!boardId) {
      showToast("Enter your Pinterest board ID first", "error");
      return;
    }

    setAutoRunning(true);
    try {
      // Step 1: Fetch articles
      setAutoProgress({ step: "Fetching articles from website...", current: 0, total: 3 });
      const fetchResult = await callEdgeFunction("fetch-articles", { website_url: websiteUrl });
      await loadAll();

      const newArticles = articles.filter((a) => a.status === "new");
      const articleCount = newArticles.length > 0 ? newArticles.length : (fetchResult.articles?.length || 0);

      if (articleCount === 0) {
        showToast("No new articles found to process");
        setAutoProgress(null);
        setAutoRunning(false);
        return;
      }

      // Step 2: Generate pins for each article
      setAutoProgress({ step: "Generating AI anime visuals & Arabic content...", current: 1, total: 3 });
      const articlesToProcess = newArticles.length > 0 ? newArticles : (fetchResult.articles || []);
      const generatedCampaigns: PinCampaign[] = [];

      for (let i = 0; i < articlesToProcess.length; i++) {
        const art = articlesToProcess[i];
        setAutoProgress({
          step: `Generating pin ${i + 1} of ${articlesToProcess.length}...`,
          current: 1,
          total: 3,
        });
        try {
          const result = await callEdgeFunction("generate-pin", { article_id: art.id });
          if (result.campaign) {
            generatedCampaigns.push(result.campaign);
          }
        } catch {
          // continue with next article
        }
      }

      await loadAll();

      if (generatedCampaigns.length === 0) {
        showToast("No pins were generated. Check your articles.");
        setAutoProgress(null);
        setAutoRunning(false);
        return;
      }

      // Step 3: Publish all generated pins
      setAutoProgress({ step: "Publishing pins to Pinterest...", current: 2, total: 3 });
      let publishedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < generatedCampaigns.length; i++) {
        const camp = generatedCampaigns[i];
        setAutoProgress({
          step: `Publishing pin ${i + 1} of ${generatedCampaigns.length}...`,
          current: 2,
          total: 3,
        });
        try {
          await callEdgeFunction("publish-pin", {
            campaign_id: camp.id,
            access_token: token,
            board_id: boardId,
          });
          publishedCount++;
        } catch {
          failedCount++;
        }
      }

      setAutoProgress({ step: "Complete!", current: 3, total: 3 });
      await loadAll();

      if (failedCount > 0) {
        showToast(`${publishedCount} pins published, ${failedCount} failed. Check campaigns for details.`, "error");
      } else {
        showToast(`${publishedCount} pins published to Pinterest successfully!`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Automation failed", "error");
    } finally {
      setAutoProgress(null);
      setAutoRunning(false);
    }
  };

  const handleSaveSettings = async (s: Partial<Settings>) => {
    try {
      const saved = await saveSettings(s);
      setSettings(saved);
      showToast("Settings saved successfully");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save settings", "error");
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    try {
      await deleteCampaign(id);
      setSelectedCampaign(null);
      showToast("Campaign deleted");
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete", "error");
    }
  };

  const handleDeleteArticle = async (id: string) => {
    try {
      await deleteArticle(id);
      showToast("Article deleted");
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete", "error");
    }
  };

  const stats = {
    totalArticles: articles.length,
    newArticles: articles.filter((a) => a.status === "new").length,
    totalCampaigns: campaigns.length,
    readyCampaigns: campaigns.filter((c) => c.status === "ready").length,
    publishedCampaigns: campaigns.filter((c) => c.status === "published").length,
    failedCampaigns: campaigns.filter((c) => c.status === "failed").length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/50 border-r border-slate-800 flex flex-col fixed h-full">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">PinAutomate</h1>
              <p className="text-xs text-slate-500">GameCastle Edition</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: "dashboard" as View, icon: LayoutDashboard, label: "Dashboard" },
            { id: "articles" as View, icon: Newspaper, label: "Articles", count: stats.newArticles },
            { id: "campaigns" as View, icon: Image, label: "Pin Campaigns", count: stats.readyCampaigns },
            { id: "settings" as View, icon: SettingsIcon, label: "Settings" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                view === item.id
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span className="px-1.5 py-0.5 text-xs rounded-md bg-cyan-500/20 text-cyan-300">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="text-xs text-slate-500 mb-2">Quick Fetch</div>
          <button
            onClick={() => handleFetchArticles(settings?.website_url || undefined)}
            disabled={fetchingArticles || autoRunning}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-all shadow-lg shadow-cyan-500/20"
          >
            {fetchingArticles ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Fetch New Articles
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        {toast && (
          <div
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {view === "dashboard" && (
          <DashboardView
            stats={stats}
            onNavigate={setView}
            onFetch={() => handleFetchArticles(settings?.website_url || undefined)}
            fetching={fetchingArticles}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onAutoGenerate={handleAutoGenerateAndPublish}
            autoRunning={autoRunning}
            autoProgress={autoProgress}
          />
        )}

        {view === "articles" && (
          <ArticlesView
            articles={articles}
            onGenerate={handleGeneratePin}
            generatingId={generatingId}
            onDelete={handleDeleteArticle}
          />
        )}

        {view === "campaigns" && (
          <CampaignsView
            campaigns={campaigns}
            onPublish={handlePublishPin}
            onRegenerate={handleRegenerate}
            onDelete={handleDeleteCampaign}
            publishingId={publishingId}
            generatingId={generatingId}
            selectedCampaign={selectedCampaign}
            setSelectedCampaign={setSelectedCampaign}
            onUpdateCampaign={updateCampaign}
          />
        )}

        {view === "settings" && (
          <SettingsView settings={settings} onSave={handleSaveSettings} />
        )}
      </main>
    </div>
  );
}

// ─── Dashboard with prominent control panel ─────────────────────────────

function DashboardView({
  stats,
  onNavigate,
  onFetch,
  fetching,
  settings,
  onSaveSettings,
  onAutoGenerate,
  autoRunning,
  autoProgress,
}: {
  stats: { totalArticles: number; newArticles: number; totalCampaigns: number; readyCampaigns: number; publishedCampaigns: number; failedCampaigns: number };
  onNavigate: (v: View) => void;
  onFetch: () => void;
  fetching: boolean;
  settings: Settings | null;
  onSaveSettings: (s: Partial<Settings>) => void;
  onAutoGenerate: (websiteUrl: string, token: string, boardId: string) => void;
  autoRunning: boolean;
  autoProgress: { step: string; current: number; total: number } | null;
}) {
  const [websiteUrl, setWebsiteUrl] = useState(settings?.website_url || "https://gamecastle.store");
  const [token, setToken] = useState(settings?.pinterest_access_token || "");
  const [boardId, setBoardId] = useState(settings?.pinterest_board_id || "");
  const [showToken, setShowToken] = useState(false);

  // Sync when settings load
  useEffect(() => {
    if (settings) {
      setWebsiteUrl(settings.website_url || "https://gamecastle.store");
      setToken(settings.pinterest_access_token || "");
      setBoardId(settings.pinterest_board_id || "");
    }
  }, [settings]);

  const handleSaveAndRun = async () => {
    // Save settings first
    await onSaveSettings({
      website_url: websiteUrl,
      pinterest_access_token: token,
      pinterest_board_id: boardId,
    });
    // Then run full automation
    onAutoGenerate(websiteUrl, token, boardId);
  };

  const cards = [
    { label: "Total Articles", value: stats.totalArticles, icon: Newspaper, color: "from-blue-500 to-cyan-500" },
    { label: "New Articles", value: stats.newArticles, icon: Sparkles, color: "from-cyan-500 to-teal-500" },
    { label: "Ready to Publish", value: stats.readyCampaigns, icon: Send, color: "from-amber-500 to-orange-500" },
    { label: "Published Pins", value: stats.publishedCampaigns, icon: CheckCircle2, color: "from-emerald-500 to-green-500" },
  ];

  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Dashboard Overview</h2>
        <p className="text-slate-400 text-sm">Configure your pipeline and generate + publish pins automatically</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">{card.value}</p>
            <p className="text-sm text-slate-400">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Main Control Panel */}
      <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Automation Control Panel</h3>
            <p className="text-xs text-slate-400">Enter your details below, then generate and publish pins in one click</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Website URL */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              Website Link
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://gamecastle.store"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1.5">The website to fetch articles from</p>
          </div>

          {/* Pinterest Access Token */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <Key className="w-4 h-4 text-cyan-400" />
              Pinterest API Access Token
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your Pinterest API access token"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 pr-10 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none transition-colors"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Get this from{" "}
              <a href="https://developers.pinterest.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">
                developers.pinterest.com
              </a>
            </p>
          </div>

          {/* Pinterest Board ID */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <LayoutGrid className="w-4 h-4 text-cyan-400" />
              Pinterest Board ID
            </label>
            <input
              type="text"
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              placeholder="e.g. 1234567890123456789"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1.5">The numeric ID of the Pinterest board where pins will be published</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleSaveAndRun}
              disabled={autoRunning || fetching || !token || !boardId}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-lg shadow-cyan-500/20"
            >
              {autoRunning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Running Automation...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Generate & Publish All Pins
                </>
              )}
            </button>
            <button
              onClick={onFetch}
              disabled={fetching || autoRunning}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-medium transition-all"
            >
              {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Fetch Articles Only
            </button>
          </div>

          {/* Automation Progress */}
          {autoProgress && (
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        autoProgress.current > i
                          ? "bg-emerald-400"
                          : autoProgress.current === i
                          ? "bg-cyan-400 animate-pulse"
                          : "bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-slate-300">{autoProgress.step}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500"
                  style={{ width: `${(autoProgress.current / autoProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate("articles")}
          className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-left hover:border-cyan-500/30 transition-all group"
        >
          <Newspaper className="w-8 h-8 text-cyan-400 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold mb-1">Manage Articles</h3>
          <p className="text-sm text-slate-400">View fetched articles and generate pin content individually</p>
        </button>

        <button
          onClick={() => onNavigate("campaigns")}
          className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-left hover:border-cyan-500/30 transition-all group"
        >
          <Image className="w-8 h-8 text-cyan-400 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold mb-1">Pin Campaigns</h3>
          <p className="text-sm text-slate-400">Review, edit, and publish generated pins to Pinterest</p>
        </button>
      </div>

      {/* Trending Hashtags Preview */}
      <div className="mt-4 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Hash className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold">Trending Viral Hashtags</h3>
          <span className="text-xs text-slate-500">auto-attached to every pin</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {VIRAL_HASHTAGS.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-slate-400"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Articles View ──────────────────────────────────────────────────────

function ArticlesView({
  articles,
  onGenerate,
  generatingId,
  onDelete,
}: {
  articles: Article[];
  onGenerate: (id: string) => void;
  generatingId: string | null;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <header className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Articles</h2>
        <p className="text-slate-400 text-sm">Fetched from gamecastle.store - generate pin content for each</p>
      </header>

      {articles.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
          <Newspaper className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-2">No articles yet</p>
          <p className="text-sm text-slate-500">Go to the Dashboard and click "Fetch Articles Only" to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <div
              key={article.id}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all"
            >
              <div className="flex items-start gap-4">
                {article.image_url ? (
                  <img
                    src={article.image_url}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0 bg-slate-800"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Newspaper className="w-8 h-8 text-slate-600" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-sm leading-snug truncate-2-lines">{article.title}</h3>
                    <StatusBadge status={article.status} />
                  </div>
                  {article.excerpt && (
                    <p className="text-xs text-slate-400 mb-3 line-clamp-2">{article.excerpt}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Original
                    </a>
                    <span className="text-xs text-slate-600">
                      {new Date(article.fetched_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => onGenerate(article.id)}
                    disabled={generatingId === article.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50 text-xs font-medium transition-all whitespace-nowrap"
                  >
                    {generatingId === article.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Generate Pin
                  </button>
                  <button
                    onClick={() => onDelete(article.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Campaigns View ─────────────────────────────────────────────────────

function CampaignsView({
  campaigns,
  onPublish,
  onRegenerate,
  onDelete,
  publishingId,
  generatingId,
  selectedCampaign,
  setSelectedCampaign,
  onUpdateCampaign,
}: {
  campaigns: PinCampaign[];
  onPublish: (c: PinCampaign) => void;
  onRegenerate: (c: PinCampaign) => void;
  onDelete: (id: string) => void;
  publishingId: string | null;
  generatingId: string | null;
  selectedCampaign: PinCampaign | null;
  setSelectedCampaign: (c: PinCampaign | null) => void;
  onUpdateCampaign: (id: string, updates: Partial<PinCampaign>) => Promise<PinCampaign>;
}) {
  if (selectedCampaign) {
    return (
      <CampaignDetail
        campaign={selectedCampaign}
        onBack={() => setSelectedCampaign(null)}
        onPublish={onPublish}
        onRegenerate={onRegenerate}
        publishingId={publishingId}
        generatingId={generatingId}
        onUpdate={onUpdateCampaign}
        onDelete={onDelete}
      />
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Pin Campaigns</h2>
        <p className="text-slate-400 text-sm">Generated Arabic content with AI anime visuals ready for Pinterest</p>
      </header>

      {campaigns.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
          <Image className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-2">No campaigns yet</p>
          <p className="text-sm text-slate-500">Generate pin content from the Articles tab or use the Dashboard automation button</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all cursor-pointer"
              onClick={() => setSelectedCampaign(campaign)}
            >
              {campaign.image_url && (
                <div className="aspect-[4/5] bg-slate-800 relative overflow-hidden">
                  <img
                    src={campaign.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "";
                      (e.target as HTMLImageElement).style.background = "#1e293b";
                    }}
                  />
                  <div className="absolute top-3 right-3">
                    <StatusBadge status={campaign.status} />
                  </div>
                </div>
              )}
              <div className="p-4">
                <p className="text-sm font-medium leading-snug line-clamp-3 mb-2" dir="rtl" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
                  {campaign.arabic_title}
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {campaign.hashtags.slice(0, 4).map((tag) => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      #{tag}
                    </span>
                  ))}
                  {campaign.hashtags.length > 4 && (
                    <span className="text-xs text-slate-500">+{campaign.hashtags.length - 4}</span>
                  )}
                </div>
                {campaign.error_message && (
                  <p className="text-xs text-red-400 mb-2 flex items-start gap-1.5">
                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{campaign.error_message}</span>
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedCampaign(campaign); }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium transition-all"
                  >
                    <Image className="w-3.5 h-3.5" />
                    View
                  </button>
                  {(campaign.status === "ready" || campaign.status === "failed") && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onPublish(campaign); }}
                      disabled={publishingId === campaign.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50 text-xs font-medium transition-all"
                    >
                      {publishingId === campaign.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Publish
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Campaign Detail ────────────────────────────────────────────────────

function CampaignDetail({
  campaign,
  onBack,
  onPublish,
  onRegenerate,
  publishingId,
  generatingId,
  onUpdate,
  onDelete,
}: {
  campaign: PinCampaign;
  onBack: () => void;
  onPublish: (c: PinCampaign) => void;
  onRegenerate: (c: PinCampaign) => void;
  publishingId: string | null;
  generatingId: string | null;
  onUpdate: (id: string, updates: Partial<PinCampaign>) => Promise<PinCampaign>;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(campaign.arabic_title || "");
  const [description, setDescription] = useState(campaign.arabic_description || "");
  const [hashtags, setHashtags] = useState<string[]>(campaign.hashtags || []);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(campaign.id, { arabic_title: title, arabic_description: description, hashtags });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    const text = `${title}\n\n${description}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleHashtag = (tag: string) => {
    setHashtags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors"
      >
        ← Back to Campaigns
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            {campaign.image_url && (
              <div className="aspect-[4/5] bg-slate-800 relative">
                <img
                  src={campaign.image_url}
                  alt="Generated anime visual"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <StatusBadge status={campaign.status} />
                <span className="text-xs text-slate-500">
                  {new Date(campaign.created_at).toLocaleString()}
                </span>
              </div>
              {campaign.pin_id && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 mb-3">
                  <CheckCircle2 className="w-4 h-4" />
                  Published as Pin ID: {campaign.pin_id}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => onRegenerate(campaign)}
                  disabled={generatingId === campaign.article_id}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium transition-all disabled:opacity-50"
                >
                  {generatingId === campaign.article_id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Regenerate
                </button>
                <button
                  onClick={() => onDelete(campaign.id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <label className="block text-xs font-medium text-slate-400 mb-2">Arabic Title</label>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              dir="rtl"
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none resize-none"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif", lineHeight: "1.6" }}
            />
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <label className="block text-xs font-medium text-slate-400 mb-2">Arabic Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              dir="rtl"
              rows={8}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none resize-none"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif", lineHeight: "1.6" }}
            />
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-slate-400">Viral Hashtags</label>
              <span className="text-xs text-slate-500">{hashtags.length} selected</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {VIRAL_HASHTAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleHashtag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    hashtags.includes(tag)
                      ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Changes
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-all"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => onPublish(campaign)}
              disabled={publishingId === campaign.id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20"
            >
              {publishingId === campaign.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Publish to Pinterest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Settings View ──────────────────────────────────────────────────────

function SettingsView({
  settings,
  onSave,
}: {
  settings: Settings | null;
  onSave: (s: Partial<Settings>) => void;
}) {
  const [token, setToken] = useState(settings?.pinterest_access_token || "");
  const [boardId, setBoardId] = useState(settings?.pinterest_board_id || "");
  const [username, setUsername] = useState(settings?.pinterest_username || "");
  const [websiteUrl, setWebsiteUrl] = useState(settings?.website_url || "https://gamecastle.store");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        pinterest_access_token: token,
        pinterest_board_id: boardId,
        pinterest_username: username,
        website_url: websiteUrl,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Settings</h2>
        <p className="text-slate-400 text-sm">Configure your Pinterest API credentials and website</p>
      </header>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-5">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            Website URL
          </label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://gamecastle.store"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none"
          />
          <p className="text-xs text-slate-500 mt-1.5">The website to fetch articles from</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Pinterest Access Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your Pinterest API access token"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none"
          />
          <p className="text-xs text-slate-500 mt-1.5">
            Get this from the Pinterest Developer portal under your app settings
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Pinterest Board ID
          </label>
          <input
            type="text"
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            placeholder="e.g. 1234567890123456789"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none"
          />
          <p className="text-xs text-slate-500 mt-1.5">
            The numeric ID of the Pinterest board where pins will be published
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Pinterest Username (optional)
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_pinterest_username"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Save Settings
        </button>
      </div>

      <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-400 mb-1">How to get Pinterest API credentials</h4>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
              <li>Go to developers.pinterest.com and create an app</li>
              <li>Generate an access token with pins:write and boards:read scopes</li>
              <li>Find your board ID in the board URL or via the API</li>
              <li>Paste both values above and save</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
