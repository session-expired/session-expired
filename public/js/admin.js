(() => {
  const status = document.querySelector("#admin-status");
  const connectedBody = document.querySelector("#connected-users");
  const bannedBody = document.querySelector("#banned-users");
  const messageBody = document.querySelector("#message-history");
  const actionBody = document.querySelector("#action-history");
  const dialog = document.querySelector("#ban-dialog");
  let messages = [];
  let nextBefore = null;

  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const time = (value) => value ? new Date(value).toLocaleString() : "—";
  const empty = (columns, text) => `<tr><td colspan="${columns}" class="empty">${escape(text)}</td></tr>`;
  function notice(text, error = false) { status.textContent = text; status.className = `status ${error ? "error" : "success"}`; }

  async function api(url, options) {
    const response = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  async function loadUsers() {
    const { users } = await api("/api/admin/users");
    connectedBody.innerHTML = users.length ? users.map((user) => {
      const location = user.game_id ? `Game ${escape(user.game_id)}` : user.lobby_id ? `Lobby ${escape(user.lobby_name || user.lobby_id)}` : "—";
      return `<tr><td>${escape(user.username)}</td><td>${escape(user.id)}</td><td>${location}</td><td>${escape(user.connectionCount)}</td><td><button data-action="kick" data-id="${escape(user.id)}" data-name="${escape(user.username)}">Kick</button><button class="danger" data-action="ban" data-id="${escape(user.id)}" data-name="${escape(user.username)}">Ban</button></td></tr>`;
    }).join("") : empty(5, "No authenticated users are connected.");
  }

  async function loadBans() {
    const { bans } = await api("/api/admin/bans");
    bannedBody.innerHTML = bans.length ? bans.map((ban) => `<tr><td>${escape(ban.username)}</td><td>${escape(ban.user_id)}</td><td>${escape(ban.reason || "—")}</td><td>${escape(ban.banned_by)}</td><td>${time(ban.created_at)}</td><td>${ban.expires_at ? time(ban.expires_at) : "Permanent"}</td><td><button data-action="unban" data-id="${escape(ban.user_id)}" data-name="${escape(ban.username)}">Unban</button></td></tr>`).join("") : empty(7, "There are no active bans.");
  }

  function renderMessages() {
    const userFilter = document.querySelector("#message-user-filter").value.trim().toLowerCase();
    const textFilter = document.querySelector("#message-text-filter").value.trim().toLowerCase();
    const locationFilter = document.querySelector("#message-lobby-filter").value.trim().toLowerCase();
    const filtered = messages.filter((item) => item.username.toLowerCase().includes(userFilter) && item.message.toLowerCase().includes(textFilter) && `${item.lobby_id || ""} ${item.game_id || ""}`.toLowerCase().includes(locationFilter));
    messageBody.innerHTML = filtered.length ? filtered.map((item) => `<tr><td>${time(item.sent_at)}</td><td>${escape(item.username)}</td><td>${escape(item.message)}</td><td>${escape(item.channel)}</td><td>${item.game_id ? `Game ${escape(item.game_id)}` : item.lobby_id ? `Lobby ${escape(item.lobby_id)}` : "—"}</td></tr>`).join("") : empty(5, "No matching messages.");
  }

  async function loadMessages(append = false) {
    const data = await api(`/api/admin/messages?limit=50${append && nextBefore ? `&before=${encodeURIComponent(nextBefore)}` : ""}`);
    messages = append ? messages.concat(data.messages) : data.messages;
    nextBefore = data.nextBefore;
    document.querySelector("#load-more").hidden = !nextBefore;
    renderMessages();
  }

  async function loadActions() {
    const { actions } = await api("/api/admin/actions");
    actionBody.innerHTML = actions.length ? actions.map((item) => `<tr><td>${time(item.created_at)}</td><td>${escape(item.admin)}</td><td>${escape(item.action)}</td><td>${escape(item.target)}</td><td>${escape(item.details || "—")}</td></tr>`).join("") : empty(5, "No moderation actions have been recorded.");
  }

  async function refresh() {
    try { await Promise.all([loadUsers(), loadBans(), loadMessages(), loadActions()]); }
    catch (error) { notice(error.message, true); }
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, id, name } = button.dataset;
    if (action === "ban") { document.querySelector("#ban-user-id").value = id; document.querySelector("#ban-username").textContent = name; dialog.showModal(); return; }
    if (action === "kick" && !confirm(`Kick ${name}?`)) return;
    if (action === "unban" && !confirm(`Unban ${name}?`)) return;
    button.disabled = true;
    try { await api(`/api/admin/users/${id}/${action}`, { method: "POST", body: "{}" }); notice(`${name} ${action === "kick" ? "kicked" : "unbanned"} successfully.`); await Promise.all([loadUsers(), loadBans(), loadActions()]); }
    catch (error) { notice(`Failed to ${action} user: ${error.message}`, true); button.disabled = false; }
  });

  document.querySelector("#ban-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const submit = event.submitter; submit.disabled = true;
    const id = document.querySelector("#ban-user-id").value; const name = document.querySelector("#ban-username").textContent;
    try { await api(`/api/admin/users/${id}/ban`, { method: "POST", body: JSON.stringify({ reason: document.querySelector("#ban-reason").value, durationHours: document.querySelector("#ban-duration").value || null }) }); dialog.close(); notice(`${name} banned successfully.`); event.target.reset(); await Promise.all([loadUsers(), loadBans(), loadActions()]); }
    catch (error) { notice(`Failed to ban user: ${error.message}`, true); }
    finally { submit.disabled = false; }
  });
  document.querySelector("#cancel-ban").addEventListener("click", () => dialog.close());
  document.querySelector("#refresh-all").addEventListener("click", refresh);
  document.querySelector("#load-more").addEventListener("click", () => loadMessages(true).catch((error) => notice(error.message, true)));
  ["#message-user-filter", "#message-text-filter", "#message-lobby-filter"].forEach((selector) => document.querySelector(selector).addEventListener("input", renderMessages));
  refresh();
})();
