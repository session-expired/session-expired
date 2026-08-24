const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { characters } = require("./lobby/characters");
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
  submitAccusation
} = require("./game/board");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3002;
const hostname = process.env.HOST || "127.0.0.1";
const publicDirectory = path.join(__dirname, "..", "public");
const gameId = "1";
const user = { id: "1", username: "user1" };
const selectedCharacter = characters[Math.floor(Math.random() * characters.length)];
const state = createInitialGameState([{
  id: user.id,
  username: user.username,
  selected_character: selectedCharacter.id
}], Math.random, { id: gameId, name: "Development Lobby" });
let wardenTimer = null;

function scheduleWardenCompletion() {
  if (wardenTimer) return;
  wardenTimer = setTimeout(() => {
    wardenTimer = null;
    completeWardenTurn(state);
    if (state.turn.phase === "warden") scheduleWardenCompletion();
  }, 1200);
}

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

app.get("/", (request, response) => response.redirect(`/game/${gameId}`));
app.get(`/game/${gameId}`, (request, response) => {
  response.sendFile(path.join(publicDirectory, "pages", "game.html"));
});

app.get("/api/session", (request, response) => {
  response.json({
    authenticated: true,
    user,
    activeGame: { id: gameId, url: `/game/${gameId}` }
  });
});
app.get("/api/users", (request, response) => response.json({ users: [] }));
app.get(`/api/games/${gameId}`, (request, response) => {
  response.json({
    game: { id: gameId, state, created_at: new Date(0).toISOString() },
    currentUserId: user.id
  });
});
app.post(`/api/games/${gameId}/roll`, (request, response) => {
  try {
    const roll = rollMovementDie(state, user.id);
    response.json({ roll, state });
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});
app.post(`/api/games/${gameId}/move`, (request, response) => {
  try {
    const path = movementPath(state, user.id, request.body);
    const cost = movePlayer(state, user.id, request.body);
    response.json({ cost, distance: path.length, path, state });
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});
app.post(`/api/games/${gameId}/hints/:hintId`, (request, response) => {
  try {
    const result = discoverHint(state, user.id, request.params.hintId);
    response.json({ ...result, state });
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});
app.post(`/api/games/${gameId}/end-turn`, (request, response) => {
  try {
    const transition = endPlayerTurn(state, user.id);
    if (transition.warden) scheduleWardenCompletion();
    response.json({ state });
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});
app.post(`/api/games/${gameId}/accuse`, (request, response) => {
  try {
    const correct = submitAccusation(state, user.id, request.body);
    if (!correct && state.turn.phase === "warden") scheduleWardenCompletion();
    response.json({ correct, state });
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});
app.post(`/api/games/${gameId}/quit`, (request, response) => {
  response.json({ ok: true, redirect: `/game/${gameId}` });
});
app.get("/api/board", (request, response) => response.json({
  rooms, spawnPoints, secretPass, blockedTiles, searchItems
}));

app.use("/css", express.static(path.join(publicDirectory, "css"), { fallthrough: false }));
app.use("/assets", express.static(path.join(publicDirectory, "assets"), { fallthrough: false }));
app.get("/js/chat.js", (request, response) => {
  response.sendFile(path.join(publicDirectory, "js", "chat.js"));
});
app.use("/js/game", express.static(path.join(publicDirectory, "js", "game"), { fallthrough: false }));

app.use((request, response) => response.status(404).type("text").send("Not found"));

io.on("connection", (socket) => {
  socket.emit("global-history", []);

  socket.on("join-game-chat", ({ gameId: requestedGameId } = {}) => {
    if (String(requestedGameId) !== gameId) return;
    socket.join(`game:${gameId}`);
    socket.emit("game-chat-ready", { gameId: Number(gameId) });
    socket.emit("game-history", []);
  });

  function sendMessage(channel, text) {
    if (typeof text !== "string" || !text.trim()) return;
    const message = {
      senderId: user.id,
      sender: user.username,
      text: text.trim().slice(0, 500),
      sentAt: new Date().toISOString()
    };
    if (channel === "game") io.to(`game:${gameId}`).emit("game-message", message);
    else io.emit("global-message", message);
  }

  socket.on("global-message", ({ text } = {}) => sendMessage("global", text));
  socket.on("game-message", ({ text } = {}) => sendMessage("game", text));
});

function startGameDevServer() {
  server.listen(port, hostname, () => {
    console.log(`Game dev route: http://${hostname}:${port}/game/${gameId}`);
    console.log(`Signed in as user1 · character: ${selectedCharacter.id}`);
  });
}

if (require.main === module) startGameDevServer();

module.exports = { app, server, startGameDevServer, state, user };
