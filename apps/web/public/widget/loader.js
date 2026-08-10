(function () {
  if (window.SupportAIWidgetLoaded) return;
  window.SupportAIWidgetLoaded = true;

  // 1. First-Party Cookie visitor_id Helper (SameSite=Lax, 1-year expiry)
  function getOrCreateVisitorId() {
    var name = "supportai_visitor_id=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(";");
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i].trim();
      if (c.indexOf(name) === 0) {
        return c.substring(name.length, c.length);
      }
    }
    var newId = "v_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
    var d = new Date();
    d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = "supportai_visitor_id=" + newId + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
    return newId;
  }

  var scriptTag = document.currentScript || document.querySelector("script[data-workspace-id]");
  var workspaceId = scriptTag ? scriptTag.getAttribute("data-workspace-id") : null;
  if (!workspaceId) {
    console.error("SupportAI Widget Error: Missing data-workspace-id attribute on script tag.");
    return;
  }

  var visitorId = getOrCreateVisitorId();
  var apiBaseUrl = scriptTag.src.split("/widget/loader.js")[0] || "http://localhost:8000";

  // Sanitize Markdown text output (Disables raw HTML / script execution)
  function sanitizeOutput(text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.innerText = text;
    return div.innerHTML.replace(/\n/g, "<br/>");
  }

  // Inject Stylesheet
  var style = document.createElement("style");
  style.innerHTML = `
    #supportai-widget-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; position: fixed; bottom: 20px; right: 20px; z-index: 999999; }
    #supportai-widget-button { width: 56px; height: 56px; border-radius: 28px; border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
    #supportai-widget-button:hover { transform: scale(1.05); }
    #supportai-widget-panel { display: none; width: 360px; height: 520px; background: #0A0A0A; color: #FFFFFF; border: 1px solid #222222; border-radius: 16px; box-shadow: 0 16px 40px rgba(0,0,0,0.4); flex-direction: column; overflow: hidden; position: absolute; bottom: 70px; right: 0; }
    #supportai-widget-panel.open { display: flex; }
    .supportai-header { padding: 14px 16px; color: #000000; font-weight: 800; display: flex; justify-content: space-between; align-items: center; }
    .supportai-body { flex: 1; padding: 14px; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 10px; background: #050505; word-wrap: break-word; }
    .supportai-msg { max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: pre-wrap; overflow: hidden; }
    .supportai-msg.user { background: #1C1C1C; color: #FFFFFF; align-self: flex-end; border-bottom-right-radius: 2px; }
    .supportai-msg.bot { background: #141414; color: #E0E0E0; border: 1px solid #222222; align-self: flex-start; border-bottom-left-radius: 2px; }
    .supportai-footer { padding: 10px; border-top: 1px solid #1F1F1F; background: #0A0A0A; display: flex; gap: 8px; }
    .supportai-input { flex: 1; background: #141414; border: 1px solid #262626; color: #FFFFFF; padding: 8px 12px; border-radius: 10px; font-size: 12px; outline: none; }
    .supportai-send { border: none; padding: 8px 14px; border-radius: 10px; font-weight: 800; cursor: pointer; font-size: 12px; }
    .supportai-card { background: #111111; border: 1px solid #222222; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 11px; margin-top: 4px; }
    .supportai-card:hover { border-color: #444444; }
  `;
  document.head.appendChild(style);

  // Widget Container
  var container = document.createElement("div");
  container.id = "supportai-widget-container";
  container.innerHTML = `
    <button id="supportai-widget-button" style="background:#D4AF37;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    </button>
    <div id="supportai-widget-panel">
      <div class="supportai-header" id="supportai-header" style="background:#D4AF37;">
        <div>
          <div id="supportai-brand" style="font-size:14px;">SupportAI</div>
          <div id="supportai-tagline" style="font-size:10px;opacity:0.85;font-weight:400;">Instant AI Assistant</div>
        </div>
        <button id="supportai-close" style="background:none;border:none;cursor:pointer;font-size:16px;font-weight:bold;">✕</button>
      </div>
      <div class="supportai-body" id="supportai-body"></div>
      <div class="supportai-footer">
        <input type="text" id="supportai-input" class="supportai-input" placeholder="Ask a question..." />
        <button id="supportai-send" class="supportai-send" style="background:#D4AF37;color:#000;">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  var btn = document.getElementById("supportai-widget-button");
  var panel = document.getElementById("supportai-widget-panel");
  var closeBtn = document.getElementById("supportai-close");
  var body = document.getElementById("supportai-body");
  var input = document.getElementById("supportai-input");
  var sendBtn = document.getElementById("supportai-send");

  var activeConversationId = null;
  var primaryColor = "#D4AF37";

  btn.onclick = function () {
    panel.classList.toggle("open");
    if (panel.classList.contains("open") && !activeConversationId) {
      initWidget();
    }
  };
  closeBtn.onclick = function () { panel.classList.remove("open"); };

  function initWidget() {
    fetch(apiBaseUrl + "/public/widget-config?workspace_id=" + workspaceId)
      .then(function (res) { return res.json(); })
      .then(function (cfg) {
        if (cfg) {
          primaryColor = cfg.primary_color || "#D4AF37";
          btn.style.backgroundColor = primaryColor;
          document.getElementById("supportai-header").style.backgroundColor = primaryColor;
          sendBtn.style.backgroundColor = primaryColor;
          if (cfg.brand_name) document.getElementById("supportai-brand").innerText = cfg.brand_name;
          if (cfg.tagline) document.getElementById("supportai-tagline").innerText = cfg.tagline;

          if (cfg.greeting_message) {
            appendMessage("bot", cfg.greeting_message);
          }
          if (cfg.content_cards_json && cfg.content_cards_json.length > 0) {
            cfg.content_cards_json.forEach(function (card) {
              var cardEl = document.createElement("div");
              cardEl.className = "supportai-card";
              cardEl.innerHTML = "<strong>" + sanitizeOutput(card.title) + "</strong><br/>" + sanitizeOutput(card.description);
              cardEl.onclick = function () { sendMessage(card.title); };
              body.appendChild(cardEl);
            });
          }
        }
        createConversation();
      })
      .catch(function () {
        createConversation();
      });
  }

  function createConversation() {
    fetch(apiBaseUrl + "/public/" + workspaceId + "/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: visitorId }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.conversation_id) {
          activeConversationId = data.conversation_id;
        }
      });
  }

  function appendMessage(sender, text) {
    var msgEl = document.createElement("div");
    msgEl.className = "supportai-msg " + (sender === "user" ? "user" : "bot");
    msgEl.innerHTML = sanitizeOutput(text);
    body.appendChild(msgEl);
    body.scrollTop = body.scrollHeight;
  }

  var socketClient = null;
  var socketConnected = false;

  function initRealtimeSocket() {
    if (socketClient || !activeConversationId) return;
    try {
      // Dynamic loading of socket.io-client library
      if (!window.io) {
        var script = document.createElement("script");
        script.src = "https://cdn.socket.io/4.7.5/socket.io.min.js";
        script.onload = function () { connectSocket(); };
        document.head.appendChild(script);
      } else {
        connectSocket();
      }
    } catch (e) {}
  }

  function connectSocket() {
    if (!window.io || !activeConversationId) return;
    socketClient = window.io(apiBaseUrl, {
      transports: ["websocket", "polling"],
      query: { conversation_id: activeConversationId },
    });

    socketClient.on("connect", function () {
      if (socketConnected) {
        // ONE REST catch-up fetch on reconnect to catch missed messages
        fetchCatchupMessages();
      }
      socketConnected = true;
      socketClient.emit("join_conversation", { conversation_id: activeConversationId });
    });

    socketClient.on("ai:thinking", function () {
      showThinkingIndicator();
    });

    socketClient.on("message:new", function (m) {
      removeThinkingIndicator();
      if (!document.getElementById("msg-" + m.id)) {
        var isAgent = m.sender_type === "agent";
        var isAI = m.sender_type === "ai";
        if (isAgent || isAI) {
          var msgEl = document.createElement("div");
          msgEl.id = "msg-" + m.id;
          msgEl.className = "supportai-msg bot";
          var label = isAgent ? "<span style='font-size:10px;opacity:0.75;display:block;margin-bottom:2px;'>Support Agent</span>" : "";
          msgEl.innerHTML = label + sanitizeOutput(m.content);
          body.appendChild(msgEl);
          body.scrollTop = body.scrollHeight;
        }
      }
    });

    socketClient.on("conversation:status_changed", function (evt) {
      if (evt && evt.status === "human") {
        var statusBadge = document.getElementById("supportai-status-badge");
        if (!statusBadge) {
          statusBadge = document.createElement("div");
          statusBadge.id = "supportai-status-badge";
          statusBadge.style.cssText = "font-size:10px;color:#f59e0b;background:rgba(245,158,11,0.1);padding:4px 8px;border-radius:12px;text-align:center;margin-bottom:6px;";
          statusBadge.innerText = "Connected with Human Support Agent";
          body.appendChild(statusBadge);
        }
      }
    });
  }

  function fetchCatchupMessages() {
    if (!activeConversationId) return;
    fetch(apiBaseUrl + "/public/" + workspaceId + "/conversations/" + activeConversationId + "/messages")
      .then(function (res) { return res.json(); })
      .then(function (messages) {
        if (!Array.isArray(messages)) return;
        messages.forEach(function (m) {
          if (!document.getElementById("msg-" + m.id)) {
            var isAgent = m.sender_type === "agent";
            var isAI = m.sender_type === "ai";
            if (isAgent || isAI) {
              var msgEl = document.createElement("div");
              msgEl.id = "msg-" + m.id;
              msgEl.className = "supportai-msg bot";
              var label = isAgent ? "<span style='font-size:10px;opacity:0.75;display:block;margin-bottom:2px;'>Support Agent</span>" : "";
              msgEl.innerHTML = label + sanitizeOutput(m.content);
              body.appendChild(msgEl);
              body.scrollTop = body.scrollHeight;
            }
          }
        });
      })
      .catch(function () {});
  }

  function showThinkingIndicator() {
    if (document.getElementById("supportai-thinking")) return;
    var thinkingEl = document.createElement("div");
    thinkingEl.id = "supportai-thinking";
    thinkingEl.className = "supportai-msg bot";
    thinkingEl.style.opacity = "0.7";
    thinkingEl.innerHTML = "<span style='font-style:italic;'>AI Assistant is thinking...</span>";
    body.appendChild(thinkingEl);
    body.scrollTop = body.scrollHeight;
  }

  function removeThinkingIndicator() {
    var thinkingEl = document.getElementById("supportai-thinking");
    if (thinkingEl && thinkingEl.parentNode) {
      thinkingEl.parentNode.removeChild(thinkingEl);
    }
  }

  function sendMessage(text) {
    var val = text || input.value.trim();
    if (!val || !activeConversationId) return;

    appendMessage("user", val);
    if (!text) input.value = "";

    initRealtimeSocket();
    showThinkingIndicator();

    fetch(apiBaseUrl + "/public/" + workspaceId + "/conversations/" + activeConversationId + "/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: visitorId, content: val }),
    })
      .then(function (res) {
        if (res.status === 429) {
          removeThinkingIndicator();
          appendMessage("bot", "Please slow down. You've sent too many messages recently.");
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        if (data.should_escalate) {
          var escEl = document.createElement("div");
          escEl.className = "supportai-msg bot";
          escEl.style.background = "#2D1B00";
          escEl.style.border = "1px solid #D4AF37";
          escEl.style.color = "#FFD700";
          escEl.innerHTML = "<strong>⚡ Escalated:</strong> Connecting you with our support team...";
          body.appendChild(escEl);
          body.scrollTop = body.scrollHeight;
        }
      })
      .catch(function (err) {
        removeThinkingIndicator();
        console.error("Widget fetch error:", err);
      });
  }

  sendBtn.onclick = function () { sendMessage(); };
  input.onkeypress = function (e) { if (e.key === "Enter") sendMessage(); };
})();
