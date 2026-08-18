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
    <h2 class="chat-title">Chat</h2>
    <div class="chat-tabs" role="tablist" aria-label="Chat type">
      <button class="chat-tab active" type="button" role="tab" aria-selected="true" data-chat-tab="global">Global</button>
      <button class="chat-tab" type="button" role="tab" aria-selected="false" data-chat-tab="private">Private</button>
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
    </form>`;
  document.body.appendChild(panel);
  document.body.classList.add("has-chat");

  const messages = panel.querySelector(".chat-messages");
  const form = panel.querySelector(".chat-form");
  const input = panel.querySelector("#chat-input");
  const status = panel.querySelector(".chat-status");
  const recipientRow = panel.querySelector(".chat-recipient");
  const recipient = panel.querySelector("#chat-user");
  let activeTab = "global";
  let currentUser = null;
  let socket = null;

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
      socket.on("chat-rejected", ({ reason }) => {
        status.textContent = reason || "This message could not be sent.";
      });
    })
    .catch(() => {
      status.textContent = "Chat is currently unavailable.";
      form.hidden = true;
    });
})();
