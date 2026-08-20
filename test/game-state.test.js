const test = require("node:test");
const assert = require("node:assert/strict");
const { createInitialGameState, rooms, spawnPoints } = require("../server/game/board");

test("a launched game snapshots the board and its lobby players", () => {
  const players = [
    { id: "10", username: "Ada", selected_character: "lovelace" },
    { id: "11", username: "Grace", selected_character: "curie" }
  ];
  const state = createInitialGameState(players);

  assert.equal(state.status, "initialized");
  assert.deepEqual(state.board, { rows: 24, cols: 30, rooms });
  assert.deepEqual(state.players, [
    { id: "10", username: "Ada", character: "lovelace", position: spawnPoints[0] },
    { id: "11", username: "Grace", character: "curie", position: spawnPoints[1] }
  ]);
});

test("creating initial state does not add gameplay fields", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  assert.deepEqual(Object.keys(state).sort(), ["board", "players", "status"]);
  assert.equal("turn" in state, false);
  assert.equal("evidence" in state, false);
});
