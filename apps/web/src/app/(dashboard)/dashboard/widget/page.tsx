"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { apiFetch } from "@/lib/api";
import {
  Sliders,
  Bot,
  Palette,
  MessageSquare,
  Code,
  Copy,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Globe,
  Image as ImageIcon,
  Tag,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Compass,
  MessageCircle,
  Zap,
} from "lucide-react";

interface ContentCard {
  title: string;
  description: string;
  icon_name?: string;
}

export default function WidgetSetupPage() {
  const { selectedWorkspace, workspaces } = useSelector((state: RootState) => state.auth);
  const activeWs = selectedWorkspace || (workspaces.length > 0 ? workspaces[0] : null);

  const [form, setForm] = useState<{
    brand_name: string;
    tagline: string;
    logo_url: string;
    primary_color: string;
    greeting_message: string;
    content_cards_json: ContentCard[];
  }>({
    brand_name: "SupportAI",
    tagline: "24/7 AI Customer Assistant",
    logo_url: "",
    primary_color: "#D4AF37",
    greeting_message: "Hello! How can our AI assistant help you today?",
    content_cards_json: [
      {
        title: "Track Order Status",
        description: "Check delivery progress and tracking links",
        icon_name: "Sparkles",
      },
      {
        title: "Billing & Subscriptions",
        description: "Invoices, payment methods, and plan changes",
        icon_name: "Zap",
      },
    ],
  });

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load initial widget config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const data = await apiFetch("/widget/config");
        if (data) {
          setForm({
            brand_name: data.brand_name || "SupportAI",
            tagline: data.tagline || "",
            logo_url: data.logo_url || "",
            primary_color: data.primary_color || "#D4AF37",
            greeting_message: data.greeting_message || "Hello! How can our AI assistant help you today?",
            content_cards_json: Array.isArray(data.content_cards_json) && data.content_cards_json.length > 0
              ? data.content_cards_json
              : [],
          });
        }
      } catch (err: any) {
        console.error("Failed to load widget config:", err);
      } finally {
        setInitialLoaded(true);
      }
    }
    loadConfig();
  }, []);

  // 2. Debounced Autosave on form changes (800ms)
  const saveConfig = useCallback(
    async (updatedForm: typeof form) => {
      setSaveStatus("saving");
      setErrorMessage(null);
      try {
        await apiFetch("/widget/config", {
          method: "PATCH",
          body: JSON.stringify(updatedForm),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } catch (err: any) {
        setSaveStatus("error");
        setErrorMessage(err.message || "Failed to save customization.");
      }
    },
    []
  );

  const handleFormChange = (field: keyof typeof form, value: any) => {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);

    if (!initialLoaded) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSaveStatus("saving");
    debounceTimerRef.current = setTimeout(() => {
      saveConfig(nextForm);
    }, 800);
  };

  // Card Management
  const handleAddCard = () => {
    if (form.content_cards_json.length >= 4) return;
    const newCards = [
      ...form.content_cards_json,
      {
        title: "New Quick Action",
        description: "Describe what this topic covers",
        icon_name: "Sparkles",
      },
    ];
    handleFormChange("content_cards_json", newCards);
  };

  const handleUpdateCard = (index: number, field: keyof ContentCard, val: string) => {
    const updated = form.content_cards_json.map((c, i) =>
      i === index ? { ...c, [field]: val } : c
    );
    handleFormChange("content_cards_json", updated);
  };

  const handleRemoveCard = (index: number) => {
    const updated = form.content_cards_json.filter((_, i) => i !== index);
    handleFormChange("content_cards_json", updated);
  };

  type PlatformType = "html" | "react" | "nextjs" | "other";

  const PLATFORMS: { id: PlatformType; label: string }[] = [
    { id: "html", label: "HTML" },
    { id: "react", label: "React" },
    { id: "nextjs", label: "Next.js" },
    { id: "other", label: "Other Stacks" },
  ];

  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>("html");
  const [snippetsCache, setSnippetsCache] = useState<Record<string, { snippet_code: string; instructions: string }>>({});
  const [loadingSnippet, setLoadingSnippet] = useState(false);

  const fetchSnippetForPlatform = useCallback(async (platform: PlatformType) => {
    if (snippetsCache[platform]) return;
    setLoadingSnippet(true);
    try {
      const data = await apiFetch(`/integrations/snippet?platform=${platform}`);
      if (data && data.snippet_code) {
        setSnippetsCache((prev) => ({
          ...prev,
          [platform]: {
            snippet_code: data.snippet_code,
            instructions: data.instructions || "Paste this script tag directly into your website before the closing </body> tag.",
          },
        }));
      }
    } catch (err) {
      console.error("Failed to fetch snippet for platform:", platform);
    } finally {
      setLoadingSnippet(false);
    }
  }, [snippetsCache]);

  useEffect(() => {
    fetchSnippetForPlatform(selectedPlatform);
  }, [selectedPlatform, fetchSnippetForPlatform]);

  const embedUuid = activeWs?.workspace_uuid || activeWs?.id || "";
  const currentSnippetData = snippetsCache[selectedPlatform] || {
    snippet_code: `<!-- SupportAI Live Chat Widget -->\n<script\n  src="http://localhost:8000/widget/loader.js"\n  data-workspace-id="${embedUuid}"\n  async\n  defer\n></script>`,
    instructions: "Paste this script tag directly into your website HTML file right before the closing </body> tag.",
  };

  const handleCopySnippet = () => {
    const textToCopy = currentSnippetData.snippet_code;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [previewInputText, setPreviewInputText] = useState("");
  const [previewMessages, setPreviewMessages] = useState<{ sender: "user" | "bot"; content: string }[]>([]);
  const [previewSending, setPreviewSending] = useState(false);
  const [previewConvId, setPreviewConvId] = useState<string | null>(null);
  const previewChatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (previewChatRef.current) {
      previewChatRef.current.scrollTop = previewChatRef.current.scrollHeight;
    }
  }, [previewMessages, previewSending]);

  // Live stream incoming AI and human operator replies into preview chat
  useEffect(() => {
    if (!previewConvId || !embedUuid) return;
    const interval = setInterval(async () => {
      try {
        const msgs = await apiFetch(`/public/${embedUuid}/conversations/${previewConvId}/messages`);
        if (Array.isArray(msgs)) {
          const formatted = msgs.map((m: any) => ({
            sender: (m.sender_type === "visitor" ? "user" : "bot") as "user" | "bot",
            content: m.content,
          }));
          setPreviewMessages(formatted);
          const hasAiResponse = msgs.some((m: any) => m.sender_type === "ai" || m.sender_type === "agent");
          if (hasAiResponse) {
            setPreviewSending(false);
          }
        }
      } catch (e) {}
    }, 1500);
    return () => clearInterval(interval);
  }, [previewConvId, embedUuid]);

  const handleResetPreviewChat = () => {
    setPreviewConvId(null);
    setPreviewMessages([]);
    setPreviewSending(false);
  };

  const handleSendPreviewMessage = async (overrideText?: string) => {
    const textToSend = overrideText || previewInputText.trim();
    if (!textToSend || previewSending) return;

    if (!overrideText) setPreviewInputText("");
    setPreviewSending(true);

    try {
      const visitorId = "preview_visitor_" + Date.now();
      const convRes = await apiFetch(`/public/${embedUuid}/conversations`, {
        method: "POST",
        body: JSON.stringify({ visitor_id: visitorId }),
      });
      if (convRes && convRes.conversation_id) {
        const convId = convRes.conversation_id;
        setPreviewConvId(convId);
        await apiFetch(`/public/${embedUuid}/conversations/${convId}/messages`, {
          method: "POST",
          body: JSON.stringify({ visitor_id: visitorId, content: textToSend }),
        });
      }
    } catch (err: any) {
      setPreviewSending(false);
      setPreviewMessages((prev) => [
        ...prev,
        { sender: "bot", content: "Sorry, I had trouble processing that request." },
      ]);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Page Header & Status Bar */}
      <div className="pb-4 border-b border-[#1F1F1F] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Sliders className="h-6 w-6 text-[#D4AF37]" />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Floating Chat Widget Customization
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Customize your live widget branding, themes, greeting message, and embed script.
          </p>
        </div>

        {/* Autosave Indicator */}
        <div className="flex items-center space-x-2 bg-[#111111] border border-[#222222] px-3.5 py-1.5 rounded-full text-xs font-semibold">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 text-[#D4AF37] animate-spin" />
              <span className="text-[#D4AF37]">Saving changes...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">All changes saved</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
              <span className="text-rose-400">{errorMessage || "Save failed"}</span>
            </>
          )}
          {saveStatus === "idle" && (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-neutral-400">Autosave active</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Brand & Theme */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-5 shadow-lg">
            <div className="flex items-center space-x-2 pb-3 border-b border-[#1A1A1A]">
              <Palette className="h-5 w-5 text-[#D4AF37]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                1. Brand Identity & Theme
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Brand Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300 flex items-center space-x-1.5">
                  <Bot className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>Brand Name</span>
                </label>
                <input
                  type="text"
                  value={form.brand_name}
                  onChange={(e) => handleFormChange("brand_name", e.target.value)}
                  placeholder="e.g. Acme Support AI"
                  className="w-full bg-[#080808] border border-[#262626] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37] transition-all"
                />
              </div>

              {/* Tagline */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300 flex items-center space-x-1.5">
                  <Tag className="h-3.5 w-3.5 text-neutral-400" />
                  <span>Tagline</span>
                </label>
                <input
                  type="text"
                  value={form.tagline}
                  onChange={(e) => handleFormChange("tagline", e.target.value)}
                  placeholder="e.g. 24/7 Customer Care"
                  className="w-full bg-[#080808] border border-[#262626] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37] transition-all"
                />
              </div>
            </div>

            {/* Logo URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300 flex items-center space-x-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-neutral-400" />
                <span>Company Logo Image URL</span>
              </label>
              <input
                type="text"
                value={form.logo_url}
                onChange={(e) => handleFormChange("logo_url", e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full bg-[#080808] border border-[#262626] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37] transition-all"
              />
              <p className="text-[11px] text-neutral-500">
                Direct HTTPS image URL for your company header logo.
              </p>
            </div>

            {/* Primary Color Picker + Hex Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300 flex items-center space-x-1.5">
                <Palette className="h-3.5 w-3.5 text-neutral-400" />
                <span>Primary Accent Color</span>
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={form.primary_color.startsWith("#") ? form.primary_color : "#D4AF37"}
                  onChange={(e) => handleFormChange("primary_color", e.target.value)}
                  className="h-10 w-12 bg-transparent border-0 cursor-pointer rounded-lg overflow-hidden"
                />
                <input
                  type="text"
                  value={form.primary_color}
                  onChange={(e) => handleFormChange("primary_color", e.target.value)}
                  placeholder="#D4AF37"
                  className="w-36 bg-[#080808] border border-[#262626] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37] transition-all uppercase"
                />
                <div
                  className="h-8 w-8 rounded-lg border border-white/10 shadow-inner flex items-center justify-center"
                  style={{ backgroundColor: form.primary_color }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Messages & Welcome */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-5 shadow-lg">
            <div className="flex items-center space-x-2 pb-3 border-b border-[#1A1A1A]">
              <MessageSquare className="h-5 w-5 text-[#D4AF37]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                2. Greeting & Welcome Message
              </h2>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300 flex items-center justify-between">
                <span>Greeting Message</span>
                <span className="text-[10px] text-neutral-500">
                  {form.greeting_message.length} / 300 chars
                </span>
              </label>
              <textarea
                rows={3}
                maxLength={300}
                value={form.greeting_message}
                onChange={(e) => handleFormChange("greeting_message", e.target.value)}
                placeholder="Hello! How can our AI assistant help you today?"
                className="w-full bg-[#080808] border border-[#262626] rounded-xl p-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#D4AF37] transition-all resize-none"
              />
              <p className="text-[11px] text-neutral-500">
                This is the initial speech bubble message shown when visitors open your widget.
              </p>
            </div>
          </div>

          {/* Section 3: Content Cards */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-[#D4AF37]" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  3. Quick Action Content Cards
                </h2>
              </div>
              <button
                type="button"
                onClick={handleAddCard}
                disabled={form.content_cards_json.length >= 4}
                className="px-3 py-1.5 rounded-xl bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 disabled:opacity-40 text-[#D4AF37] text-xs font-bold transition-all flex items-center space-x-1 border border-[#D4AF37]/20"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Card ({form.content_cards_json.length}/4)</span>
              </button>
            </div>

            {form.content_cards_json.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-[#262626] rounded-xl text-neutral-500 text-xs">
                No quick suggestion cards configured. Click "Add Card" to create prompt shortcuts.
              </div>
            ) : (
              <div className="space-y-4">
                {form.content_cards_json.map((card, idx) => (
                  <div
                    key={idx}
                    className="bg-[#080808] border border-[#222222] rounded-xl p-4 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
                        Card #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCard(idx)}
                        className="text-neutral-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-all"
                        title="Remove Card"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        maxLength={60}
                        value={card.title}
                        onChange={(e) => handleUpdateCard(idx, "title", e.target.value)}
                        placeholder="Card Title (max 60 chars)"
                        className="bg-[#111111] border border-[#262626] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                      <input
                        type="text"
                        maxLength={120}
                        value={card.description}
                        onChange={(e) => handleUpdateCard(idx, "description", e.target.value)}
                        placeholder="Description (max 120 chars)"
                        className="bg-[#111111] border border-[#262626] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Embed HTML & Multi-Platform Snippet */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1A1A1A]">
              <div className="flex items-center space-x-2">
                <Code className="h-5 w-5 text-[#D4AF37]" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  4. Embed Script Snippet
                </h3>
              </div>

              {/* Platform Segmented Control Tabs */}
              <div className="flex items-center space-x-1 bg-[#080808] border border-[#222222] p-1 rounded-xl">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlatform(p.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedPlatform === p.id
                        ? "bg-[#D4AF37] text-black shadow-md"
                        : "text-neutral-400 hover:text-white hover:bg-[#141414]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* How it Works Explainer */}
            <div className="bg-[#080808] border border-[#222222] rounded-xl p-3.5 text-xs space-y-1.5">
              <div className="flex items-start space-x-2">
                <Sparkles className="h-4 w-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-white">How this embed script works:</p>
                  <p className="text-neutral-400 text-[11px] leading-tight">
                    • Loads the floating AI support chat bubble on your website.
                  </p>
                  <p className="text-neutral-400 text-[11px] leading-tight">
                    • <code className="text-[#D4AF37]">data-workspace-id</code> links the widget to your trained knowledge base, custom branding, and Live Inbox.
                  </p>
                </div>
              </div>
            </div>

            {/* Code Block Box with Copy Button */}
            <div className="bg-[#050505] border border-[#222222] rounded-xl p-4 relative group">
              {loadingSnippet ? (
                <div className="flex items-center justify-center py-6 text-xs text-[#D4AF37] space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading {selectedPlatform.toUpperCase()} snippet...</span>
                </div>
              ) : (
                <pre className="text-xs font-mono text-[#D4AF37] whitespace-pre-wrap overflow-x-auto pr-24 leading-relaxed">
                  {currentSnippetData.snippet_code}
                </pre>
              )}

              <button
                type="button"
                onClick={handleCopySnippet}
                className="absolute top-3 right-3 px-3.5 py-1.5 rounded-lg bg-[#141414] hover:bg-[#1A1A1A] text-xs font-bold text-neutral-300 hover:text-white transition-all flex items-center space-x-1.5 border border-[#262626]"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-neutral-400" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Instructions Below Code Block */}
            <div className="p-3.5 bg-[#080808] border border-[#222222] rounded-xl text-xs text-neutral-300 flex items-start space-x-2.5">
              <Compass className="h-4 w-4 text-[#D4AF37] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-white uppercase text-[10px] tracking-wider block">
                  Installation Instructions ({selectedPlatform.toUpperCase()})
                </span>
                <p className="text-neutral-400 leading-relaxed whitespace-pre-line text-xs">
                  {currentSnippetData.instructions}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Realtime Interactive Preview Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Compass className="h-4 w-4 text-[#D4AF37]" />
              <span>Realtime Live Widget Preview</span>
            </h3>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium border border-emerald-500/20">
              Live Reactivity
            </span>
          </div>

          {/* Widget Phone/Window Frame Simulation */}
          <div className="bg-[#080808] border border-[#262626] rounded-3xl p-4 shadow-2xl space-y-4 relative min-h-[540px] flex flex-col justify-between overflow-hidden">
            {/* Background Simulated Page */}
            <div className="space-y-3 opacity-30 select-none pointer-events-none p-2">
              <div className="h-4 w-32 bg-neutral-700 rounded-md" />
              <div className="h-24 w-full bg-neutral-800/60 rounded-xl" />
              <div className="space-y-1.5">
                <div className="h-3 w-3/4 bg-neutral-700 rounded" />
                <div className="h-3 w-1/2 bg-neutral-700 rounded" />
              </div>
            </div>

            {/* Floating Simulated Chat Dialog Box */}
            <div className="bg-[#111111] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[420px] z-10 animate-in slide-in-from-bottom-4 duration-300">
              {/* Header with Dynamic Primary Color */}
              <div
                style={{ backgroundColor: form.primary_color || "#D4AF37" }}
                className="p-4 text-black flex items-center justify-between transition-colors duration-300"
              >
                <div className="flex items-center space-x-3">
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt="Brand Logo"
                      className="h-8 w-8 rounded-full object-cover bg-black/10 border border-black/20"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-black/10 border border-black/20 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-black" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-extrabold text-sm leading-tight text-black">
                      {form.brand_name || "SupportAI"}
                    </h4>
                    {form.tagline && (
                      <p className="text-[10px] font-medium text-black/70 leading-none mt-0.5">
                        {form.tagline}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {previewMessages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleResetPreviewChat}
                      className="text-[10px] font-bold bg-black/20 hover:bg-black/30 px-2 py-0.5 rounded text-black transition-all"
                      title="Reset Preview Conversation"
                    >
                      Reset Chat
                    </button>
                  )}
                  <div className="h-2 w-2 rounded-full bg-emerald-700 animate-pulse" title="Online" />
                </div>
              </div>

              {/* Chat Body & Messages */}
              <div ref={previewChatRef} className="p-4 flex-1 space-y-3 overflow-y-auto overflow-x-hidden bg-[#0A0A0A] break-words">
                {/* Greeting Bubble */}
                <div className="flex items-start space-x-2">
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-black text-[10px] font-bold shrink-0 mt-0.5"
                    style={{ backgroundColor: form.primary_color || "#D4AF37" }}
                  >
                    AI
                  </div>
                  <div className="bg-[#161616] border border-[#262626] rounded-2xl rounded-tl-sm p-3 text-xs text-neutral-200 shadow-md max-w-[85%] leading-relaxed break-words whitespace-pre-wrap overflow-hidden">
                    {form.greeting_message || "Hello! How can our AI assistant help you today?"}
                  </div>
                </div>

                {/* Render Interactive Messages */}
                {previewMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start space-x-2 ${
                      msg.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.sender === "bot" && (
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center text-black text-[10px] font-bold shrink-0 mt-0.5"
                        style={{ backgroundColor: form.primary_color || "#D4AF37" }}
                      >
                        AI
                      </div>
                    )}
                    <div
                      className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed shadow-md break-words whitespace-pre-wrap overflow-hidden ${
                        msg.sender === "user"
                          ? "bg-[#1C1C1C] border border-[#2A2A2A] text-white rounded-tr-sm"
                          : "bg-[#161616] border border-[#262626] text-neutral-200 rounded-tl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {previewSending && (
                  <div className="flex items-start space-x-2">
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center text-black text-[10px] font-bold shrink-0 mt-0.5"
                      style={{ backgroundColor: form.primary_color || "#D4AF37" }}
                    >
                      AI
                    </div>
                    <div className="bg-[#161616] border border-[#262626] rounded-2xl rounded-tl-sm p-3 text-xs text-neutral-400 italic flex items-center space-x-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D4AF37]" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                )}

                {/* Render Content Cards Preview */}
                {form.content_cards_json.length > 0 && previewMessages.length === 0 && (
                  <div className="pt-2 space-y-2">
                    <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider px-1">
                      Quick Suggestions
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {form.content_cards_json.map((card, cIdx) => (
                        <div
                          key={cIdx}
                          onClick={() => handleSendPreviewMessage(card.title)}
                          className="bg-[#141414] hover:bg-[#1A1A1A] border border-[#242424] rounded-xl p-2.5 text-left transition-all cursor-pointer group"
                        >
                          <div className="flex items-center space-x-2">
                            <Sparkles className="h-3.5 w-3.5 text-[#D4AF37] shrink-0" />
                            <span className="text-xs font-bold text-neutral-200 group-hover:text-white">
                              {card.title || "Quick Topic"}
                            </span>
                          </div>
                          {card.description && (
                            <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                              {card.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Placeholder */}
              <div className="p-3 border-t border-[#1F1F1F] bg-[#0F0F0F] flex items-center space-x-2">
                <input
                  type="text"
                  value={previewInputText}
                  onChange={(e) => setPreviewInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendPreviewMessage();
                  }}
                  placeholder="Type your message..."
                  className="w-full bg-[#181818] border border-[#282828] rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="button"
                  onClick={() => handleSendPreviewMessage()}
                  disabled={previewSending || !previewInputText.trim()}
                  style={{ backgroundColor: form.primary_color || "#D4AF37" }}
                  className="p-2 rounded-xl text-black cursor-pointer hover:brightness-110 disabled:opacity-40 transition-all shrink-0"
                >
                  {previewSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Launcher Bubble in Corner */}
            <div className="flex justify-end pt-2 z-10">
              <div
                style={{ backgroundColor: form.primary_color || "#D4AF37" }}
                className="h-12 w-12 rounded-full shadow-2xl flex items-center justify-center text-black cursor-pointer hover:scale-105 transition-all"
              >
                <MessageCircle className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
