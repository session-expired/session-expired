const lobbyList = document.getElementById("lobby-list");
const lobbyStatus = document.getElementById("lobby-status");
const lobbyDetail = document.getElementById("lobby-detail");
const playerList = document.getElementById("player-list");
const joinButton = document.getElementById("join-lobby");
const leaveButton = document.getElementById("leave-lobby");
const launchButton = document.getElementById("launch-game");
const deleteButton = document.getElementById("delete-lobby");
const characterPicker = document.getElementById("character-picker");
const characterOptions = document.getElementById("character-options");
const inviteLinkPanel = document.getElementById("invite-link-panel");
const inviteLinkInput = document.getElementById("invite-link");
let selectedLobbyId = null;

function createCharacterSprite(character) {
  const sprite = document.createElement("span");
  sprite.className = "character-sprite";
  sprite.dataset.character = character.id;
  sprite.style.backgroundImage = `url("${character.image}")`;
  sprite.setAttribute("role", "img");
  sprite.setAttribute("aria-label", character.name);
  return sprite;
}

async function api(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("Your session has expired. Redirecting to login.");
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `The server returned an unexpected response (${response.status}).`,
    );
  }
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The request could not be completed.");
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
      button.textContent = "View Lobby";
      button.addEventListener("click", () => viewLobby(lobby.id));
      item.append(details, button);
      lobbyList.appendChild(item);
    }
  } catch (error) {
    showStatus(error.message, true);
  }
}

async function viewLobby(lobbyId) {
  selectedLobbyId = lobbyId;
  showStatus("");
  await loadLobbyDetail();
}

async function joinLobby() {
  if (!selectedLobbyId) return;
  joinButton.disabled = true;
  try {
    await api(`/api/lobbies/${selectedLobbyId}/join`, {
      method: "POST",
      body: "{}",
    });
    showStatus("");
    await Promise.all([loadLobbies(), loadLobbyDetail()]);
  } catch (error) {
    showStatus(error.message, true);
    joinButton.disabled = false;
  }
}

async function loadLobbyDetail() {
  if (!selectedLobbyId) return;
  try {
    const { lobby, players, currentUserId, minimumPlayers, characters } =
      await api(`/api/lobbies/${selectedLobbyId}`);
    const charactersById = new Map(
      characters.map((character) => [character.id, character]),
    );
    const isMember = players.some(
      (player) => String(player.id) === currentUserId,
    );
    if (isMember && lobby.status === "started" && lobby.game_id) {
      window.location.assign(`/game/${lobby.game_id}`);
      return;
    }
    lobbyDetail.hidden = false;
    document.getElementById("detail-heading").textContent = lobby.name;
    document.getElementById("lobby-meta").textContent =
      `${players.length}/${lobby.max_players} players${lobby.is_private ? " · Private" : ""}`;
    inviteLinkPanel.hidden = !lobby.invite_token;
    inviteLinkInput.value = lobby.invite_token
      ? `${window.location.origin}/lobby?invite=${encodeURIComponent(lobby.invite_token)}`
      : "";
    playerList.replaceChildren();
    for (const player of players) {
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `${player.username}${String(player.id) === String(lobby.host_id) ? " (host)" : ""}`;
      item.appendChild(label);
      const selectedCharacter = charactersById.get(player.selected_character);
      if (selectedCharacter)
        item.appendChild(createCharacterSprite(selectedCharacter));
      playerList.appendChild(item);
    }
    const isHost = String(lobby.host_id) === currentUserId;
    const isFull = players.length >= lobby.max_players;
    const currentPlayer = players.find(
      (player) => String(player.id) === currentUserId,
    );
    const chosenCharacters = new Set(
      players.map((player) => player.selected_character).filter(Boolean),
    );
    const allCharactersSelected =
      players.length > 0 &&
      players.every((player) => player.selected_character);
    characterPicker.hidden = !isMember || lobby.status !== "waiting";
    characterOptions.replaceChildren();
    if (!characterPicker.hidden) {
      for (const character of characters) {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "character-option";
        const selectedByCurrentPlayer =
          currentPlayer?.selected_character === character.id;
        option.disabled =
          chosenCharacters.has(character.id) && !selectedByCurrentPlayer;
        option.classList.toggle("selected", selectedByCurrentPlayer);
        option.append(createCharacterSprite(character));
        const name = document.createElement("span");
        name.textContent = character.name;
        option.appendChild(name);
        option.addEventListener("click", () => selectCharacter(character.id));
        characterOptions.appendChild(option);
      }
    }
    joinButton.hidden = isMember || lobby.status !== "waiting";
    joinButton.disabled = isFull;
    joinButton.textContent = isFull ? "Lobby Full" : "Join Lobby";
    joinButton.hidden = isMember || lobby.status !== "waiting";
    joinButton.disabled = isFull;
    joinButton.textContent = isFull ? "Lobby Full" : "Join Lobby";

    leaveButton.hidden = !isMember || lobby.status !== "waiting";
    leaveButton.disabled = false;
    launchButton.hidden = !isHost;
    launchButton.disabled =
      players.length < minimumPlayers || !allCharactersSelected;

    deleteButton.hidden = !isHost || lobby.status !== "waiting";
    deleteButton.disabled = false;
    deleteButton.hidden = !isHost || lobby.status !== "waiting";
    
    document.getElementById("launch-help").textContent =
      lobby.status !== "waiting"
        ? "This lobby has already started."
        : !isMember
          ? isFull
            ? "This lobby is currently full."
            : "View the players above, then join when you are ready."
          : players.length < minimumPlayers
            ? `At least ${minimumPlayers} players are needed to launch.`
            : !allCharactersSelected
              ? "Every player must choose a character before the game can launch."
              : isHost
                ? "The game is ready to launch."
                : "Waiting for the host to launch the game.";
  } catch (error) {
    showStatus(error.message, true);
  }
}

async function selectCharacter(character) {
  if (!selectedLobbyId) return;
  try {
    await api(`/api/lobbies/${selectedLobbyId}/character`, {
      method: "POST",
      body: JSON.stringify({ character }),
    });
    showStatus("");
    await loadLobbyDetail();
  } catch (error) {
    showStatus(error.message, true);
    await loadLobbyDetail();
  }
}

document
  .getElementById("create-lobby-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("lobby-name");
    try {
      const { lobbyId } = await api("/api/lobbies", {
        method: "POST",
        body: JSON.stringify({
          name: input.value,
          isPrivate: document.getElementById("private-lobby").checked,
        }),
      });
      input.value = "";
      document.getElementById("private-lobby").checked = false;
      selectedLobbyId = lobbyId;
      await Promise.all([loadLobbies(), loadLobbyDetail()]);
    } catch (error) {
      showStatus(error.message, true);
    }
  });

joinButton.addEventListener("click", joinLobby);

document.getElementById("copy-invite-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(inviteLinkInput.value);
    showStatus("Invite link copied.");
  } catch {
    inviteLinkInput.select();
    showStatus("Select and copy the invite link above.");
  }
});

leaveButton.addEventListener("click", async () => {
  if (
    !selectedLobbyId ||
    !window.confirm("Are you sure you want to leave this lobby?")
  )
    return;
  leaveButton.disabled = true;
  try {
    const result = await api(`/api/lobbies/${selectedLobbyId}/leave`, {
      method: "POST",
      body: "{}",
    });
    selectedLobbyId = null;
    lobbyDetail.hidden = true;
    showStatus(
      result.deletesInSeconds
        ? "Lobby left. The empty lobby will be removed in 5 seconds."
        : "Lobby left.",
    );
    await loadLobbies();
  } catch (error) {
    showStatus(error.message, true);
    leaveButton.disabled = false;
  }
});

deleteButton.addEventListener("click", async () => {
  if (
    !selectedLobbyId ||
    !window.confirm("Are you sure you want to delete this lobby?")
  )
    return;
  deleteButton.disabled = true;
  try {
    await api(`/api/lobbies/${selectedLobbyId}`, { method: "DELETE" });
    selectedLobbyId = null;
    lobbyDetail.hidden = true;
    showStatus("Lobby deleted.");
    await loadLobbies();
  } catch (error) {
    showStatus(error.message, true);
    deleteButton.disabled = false;
  }
});

launchButton.addEventListener("click", async () => {
  launchButton.disabled = true;
  try {
    const { gameId } = await api(`/api/lobbies/${selectedLobbyId}/start`, {
      method: "POST",
      body: "{}",
    });
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

async function joinFromInviteLink() {
  const inviteToken = new URLSearchParams(window.location.search).get("invite");
  if (!inviteToken) return;
  try {
    const { lobbyId } = await api("/api/lobbies/join-by-invite", {
      method: "POST",
      body: JSON.stringify({ inviteToken }),
    });
    selectedLobbyId = lobbyId;
    window.history.replaceState({}, "", "/lobby");
    await Promise.all([loadLobbies(), loadLobbyDetail()]);
  } catch (error) {
    showStatus(error.message, true);
  }
}

loadLobbies();
joinFromInviteLink();
const refreshTimer = window.setInterval(() => {
  loadLobbies();
  loadLobbyDetail();
}, 3000);
window.addEventListener("beforeunload", () =>
  window.clearInterval(refreshTimer),
);
