const path = require("path");
const fs = require("fs");
const express = require("express");
const {
  createInitialGameState,
  rooms,
  spawnPoints,
  secretPass,
  blockedTiles,
  searchItems,
  rollMovementDie,
  movementPath,
  movePlayer,
  endPlayerTurn,
  completeWardenTurn,
  discoverHint,
  submitGuess,
  submitAccusation
} = require("../server/game/board");

if (process.env.MULTI_TEST_MODE !== "true") {
  throw new Error("The multi-player harness requires MULTI_TEST_MODE=true (use npm run multi).");
}

const app = express();
const port = Number(process.env.MULTI_PORT) || 3003;
const hostname = process.env.HOST || "127.0.0.1";
const publicDirectory = path.join(__dirname, "..", "public");
const gamePagePath = path.join(publicDirectory, "pages", "game.html");
const gameId = "multi-test";
const testPlayers = [
  { id: "test-player-1", username: "Player 1", selected_character: "rasputin" },
  { id: "test-player-2", username: "Player 2", selected_character: "lovelace" },
  { id: "test-player-3", username: "Player 3", selected_character: "curie" },
  { id: "test-player-4", username: "Player 4", selected_character: "crowley" }
];

function createTestState() {
  return createInitialGameState(testPlayers, () => 0.5, { id: gameId, name: gameId });
}

let state = createTestState();
let wardenTimer = null;
const wardenPhaseMs = Number(process.env.WARDEN_PHASE_MS) || 1200;

function scheduleWardenCompletion() {
  if (wardenTimer) return;
  wardenTimer = setTimeout(() => {
    wardenTimer = null;
    completeWardenTurn(state);
    if (state.turn.phase === "warden") scheduleWardenCompletion();
  }, wardenPhaseMs);
}

function actorId(request) {
  const id = request.get("x-multi-test-player");
  return testPlayers.some(player => player.id === id) ? id : null;
}

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.get("/", (request, response) => response.redirect(`/__multi/${gameId}`));

function renderMultiPage() {
  const debugPanel = `
    <aside id="multi-panel">
      <p id="controlled-player">Controlled test player: none</p>
      <div id="debug-summary">Loading state…</div>
      <details><summary>Private hint ownership</summary><div id="hint-summary"></div></details>
      <details><summary>Raw JSON state</summary><pre id="raw-state"></pre></details>
    </aside>`;
  return fs.readFileSync(gamePagePath, "utf8")
    .replace('<body class="game-page">', '<body class="game-page multi-page">')
    .replace(/<header class="game-header">[\s\S]*?<\/header>/, `
    <header class="game-header">
      <strong>MULTI PLAYER TEST</strong>
      <button id="reset-game" type="button">Reset game</button>
    </header>${debugPanel}`)
    .replace('    <script src="/socket.io/socket.io.js"></script>\n', "")
    .replace('    <script src="/js/chat.js"></script>\n', "")
    .replace('    <script src="/js/game/music.js"></script>\n', "")
    .replace('    <script type="module" src="/js/game/board.js"></script>', `
    <link rel="stylesheet" href="/__multi/multi.css" />
    <script src="/__multi/turn-controller.js"></script>
    <script src="/__multi/multi-client.js"></script>
    <script type="module" src="/js/game/board.js"></script>`);
}

app.get(`/__multi/${gameId}`, (request, response) => response.type("html").send(renderMultiPage()));
app.get(`/api/games/${gameId}`, (request, response) => {
  response.json({
    game: { id: gameId, state, created_at: new Date(state.createdAt).toISOString() },
    currentUserId: state.turn.playerId,
    debugCoordinates: true
  });
});
app.get("/api/board", (request, response) => response.json({
  rooms, spawnPoints, secretPass, blockedTiles, searchItems
}));
app.get("/__multi/state", (request, response) => response.json({ state }));
app.post("/__multi/reset", (request, response) => {
  if (wardenTimer) clearTimeout(wardenTimer);
  wardenTimer = null;
  state = createTestState();
  response.json({ state });
});
app.post(`/api/games/${gameId}/roll`, (request, response) => {
  try {
    const roll = rollMovementDie(state, actorId(request));
    response.json({ roll, state });
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});
app.post(`/api/games/${gameId}/move`, (request, response) => {
  try {
    const playerId = actorId(request);
    const path = movementPath(state, playerId, request.body);
    const cost = movePlayer(state, playerId, request.body);
    response.json({ cost, distance: path.length, path, state });
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});
app.post(`/api/games/${gameId}/hints/:hintId`, (request, response) => {
  try {
    const result = discoverHint(state, actorId(request), request.params.hintId);
    response.json({ ...result, state });
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});
app.post(`/api/games/${gameId}/end-turn`, (request, response) => {
  try {
    const transition = endPlayerTurn(state, actorId(request));
    if (transition.warden) scheduleWardenCompletion();
    response.json({ state });
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});
app.post(`/api/games/${gameId}/guess`, (request, response) => {
  try {
    const result = submitGuess(state, actorId(request), request.body);
    if (result.transition.warden) scheduleWardenCompletion();
    response.json({ disproved: result.disproved, provider: result.provider, hint: result.hint, state });
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});
app.post(`/api/games/${gameId}/accuse`, (request, response) => {
  try {
    const correct = submitAccusation(state, actorId(request), request.body);
    if (correct && wardenTimer) {
      clearTimeout(wardenTimer);
      wardenTimer = null;
    } else if (!correct && state.turn.phase === "warden") scheduleWardenCompletion();
    response.json({ correct, state });
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});
app.post(`/api/games/${gameId}/quit`, (request, response) => response.json({ ok: true, redirect: `/__multi/${gameId}` }));

app.use("/css", express.static(path.join(publicDirectory, "css"), { fallthrough: false }));
app.use("/assets", express.static(path.join(publicDirectory, "assets"), { fallthrough: false }));
app.use("/js/game", express.static(path.join(publicDirectory, "js", "game"), { fallthrough: false }));
app.use("/__multi", express.static(__dirname, { fallthrough: false }));
app.use((request, response) => response.status(404).type("text").send("Not found"));

function startMultiServer() {
  return app.listen(port, hostname, () => {
    console.log(`Four-player test harness: http://${hostname}:${port}/__multi/${gameId}`);
  });
}

if (require.main === module) startMultiServer();

module.exports = { app, createTestState, gameId, renderMultiPage, startMultiServer, testPlayers };
