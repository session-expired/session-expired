const lobbyList = document.getElementById("lobby-list");
const lobbyStatus = document.getElementById("lobby-status");
const lobbyDetail = document.getElementById("lobby-detail");
const playerList = document.getElementById("player-list");
const launchButton = document.getElementById("launch-game");
let selectedLobbyId = null;

async function api(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) }
  });
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("Your session has expired. Redirecting to login.");
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`The server returned an unexpected response (${response.status}).`);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

function showStatus(message, isError = false) {
  lobbyStatus.textContent = message;
  lobbyStatus.classList.toggle("error", isError);
}

async function loadLobbies() {
  try {
    const { lobbies } = await api("/api/lobbies");
    lobbyList.replaceChildren();
    if (!lobbies.length) {
      const empty = document.createElement("li");
      empty.className = "empty-lobbies";
      empty.textContent = "No lobbies are waiting. Create the first one.";
      lobbyList.appendChild(empty);
      return;
    }
    for (const lobby of lobbies) {
      const item = document.createElement("li");
      item.className = "lobby-card";
      const details = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = lobby.name;
      const meta = document.createElement("span");
      meta.textContent = `Host: ${lobby.host_username} · ${lobby.player_count}/${lobby.max_players} players`;
      details.append(name, meta);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = lobby.joined ? "Open" : "Join";
      button.addEventListener("click", () => joinLobby(lobby.id, lobby.joined));
      item.append(details, button);
      lobbyList.appendChild(item);
    }
  } catch (error) {
    showStatus(error.message, true);
  }
}

async function joinLobby(lobbyId, alreadyJoined) {
  try {
    if (!alreadyJoined) await api(`/api/lobbies/${lobbyId}/join`, { method: "POST", body: "{}" });
    selectedLobbyId = lobbyId;
    showStatus("");
    await Promise.all([loadLobbies(), loadLobbyDetail()]);
  } catch (error) {
    showStatus(error.message, true);
  }
}

async function loadLobbyDetail() {
  if (!selectedLobbyId) return;
  try {
    const { lobby, players, currentUserId, minimumPlayers } = await api(`/api/lobbies/${selectedLobbyId}`);
    if (lobby.status === "started" && lobby.game_id) {
      window.location.assign(`/game/${lobby.game_id}`);
      return;
    }
    lobbyDetail.hidden = false;
    document.getElementById("detail-heading").textContent = lobby.name;
    document.getElementById("lobby-meta").textContent = `${players.length}/${lobby.max_players} players`;
    playerList.replaceChildren();
    for (const player of players) {
      const item = document.createElement("li");
      item.textContent = `${player.username}${String(player.id) === String(lobby.host_id) ? " (host)" : ""}`;
      playerList.appendChild(item);
    }
    const isHost = String(lobby.host_id) === currentUserId;
    launchButton.hidden = !isHost;
    launchButton.disabled = players.length < minimumPlayers;
    document.getElementById("launch-help").textContent = players.length < minimumPlayers
      ? `At least ${minimumPlayers} players are needed to launch.`
      : isHost ? "The game is ready to launch." : "Waiting for the host to launch the game.";
  } catch (error) {
    showStatus(error.message, true);
  }
}

document.getElementById("create-lobby-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("lobby-name");
  try {
    const { lobbyId } = await api("/api/lobbies", {
      method: "POST",
      body: JSON.stringify({ name: input.value })
    });
    input.value = "";
    selectedLobbyId = lobbyId;
    await Promise.all([loadLobbies(), loadLobbyDetail()]);
  } catch (error) {
    showStatus(error.message, true);
  }
});

launchButton.addEventListener("click", async () => {
  launchButton.disabled = true;
  try {
    const { gameId } = await api(`/api/lobbies/${selectedLobbyId}/start`, { method: "POST", body: "{}" });
    window.location.assign(`/game/${gameId}`);
  } catch (error) {
    showStatus(error.message, true);
    launchButton.disabled = false;
  }
});

document.getElementById("refresh-lobbies").addEventListener("click", () => {
  loadLobbies();
  loadLobbyDetail();
});

loadLobbies();
const refreshTimer = window.setInterval(() => {
  loadLobbies();
  loadLobbyDetail();
}, 3000);
window.addEventListener("beforeunload", () => window.clearInterval(refreshTimer));
