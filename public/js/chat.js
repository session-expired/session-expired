(() => {
  const isGamePage = document.body.classList.contains("game-page");
  let footer = document.querySelector("footer");
  if (!footer && !isGamePage) {
    footer = document.createElement("footer");
    footer.innerHTML = '<div id="copy">&copy; 2026 Session Expired</div>';
    document.body.appendChild(footer);
  }

  const syncFooterHeight = () => {
    const footerHeight = footer ? footer.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty("--footer-height", `${footerHeight}px`);
  };
  syncFooterHeight();
  window.addEventListener("load", syncFooterHeight);
  window.addEventListener("resize", syncFooterHeight);
  if (footer && "ResizeObserver" in window) new ResizeObserver(syncFooterHeight).observe(footer);

  const panel = document.createElement("aside");
  panel.className = "chat-panel";
  panel.setAttribute("aria-label", "Chat");
  panel.innerHTML = `
    <div class="chat-header">
      <h2 class="chat-title">Chat</h2>
      <button class="chat-toggle" type="button" aria-label="Collapse chat" aria-expanded="true">‹</button>
    </div>
    <div class="chat-content">
    <div class="chat-tabs" role="tablist" aria-label="Chat type">
      <button class="chat-tab active" type="button" role="tab" aria-selected="true" data-chat-tab="global">Global</button>
      <button class="chat-tab" type="button" role="tab" aria-selected="false" data-chat-tab="private">Private</button>
      <button class="chat-tab" type="button" role="tab" aria-selected="false" aria-disabled="true" data-chat-tab="game" disabled title="Game chat is available during a game">Game</button>
    </div>
    <div class="chat-recipient" hidden>
      <label for="chat-user">Message</label>
      <select id="chat-user"><option value="">Select an online player</option></select>
      <span class="private-presence" aria-live="polite"></span>
    </div>
    <ul class="chat-messages" aria-live="polite"></ul>
    <p class="chat-status">Checking login...</p>
    <form class="chat-form">
      <label class="visually-hidden" for="chat-input">Message</label>
      <input id="chat-input" maxlength="500" autocomplete="off" placeholder="Type a message..." />
      <button type="submit">Send</button>
    </form>
    </div>`;
  document.body.appendChild(panel);
  document.body.classList.add("has-chat");

  const messages = panel.querySelector(".chat-messages");
  const form = panel.querySelector(".chat-form");
  const input = panel.querySelector("#chat-input");
  const status = panel.querySelector(".chat-status");
  const recipientRow = panel.querySelector(".chat-recipient");
  const recipient = panel.querySelector("#chat-user");
  const privatePresence = panel.querySelector(".private-presence");
  const sendButton = form.querySelector('button[type="submit"]');
  const toggle = panel.querySelector(".chat-toggle");
  let activeTab = "global";
  let currentUser = null;
  let socket = null;
  let selectedPrivateUser = null;
  let onlineUsers = [];
  const gamePathMatch = window.location.pathname.match(/^\/game\/(\d+)\/?$/);
  const gameId = gamePathMatch ? Number(gamePathMatch[1]) : null;

  function setCollapsed(collapsed) {
    panel.classList.toggle("collapsed", collapsed);
    document.body.classList.toggle("chat-collapsed", collapsed);
    toggle.textContent = collapsed ? "‹" : "›";
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Expand chat" : "Collapse chat");
    sessionStorage.setItem("chat-collapsed", String(collapsed));
  }

  toggle.addEventListener("click", () => setCollapsed(!panel.classList.contains("collapsed")));
  setCollapsed(sessionStorage.getItem("chat-collapsed") === "true");

  function addMessage(channel, message) {
    const item = document.createElement("li");
    item.dataset.channel = channel;
    item.textContent = `${message.sender}: ${message.text}`;
    item.hidden = channel !== activeTab;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  function updatePrivateControls() {
    const online = selectedPrivateUser && onlineUsers.some(user => String(user.id) === String(selectedPrivateUser.id));
    if (!selectedPrivateUser) privatePresence.textContent = "";
    else privatePresence.textContent = online
      ? `${selectedPrivateUser.username} — Online`
      : `${selectedPrivateUser.username} — Offline · This player is offline.`;
    const unavailable = activeTab === "private" && (!selectedPrivateUser || !online);
    input.disabled = unavailable;
    sendButton.disabled = unavailable;
  }

  function renderOnlineUsers(users) {
    onlineUsers = users.filter(user => String(user.id) !== String(currentUser?.id));
    const selectedId = selectedPrivateUser && String(selectedPrivateUser.id);
    recipient.replaceChildren(new Option("Select an online player", ""));
    onlineUsers.forEach(user => recipient.add(new Option(`● ${user.username} — Online`, user.id)));
    const selectedOnline = onlineUsers.find(user => String(user.id) === selectedId);
    recipient.value = selectedOnline ? String(selectedOnline.id) : "";
    updatePrivateControls();
  }

  recipient.addEventListener("change", () => {
    const user = onlineUsers.find(candidate => String(candidate.id) === recipient.value);
    if (user) selectedPrivateUser = user;
    updatePrivateControls();
  });

  window.addEventListener("game-flavor-message", (event) => {
    const { sender, text } = event.detail || {};
    if (gameId && typeof sender === "string" && typeof text === "string") {
      // Flavor messages deliberately have no senderId: the historical character,
      // not the user controlling that character, is speaking.
      addMessage("game", { sender, text });
    }
  });

  panel.querySelectorAll("[data-chat-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.chatTab;
      panel.querySelectorAll("[data-chat-tab]").forEach((button) => {
        const selected = button === tab;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-selected", String(selected));
      });
      recipientRow.hidden = activeTab !== "private";
      messages.querySelectorAll("li").forEach((item) => { item.hidden = item.dataset.channel !== activeTab; });
      updatePrivateControls();
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!socket || !currentUser || !text) return;
    if (activeTab === "private") {
      if (!recipient.value) return recipient.focus();
      socket.emit("private-message", { recipientId: Number(recipient.value), text });
    } else if (activeTab === "game") {
      socket.emit("game-message", { text });
    } else {
      socket.emit("global-message", { text });
    }
    input.value = "";
  });

  fetch("/api/session")
    .then((response) => response.json())
    .then(async (session) => {
      if (!session.authenticated) {
        status.innerHTML = '<a href="/login">Log in</a> to use chat.';
        form.hidden = true;
        return;
      }
      currentUser = session.user;
      status.textContent = `Signed in as ${currentUser.username}`;
      socket = io();
      socket.on("presence-users", ({ users } = {}) => renderOnlineUsers(Array.isArray(users) ? users : []));
      socket.on("global-history", (history) => {
        history.forEach((message) => addMessage("global", message));
      });
      socket.on("global-message", (message) => addMessage("global", message));
      socket.on("private-message", (message) => addMessage("private", message));
      socket.on("game-chat-ready", () => {
        const gameTab = panel.querySelector('[data-chat-tab="game"]');
        gameTab.disabled = false;
        gameTab.setAttribute("aria-disabled", "false");
        gameTab.title = "Chat with players in this game";
      });
      socket.on("game-history", (history) => {
        history.forEach((message) => addMessage("game", message));
      });
      socket.on("game-message", (message) => addMessage("game", message));
      socket.on("game-state", state => {
        window.dispatchEvent(new CustomEvent("game-state", { detail: state }));
      });
      socket.on("guess-hint-shared", detail => {
        window.dispatchEvent(new CustomEvent("guess-hint-shared", { detail }));
      });
      socket.on("guess-disproved", detail => {
        window.dispatchEvent(new CustomEvent("guess-disproved", { detail }));
      });
      if (gameId) socket.emit("join-game-chat", { gameId });
      socket.on("chat-rejected", ({ reason }) => {
        status.textContent = reason || "This message could not be sent.";
      });
    })
    .catch(() => {
      status.textContent = "Chat is currently unavailable.";
      form.hidden = true;
    });
})();
