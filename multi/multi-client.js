const multiPlayers = [
  ["test-player-1", "Player 1 · Rasputin"],
  ["test-player-2", "Player 2 · Lovelace"],
  ["test-player-3", "Player 3 · Curie"],
  ["test-player-4", "Player 4 · Crowley"]
];
let controlledActor = null;
let lastStateFingerprint = null;
window.MULTI_TEST_MODE = true;

function syncControlledActor(state) {
  const nextActor = MultiTurnController.controlledPlayerId(state, multiPlayers.map(([id]) => id));
  if (nextActor !== controlledActor) {
    controlledActor = nextActor;
    window.dispatchEvent(new CustomEvent("game-perspective", { detail: controlledActor }));
  }
  const controlled = multiPlayers.find(([id]) => id === controlledActor);
  const indicator = document.getElementById("controlled-player");
  if (indicator) indicator.textContent = `Controlled test player: ${controlled?.[1] || "none"}`;
}

const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (controlledActor) headers.set("X-Multi-Test-Player", controlledActor);
  const response = await nativeFetch(input, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    response.clone().json().then(payload => {
      const state = payload.state || payload.game?.state;
      if (state) {
        syncControlledActor(state);
        const requestUrl = typeof input === "string" ? input : input.url;
        if (!requestUrl.includes("/__multi/state")) {
          lastStateFingerprint = JSON.stringify(state);
        }
      }
    }).catch(() => {});
  }
  return response;
};

window.addEventListener("DOMContentLoaded", () => {
  async function refreshDebug() {
    const response = await fetch("/__multi/state");
    const { state } = await response.json();
    syncControlledActor(state);
    const current = state.players.find(player => String(player.id) === String(state.turn.playerId));
    const roomAt = player => state.board.rooms.find(room =>
      player.position.row >= room.rows.start && player.position.row <= room.rows.end &&
      player.position.col >= room.cols.start && player.position.col <= room.cols.end
    )?.name || "Hallway";
    document.getElementById("debug-summary").innerHTML = `
      <p>Lobby/game: ${state.lobbyName} · Status: ${state.status} · Turn ${state.turn.number}: ${current?.username || "none"}</p>
      <ul>${state.players.map(player => `<li>${player.id} · ${player.character} · ${roomAt(player)} (${player.position.row}, ${player.position.col}) · ${player.discoveredHintIds?.length || 0} hints · turns to skip: ${player.turnsToSkip || 0}</li>`).join("")}</ul>
      <p>Winner: ${state.winner?.username || "none"}</p>`;
    document.getElementById("hint-summary").innerHTML = state.players.map(player => `
      <section class="test-player-hints">
        <strong>${player.username} · ${player.character}</strong>
        <ul>${(player.discoveredHints || []).map(hint => `<li>${hint.category}: ${hint.text}${hint.source === "shared" ? " (shared)" : ""}</li>`).join("")}</ul>
      </section>`).join("");
    document.getElementById("raw-state").textContent = JSON.stringify(state, null, 2);
    const fingerprint = JSON.stringify(state);
    if (fingerprint !== lastStateFingerprint) {
      lastStateFingerprint = fingerprint;
      window.dispatchEvent(new CustomEvent("game-state", { detail: state }));
    }
  }

  document.getElementById("reset-game").addEventListener("click", async () => {
    await fetch("/__multi/reset", { method: "POST" });
    location.reload();
  });
  refreshDebug();
  window.setInterval(refreshDebug, 100);
});
