"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { apiFetch } from "@/lib/api";
import { Palette, MessageSquare, Sparkles, Plus, Trash2, ArrowUp, ArrowDown, Save, CheckCircle2, AlertTriangle, Bot, Send } from "lucide-react";

export default function WidgetCustomizationPage() {
  const { selectedWorkspace, workspaces } = useSelector((state: RootState) => state.auth);
  const activeWs = selectedWorkspace || (workspaces && workspaces.length > 0 ? workspaces[0] : null);

  const [brandName, setBrandName] = useState("SupportAI");
  const [tagline, setTagline] = useState("Instant AI Customer Assistant");
  const [primaryColor, setPrimaryColor] = useState("#D4AF37");
  const [greetingMessage, setGreetingMessage] = useState("Hello! How can we assist you today?");
  const [cards, setCards] = useState<any[]>([]);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  // 1. Seed form from GET /widget/config on mount
  useEffect(() => {
    if (!activeWs?.id) return;
    async function loadConfig() {
      try {
        const config = await apiFetch("/widget/config", {
          headers: { "X-Workspace-Id": activeWs.id },
        });
        if (config) {
          setBrandName(config.brand_name || activeWs.name || "SupportAI");
          setTagline(config.tagline || "Instant AI Customer Assistant");
          setPrimaryColor(config.primary_color || "#D4AF37");
          setGreetingMessage(config.greeting_message || "");
          setCards(config.content_cards_json || []);
        }
      } catch (e) {}
    }
    loadConfig();
  }, [activeWs?.id]);

  // 2. STEP 4: Debounced Autosave (Approach a - Full Form State per Request)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!activeWs?.id) return;

    // Validation checks before autosaving
    if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
      setErrorMsg("Hex color must be valid 6-digit format (#RRGGBB)");
      return;
    }
    if (greetingMessage.length > 300) {
      setErrorMsg("Greeting message cannot exceed 300 characters.");
      return;
    }

    setErrorMsg(null);
    setSaveStatus("saving");

    const timer = setTimeout(async () => {
      try {
        await apiFetch("/widget/config", {
          method: "PATCH",
          headers: { "X-Workspace-Id": activeWs.id },
          body: JSON.stringify({
            brand_name: brandName,
            tagline: tagline,
            primary_color: primaryColor,
            greeting_message: greetingMessage,
            content_cards_json: cards,
          }),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err: any) {
        setSaveStatus("error");
        setErrorMsg(err.message || "Failed to autosave widget config.");
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [brandName, tagline, primaryColor, greetingMessage, cards, activeWs?.id]);

  // STEP 5: Content Cards Management (Up/Down Arrow Pair)
  const handleAddCard = () => {
    if (cards.length >= 4) return;
    setCards([
      ...cards,
      { title: "Track Order", description: "Check current shipping status", icon_name: "Sparkles" },
    ]);
  };

  const handleUpdateCard = (index: number, field: string, val: string) => {
    const updated = [...cards];
    updated[index][field] = val;
    setCards(updated);
  };

  const handleMoveCard = (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === cards.length - 1)) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const updated = [...cards];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setCards(updated);
  };

  const handleRemoveCard = (index: number) => {
    setCards(cards.filter((_, i) => i !== index));
  };

  return (
    <div className="p-8 bg-[#050505] min-h-screen text-white space-y-8">
      {/* Header with Autosave Status */}
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold flex items-center space-x-2">
            <Palette className="h-6 w-6 text-[#D4AF37]" />
            <span>Chat Widget Customization</span>
          </h1>
          <p className="text-xs text-neutral-400">
            Customize widget branding, primary accent colors, greeting prompts, and quick action cards.
          </p>
        </div>

        {/* Autosave Status Badge */}
        <div className="px-3.5 py-1.5 rounded-full bg-[#111111] border border-[#222222] text-xs font-bold flex items-center space-x-2">
          {saveStatus === "saving" && (
            <>
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-amber-400">Autosaving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400">Saved</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-red-400">Save Error</span>
            </>
          )}
          {saveStatus === "idle" && <span className="text-neutral-500">All changes saved</span>}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid Layout: Form vs Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 7 Columns: Customization Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* Branding Section */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-neutral-200">Brand Identity</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-neutral-300">Brand Name</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300">Tagline / Subtitle</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              {/* Color Picker with Hex Text Input Fallback */}
              <div>
                <label className="text-xs font-bold text-neutral-300">Primary Brand Accent Color</label>
                <div className="flex space-x-3 items-center pt-1">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-10 rounded-xl cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-36 px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs font-mono text-white focus:border-[#D4AF37] focus:outline-none uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Greeting Section */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-neutral-200">Initial Greeting Message</h3>
            <textarea
              rows={3}
              value={greetingMessage}
              onChange={(e) => setGreetingMessage(e.target.value)}
              placeholder="Hello! How can we assist you today?"
              className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white focus:border-[#D4AF37] focus:outline-none"
            />
            <div className="text-right text-[10px] text-neutral-500 font-mono">
              {greetingMessage.length} / 300 chars
            </div>
          </div>

          {/* Content Cards Editor */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-neutral-200">Quick Content Cards (Max 4)</h3>
              <button
                type="button"
                onClick={handleAddCard}
                disabled={cards.length >= 4}
                title={cards.length >= 4 ? "Maximum limit of 4 cards reached" : "Add Content Card"}
                className="px-3 py-1.5 bg-[#D4AF37] disabled:opacity-50 text-black font-extrabold text-xs rounded-xl flex items-center space-x-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Card</span>
              </button>
            </div>

            <div className="space-y-3">
              {cards.map((card, idx) => (
                <div key={idx} className="p-4 bg-[#080808] border border-[#1C1C1C] rounded-xl space-y-2 relative">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-[#D4AF37]">Card #{idx + 1}</span>
                    <div className="flex space-x-1">
                      <button
                        type="button"
                        onClick={() => handleMoveCard(idx, "up")}
                        disabled={idx === 0}
                        className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveCard(idx, "down")}
                        disabled={idx === cards.length - 1}
                        className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveCard(idx)}
                        className="p-1 text-red-400 hover:text-red-300 ml-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Card Title"
                    value={card.title}
                    onChange={(e) => handleUpdateCard(idx, "title", e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111111] border border-[#222222] text-xs text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Card Description"
                    value={card.description}
                    onChange={(e) => handleUpdateCard(idx, "description", e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111111] border border-[#222222] text-xs text-neutral-300 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Interactive Live Widget Preview Bubble */}
        <div className="lg:col-span-5 flex flex-col justify-start">
          <div className="sticky top-8 bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-neutral-200 flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-[#D4AF37]" />
              <span>Live Interactive Widget Preview</span>
            </h3>

            {/* Mock Chat Window */}
            <div className="w-full bg-[#050505] border border-[#222222] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[480px]">
              {/* Header */}
              <div
                style={{ backgroundColor: primaryColor }}
                className="p-4 text-black font-extrabold flex items-center justify-between shadow-md"
              >
                <div className="flex items-center space-x-2">
                  <Bot className="h-5 w-5" />
                  <div>
                    <div className="text-xs font-black leading-tight">{brandName}</div>
                    <div className="text-[10px] opacity-80 font-normal">{tagline}</div>
                  </div>
                </div>
              </div>

              {/* Chat Content Body */}
              <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                {/* Bot Greeting Bubble */}
                {greetingMessage && (
                  <div className="flex items-start space-x-2">
                    <div
                      style={{ backgroundColor: primaryColor }}
                      className="h-6 w-6 rounded-full flex items-center justify-center text-black shrink-0 text-xs font-bold"
                    >
                      AI
                    </div>
                    <div className="p-3 bg-[#161616] border border-[#262626] rounded-2xl rounded-tl-none text-xs text-neutral-200 max-w-[80%] leading-relaxed shadow">
                      {greetingMessage}
                    </div>
                  </div>
                )}

                {/* Content Cards Grid */}
                {cards.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 pt-2">
                    {cards.map((card, cIdx) => (
                      <div
                        key={cIdx}
                        className="p-2.5 bg-[#111111] hover:bg-[#1A1A1A] border border-[#222222] rounded-xl cursor-pointer transition-all space-y-0.5"
                      >
                        <div className="text-xs font-bold text-white flex items-center space-x-1">
                          <Sparkles className="h-3 w-3 text-[#D4AF37]" />
                          <span>{card.title}</span>
                        </div>
                        <p className="text-[10px] text-neutral-400 truncate">{card.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Input Footer */}
              <div className="p-3 bg-[#0D0D0D] border-t border-[#1C1C1C] flex space-x-2">
                <input
                  disabled
                  placeholder="Ask a question..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#161616] border border-[#262626] text-xs text-neutral-400 placeholder-neutral-600 focus:outline-none"
                />
                <button
                  disabled
                  style={{ backgroundColor: primaryColor }}
                  className="p-2 rounded-xl text-black font-bold shrink-0 opacity-80"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
