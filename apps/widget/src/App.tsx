import React, { useState, useEffect, useRef } from "react";

export default function App() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [config, setConfig] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const apiBase = "http://localhost:8000";
  // Default demo workspace UUID for test simulator
  const workspaceUuid = "1b219347-e065-45ba-9f63-cfbe8c6d8e09";

  useEffect(() => {
    // 1. Fetch public widget config
    fetch(`${apiBase}/public/widget-config?workspace_id=${workspaceUuid}`)
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setConfig(data);
          if (data.greeting_message) {
            setMessages([{ id: "msg_greet", sender_type: "ai", content: data.greeting_message }]);
          }
        }
      })
      .catch(() => {});

    // 2. Create or reuse conversation
    fetch(`${apiBase}/public/${workspaceUuid}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: "visitor_sim_123" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.conversation_id) {
          setConversationId(data.conversation_id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputValue.trim();
    if (!text || !conversationId || loading) return;

    const userMsg = { id: `user_${Date.now()}`, sender_type: "visitor", content: text };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue("");
    setLoading(true);

    try {
      const res = await fetch(
        `${apiBase}/public/${workspaceUuid}/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitor_id: "visitor_sim_123", content: text }),
        }
      );
      const data = await res.json();
      if (data && data.content) {
        setMessages((prev) => [
          ...prev,
          { id: data.id || `ai_${Date.now()}`, sender_type: data.sender_type || "ai", content: data.content },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: `err_${Date.now()}`, sender_type: "ai", content: "Sorry, I ran into a connection issue." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const primaryColor = config?.primary_color || "#D4AF37";

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999999, fontFamily: "sans-serif" }}>
      {open && (
        <div
          style={{
            width: 360,
            height: 520,
            backgroundColor: "#0A0A0A",
            color: "#FFFFFF",
            border: "1px solid #222222",
            borderRadius: 16,
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5)",
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: primaryColor,
              color: "#000000",
              padding: "14px 16px",
              fontWeight: 800,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 14 }}>{config?.brand_name || "SupportAI Assistant"}</div>
              <div style={{ fontSize: 10, opacity: 0.85, fontWeight: 400 }}>{config?.tagline || "Instant AI Support"}</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, fontWeight: "bold" }}
            >
              ✕
            </button>
          </div>

          {/* Body Messages */}
          <div
            ref={bodyRef}
            style={{
              flex: 1,
              padding: 14,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              backgroundColor: "#050505",
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontSize: 13,
                  lineHeight: 1.4,
                  alignSelf: m.sender_type === "visitor" ? "flex-end" : "flex-start",
                  backgroundColor: m.sender_type === "visitor" ? "#1C1C1C" : "#141414",
                  color: m.sender_type === "visitor" ? "#FFFFFF" : "#E0E0E0",
                  border: m.sender_type === "visitor" ? "none" : "1px solid #222222",
                }}
              >
                {m.content}
              </div>
            ))}

            {loading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: "#141414",
                  color: "#A0A0A0",
                  padding: "8px 12px",
                  borderRadius: 12,
                  fontSize: 12,
                  border: "1px solid #222222",
                }}
              >
                AI is thinking...
              </div>
            )}
          </div>

          {/* Footer Input */}
          <div
            style={{
              padding: 10,
              borderTop: "1px solid #1F1F1F",
              backgroundColor: "#0A0A0A",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask a question..."
              style={{
                flex: 1,
                backgroundColor: "#141414",
                border: "1px solid #262626",
                color: "#FFFFFF",
                padding: "8px 12px",
                borderRadius: 10,
                fontSize: 12,
                outline: "none",
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !inputValue.trim()}
              style={{
                backgroundColor: primaryColor,
                color: "#000000",
                border: "none",
                padding: "8px 14px",
                borderRadius: 10,
                fontWeight: 800,
                cursor: "pointer",
                fontSize: 12,
                opacity: loading || !inputValue.trim() ? 0.6 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: primaryColor,
          color: "#000000",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: "bold",
        }}
      >
        💬
      </button>
    </div>
  );
}

