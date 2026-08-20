(() => {
  let footer = document.querySelector("footer");
  if (!footer) {
    footer = document.createElement("footer");
    footer.innerHTML = '<div id="copy">&copy; 2026 Session Expired</div>';
    document.body.appendChild(footer);
  }

  const syncFooterHeight = () => {
    document.documentElement.style.setProperty("--footer-height", `${footer.getBoundingClientRect().height}px`);
  };
  syncFooterHeight();
  window.addEventListener("load", syncFooterHeight);
  window.addEventListener("resize", syncFooterHeight);
  if ("ResizeObserver" in window) new ResizeObserver(syncFooterHeight).observe(footer);

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
      <select id="chat-user"><option value="">Select a user</option></select>
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
  const toggle = panel.querySelector(".chat-toggle");
  let activeTab = "global";
  let currentUser = null;
  let socket = null;
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
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        data.users.forEach((user) => recipient.add(new Option(user.username, user.id)));
      }
      socket = io();
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
