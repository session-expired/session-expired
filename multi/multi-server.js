const path = require("path");
const express = require("express");
const {
  createInitialGameState,
  rooms,
  spawnPoints,
  secretPass,
  rollMovementDie,
  movementPath,
  movePlayer,
  endPlayerTurn,
  completeWardenTurn,
  submitAccusation
} = require("../server/game/board");

if (process.env.MULTI_TEST_MODE !== "true") {
  throw new Error("The multi-player harness requires MULTI_TEST_MODE=true (use npm run multi).");
}

const app = express();
const port = Number(process.env.MULTI_PORT) || 3003;
const hostname = process.env.HOST || "127.0.0.1";
const publicDirectory = path.join(__dirname, "..", "public");
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
app.get(`/__multi/${gameId}`, (request, response) => response.sendFile(path.join(__dirname, "multi.html")));
app.get(`/api/games/${gameId}`, (request, response) => {
  response.json({
    game: { id: gameId, state, created_at: new Date(state.createdAt).toISOString() },
    currentUserId: state.turn.playerId
  });
});
app.get("/api/board", (request, response) => response.json({ rooms, spawnPoints, secretPass }));
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
app.post(`/api/games/${gameId}/end-turn`, (request, response) => {
  try {
    const transition = endPlayerTurn(state, actorId(request));
    if (transition.warden) scheduleWardenCompletion();
    response.json({ state });
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

module.exports = { app, createTestState, gameId, startMultiServer, testPlayers };
