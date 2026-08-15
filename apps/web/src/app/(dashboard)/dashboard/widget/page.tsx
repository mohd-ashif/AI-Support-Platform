"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useWidgetConfig, useUpdateWidgetConfigMutation } from "@/hooks/queries/useWidgetQueries";
import { integrationService } from "@/services/integrationService";
import { useToast } from "@/components/ui/ToastProvider";
import { WidgetSetupSkeleton } from "@/components/ui/WidgetSetupSkeleton";

// Modular Components
import { WidgetSetupHeader, SaveStatusType } from "@/components/widget-setup/WidgetSetupHeader";
import { WidgetSectionNav } from "@/components/widget-setup/WidgetSectionNav";
import { BrandIdentitySection } from "@/components/widget-setup/BrandIdentitySection";
import { GreetingSection } from "@/components/widget-setup/GreetingSection";
import { QuickActionsSection, ContentCard } from "@/components/widget-setup/QuickActionsSection";
import { InstallationSection } from "@/components/widget-setup/InstallationSection";
import { StickyLivePreview } from "@/components/widget-setup/StickyLivePreview";

const NAV_SECTIONS = [
  { id: "brand", label: "Brand & Theme" },
  { id: "greeting", label: "Greeting" },
  { id: "quick-actions", label: "Quick Actions" },
  { id: "installation", label: "Installation" },
];

export default function WidgetSetupPage() {
  const toast = useToast();
  const { selectedWorkspace, workspaces } = useSelector((state: RootState) => state.auth);
  const activeWs = selectedWorkspace || (workspaces.length > 0 ? workspaces[0] : null);
  const activeWsId = activeWs?.id;
  const embedUuid = activeWs?.embed_id || activeWs?.id || "";

  const { data: configData, isLoading: isConfigLoading } = useWidgetConfig(activeWsId);
  const updateConfigMutation = useUpdateWidgetConfigMutation(activeWsId);

  const [form, setForm] = useState<{
    brand_name: string;
    tagline: string;
    logo_url: string;
    primary_color: string;
    greeting_message: string;
    content_cards_json: ContentCard[];
  }>({
    brand_name: "",
    tagline: "",
    logo_url: "",
    primary_color: "#D4AF37",
    greeting_message: "",
    content_cards_json: [],
  });

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatusType>("idle");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Live Chat Preview States
  const [previewInputText, setPreviewInputText] = useState("");
  const [previewMessages, setPreviewMessages] = useState<{ sender: "user" | "bot"; content: string }[]>([]);
  const [previewSending, setPreviewSending] = useState(false);
  const [previewConvId, setPreviewConvId] = useState<string | null>(null);
  const [showNewMessagePill, setShowNewMessagePill] = useState(false);
  const previewChatRef = useRef<HTMLDivElement | null>(null);

  // 1. Sync configData into form on query load
  useEffect(() => {
    if (configData) {
      setForm({
        brand_name: configData.brand_name || activeWs?.business?.name || "SupportAI",
        tagline: configData.tagline || "24/7 AI Customer Assistant",
        logo_url: configData.logo_url || "",
        primary_color: configData.primary_color || "#D4AF37",
        greeting_message: configData.greeting_message || "Hello! How can our AI assistant help you today?",
        content_cards_json: Array.isArray(configData.content_cards_json) && configData.content_cards_json.length > 0
          ? configData.content_cards_json
          : [],
      });
      setInitialLoaded(true);
    }
  }, [configData, activeWs]);

  // 2. Quiet Debounced Autosave
  const saveConfig = useCallback(
    async (updatedForm: typeof form) => {
      setSaveStatus("saving");
      try {
        await updateConfigMutation.mutateAsync(updatedForm);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } catch (err: any) {
        setSaveStatus("error");
        toast.error(err.message || "Failed to save customization.");
      }
    },
    [updateConfigMutation, toast]
  );

  const handleFormChange = (field: keyof typeof form, value: any) => {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);

    if (!initialLoaded) return;

    setSaveStatus("dirty");
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      saveConfig(nextForm);
    }, 800);
  };

  // Card Management Handlers
  const handleAddCard = () => {
    if (form.content_cards_json.length >= 4) return;
    const newCards = [
      ...form.content_cards_json,
      {
        title: "New Quick Action",
        description: "Describe what this topic covers",
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

  // Auto-scroll logic for Live Preview
  const scrollToBottom = () => {
    if (previewChatRef.current) {
      previewChatRef.current.scrollTo({
        top: previewChatRef.current.scrollHeight,
        behavior: "smooth",
      });
      setShowNewMessagePill(false);
    }
  };

  const handleScroll = () => {
    if (!previewChatRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = previewChatRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 60;
    if (isNearBottom) {
      setShowNewMessagePill(false);
    }
  };

  useEffect(() => {
    if (previewChatRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = previewChatRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
      if (isNearBottom) {
        scrollToBottom();
      } else {
        setShowNewMessagePill(true);
      }
    }
  }, [previewMessages, previewSending]);

  // Live polling for preview messages
  useEffect(() => {
    if (!previewConvId || !embedUuid) return;
    let active = true;
    const interval = setInterval(async () => {
      try {
        const msgs = await integrationService.getPublicMessages(embedUuid, previewConvId);
        if (active && Array.isArray(msgs) && msgs.length > 0) {
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
    }, 1200);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [previewConvId, embedUuid]);

  const handleResetPreviewChat = () => {
    setPreviewConvId(null);
    setPreviewMessages([]);
    setPreviewSending(false);
    setPreviewInputText("");
  };

  const handleSendPreviewMessage = async (overrideText?: string) => {
    const textToSend = overrideText || previewInputText.trim();
    if (!textToSend || previewSending) return;

    setPreviewMessages((prev) => [...prev, { sender: "user", content: textToSend }]);
    if (!overrideText) setPreviewInputText("");
    setPreviewSending(true);

    try {
      let convId = previewConvId;
      const visitorId = "preview_visitor_" + Date.now();

      if (!convId) {
        const convRes = await integrationService.createPublicConversation(embedUuid, visitorId);
        if (convRes && convRes.conversation_id) {
          convId = convRes.conversation_id;
          setPreviewConvId(convId);
        }
      }

      if (convId) {
        await integrationService.sendPublicMessage(embedUuid, convId, visitorId, textToSend);
      }
    } catch (err: any) {
      setPreviewSending(false);
      setPreviewMessages((prev) => [
        ...prev,
        { sender: "bot", content: "Sorry, I had trouble processing that request." },
      ]);
    }
  };

  if (isConfigLoading && !initialLoaded && !configData) {
    return <WidgetSetupSkeleton />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Header & Status */}
      <WidgetSetupHeader
        saveStatus={saveStatus}
        onRetry={() => saveConfig(form)}
      />

      {/* Section Navigation Bar */}
      <WidgetSectionNav sections={NAV_SECTIONS} />

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Scrollable Form Sections */}
        <div className="lg:col-span-7 space-y-6">
          <BrandIdentitySection
            brandName={form.brand_name}
            tagline={form.tagline}
            logoUrl={form.logo_url}
            primaryColor={form.primary_color}
            onChange={handleFormChange}
          />

          <GreetingSection
            greetingMessage={form.greeting_message}
            onChange={(val) => handleFormChange("greeting_message", val)}
          />

          <QuickActionsSection
            cards={form.content_cards_json}
            onAddCard={handleAddCard}
            onUpdateCard={handleUpdateCard}
            onRemoveCard={handleRemoveCard}
          />

          <InstallationSection embedUuid={embedUuid} />
        </div>

        {/* Right Sticky Live Preview */}
        <div className="lg:col-span-5">
          <StickyLivePreview
            brandName={form.brand_name || activeWs?.business?.name || "SupportAI"}
            tagline={form.tagline || "24/7 AI Customer Assistant"}
            primaryColor={form.primary_color || "#D4AF37"}
            greetingMessage={form.greeting_message}
            contentCards={form.content_cards_json}
            previewMessages={previewMessages}
            previewSending={previewSending}
            previewInputText={previewInputText}
            setPreviewInputText={setPreviewInputText}
            onSendMessage={handleSendPreviewMessage}
            onResetChat={handleResetPreviewChat}
            onStopSending={() => setPreviewSending(false)}
            chatRef={previewChatRef}
            showNewMessagePill={showNewMessagePill}
            onScrollToBottom={scrollToBottom}
            onScroll={handleScroll}
          />
        </div>
      </div>
    </div>
  );
}
