const assert = require("node:assert/strict");
const test = require("node:test");

process.env.MULTI_TEST_MODE = "true";
const packageJson = require("../package.json");
const { app, createTestState, gameId, testPlayers } = require("../multi/multi-server");
const { submitAccusation } = require("../server/game/board");
const { controlledPlayerId } = require("../multi/turn-controller");

test("npm run multi uses the isolated four-player server", () => {
  assert.equal(packageJson.scripts.multi, "node multi/start.js");
  assert.equal(gameId, "multi-test");
  assert.equal(testPlayers.length, 4);
  assert.deepEqual(createTestState().players.map(player => player.id), testPlayers.map(player => player.id));
});

test("multi mode exposes no normal login or lobby routes", () => {
  const paths = app._router.stack.filter(layer => layer.route).map(layer => layer.route.path);
  assert.ok(paths.includes("/__multi/multi-test"));
  assert.ok(!paths.includes("/login"));
  assert.ok(!paths.includes("/lobby"));
});

test("shared accusation logic records the discovering player and finishes the game", () => {
  const state = createTestState();
  state.turn.playerId = "test-player-2";
  state.turn.playerIndex = state.turn.order.indexOf("test-player-2");
  state.players.find(player => player.id === "test-player-2").position = { row: 13, col: 12 };
  const correct = submitAccusation(state, "test-player-2", { ...state.solution });
  assert.equal(correct, true);
  assert.equal(state.status, "finished");
  assert.deepEqual(state.winner, { id: "test-player-2", username: "Player 2", character: "lovelace" });
});

test("a wrong accusation relocates that player and marks one turn to skip", () => {
  const state = createTestState();
  state.turn.playerId = "test-player-1";
  state.turn.playerIndex = state.turn.order.indexOf("test-player-1");
  state.players.find(player => player.id === "test-player-1").position = { row: 13, col: 12 };
  const wrongKiller = state.solution.killer === "crowley" ? "curie" : "crowley";
  assert.equal(submitAccusation(state, "test-player-1", { ...state.solution, killer: wrongKiller }, () => 0), false);
  assert.equal(state.players[0].canAccuse, true);
  assert.equal(state.players[0].turnsToSkip, 1);
  assert.equal(state.players[1].canAccuse, true);
  assert.equal(state.status, "active");
  assert.notEqual(state.turn.playerId, "test-player-1");
});

test("the harness follows only the authoritative active player", () => {
  const playerIds = testPlayers.map(player => player.id);
  const state = createTestState();
  for (const playerId of state.turn.order) {
    state.turn.playerId = playerId;
    state.turn.phase = "awaiting_roll";
    assert.equal(controlledPlayerId(state, playerIds), playerId);
  }
  state.turn.playerId = null;
  for (const phase of ["transition", "warden", "finished"]) {
    state.turn.phase = phase;
    assert.equal(controlledPlayerId(state, playerIds), null);
  }
});

test("the harness never controls an identity outside its local test players", () => {
  const state = createTestState();
  state.turn.playerId = "unknown-player";
  assert.equal(controlledPlayerId(state, testPlayers.map(player => player.id)), null);
});
