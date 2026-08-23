const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createInitialGameState,
  rooms,
  spawnPoints,
  rollMovementDie,
  movementDistances,
  movementPath,
  movePlayer,
  takeWardenTurn
} = require("../server/game/board");

test("a launched game snapshots the board and its lobby players", () => {
  const players = [
    { id: "10", username: "Ada", selected_character: "lovelace" },
    { id: "11", username: "Grace", selected_character: "curie" }
  ];
  const state = createInitialGameState(players, () => 0);

  assert.equal(state.status, "active");
  assert.deepEqual(state.board, { rows: 24, cols: 30, rooms });
  assert.deepEqual(state.players.map(({ id, username, character }) => ({ id, username, character })), [
    { id: "10", username: "Ada", character: "lovelace" },
    { id: "11", username: "Grace", character: "curie" }
  ]);
  assert.ok(spawnPoints.some(point =>
    point.row === state.players[0].position.row && point.col === state.players[0].position.col
  ));
  assert.notDeepEqual(state.players[0].position, state.players[1].position);
});

test("players receive randomized, exclusive spawn points", () => {
  const players = Array.from({ length: spawnPoints.length }, (_, index) => ({
    id: index + 1,
    username: `Player ${index + 1}`,
    selected_character: "curie"
  }));

  const state = createInitialGameState(players, () => 0.5);
  const positions = state.players.map(player => `${player.position.row},${player.position.col}`);

  assert.equal(new Set(positions).size, players.length);
  assert.notDeepEqual(state.players.map(player => player.position), spawnPoints);
});

test("a game cannot start without enough exclusive spawn points", () => {
  const players = Array.from({ length: spawnPoints.length + 1 }, (_, index) => ({ id: index }));
  assert.throws(() => createInitialGameState(players), /more players than available spawn points/i);
});

test("a game starts with the first player awaiting a 1d8 movement roll", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  assert.deepEqual(state.turn, {
    number: 1,
    playerIndex: 0,
    playerId: "1",
    phase: "awaiting_roll",
    die: { sides: 8, roll: null },
    movementRemaining: 0
  });
});

test("the Warden starts at tile 13,13 using Bonaparte's standing sprite", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  assert.deepEqual(state.warden, {
    character: "bonaparte",
    position: { row: 13, col: 13 },
    previousPosition: null,
    lastRoll: null,
    lastPath: [],
    turnsTaken: 0,
    dialogueEvent: null,
    dialogueEventId: 0,
    facing: "right"
  });
});

test("the current player rolls once and receives that many movement points", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  assert.equal(rollMovementDie(state, "1", () => 0.999), 8);
  assert.equal(state.turn.phase, "moving");
  assert.equal(state.turn.die.roll, 8);
  assert.equal(state.turn.movementRemaining, 8);
  assert.throws(() => rollMovementDie(state, "1"), /already been rolled/i);
});

test("a player cannot roll another player's movement die", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  assert.throws(() => rollMovementDie(state, "2"), /not this player's turn/i);
});

test("movement range uses orthogonal steps and excludes occupied tiles", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" },
    { id: 2, username: "Two" }
  ], () => 0);
  state.players[0].position = { row: 10, col: 10 };
  state.players[1].position = { row: 10, col: 11 };
  state.turn.movementRemaining = 2;
  const range = movementDistances(state, "1");

  assert.equal(range.get("10,12"), undefined);
  assert.equal(range.get("11,11"), 2);
  assert.equal(range.get("12,10"), 2);
});

test("a player cannot move onto or pass through another player", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" },
    { id: 2, username: "Two" }
  ]);
  state.players[0].position = { row: 10, col: 9 };
  state.players[1].position = { row: 10, col: 10 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 2;

  const range = movementDistances(state, "1");
  assert.equal(range.has("10,10"), false);
  assert.equal(range.has("10,11"), false);
  assert.throws(() => movePlayer(state, "1", { row: 10, col: 10 }), /outside/i);
});

test("the Warden's tile is excluded from player movement", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.players[0].position = { row: 13, col: 12 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;
  assert.equal(movementDistances(state, "1").has("13,13"), false);
  assert.throws(() => movePlayer(state, "1", { row: 13, col: 13 }), /outside/i);
});

test("the Warden rolls 1d4 and moves that many tiles inside his office", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  const path = takeWardenTurn(state, () => 0);

  assert.equal(state.warden.lastRoll, 1);
  assert.equal(state.warden.turnsTaken, 1);
  assert.equal(path.length, 1);
  assert.deepEqual(state.warden.previousPosition, { row: 13, col: 13 });
  assert.ok(path.every(tile => tile.row >= 8 && tile.row <= 17 && tile.col >= 12 && tile.col <= 19));
  assert.notDeepEqual(state.warden.position, { row: 12, col: 19 });
});

test("the Warden never returns to his previous occupied tile", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.warden.position = { row: 13, col: 14 };
  state.warden.previousPosition = { row: 13, col: 13 };
  const path = takeWardenTurn(state, () => 0.999);
  assert.ok(path.every(tile => tile.row !== 13 || tile.col !== 13));
});

test("the Warden takes a turn after the final active player", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" },
    { id: 2, username: "Two" }
  ]);
  state.players[0].position = { row: 1, col: 1 };
  state.players[1].position = { row: 2, col: 1 };
  state.turn.playerIndex = 1;
  state.turn.playerId = "2";
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;

  movePlayer(state, "2", { row: 2, col: 2 }, () => 0);
  assert.equal(state.turn.playerId, "1");
  assert.equal(state.turn.phase, "awaiting_roll");
  assert.equal(state.warden.lastRoll, 1);
  assert.equal(state.warden.lastPath.length, 1);
});

test("moving costs one point per grid location and retains unused movement", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.players[0].position = { row: 10, col: 10 };
  rollMovementDie(state, "1", () => 0.5);

  assert.equal(movePlayer(state, "1", { row: 12, col: 10 }), 2);
  assert.deepEqual(state.players[0].position, { row: 12, col: 10 });
  assert.equal(state.turn.movementRemaining, 3);
  assert.equal(state.turn.phase, "moving");
});

test("movement animation paths contain only legal orthogonal steps", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" },
    { id: 2, username: "Two" }
  ]);
  state.players[0].position = { row: 10, col: 9 };
  state.players[1].position = { row: 10, col: 10 };
  state.turn.movementRemaining = 4;

  const path = movementPath(state, "1", { row: 10, col: 11 });
  const completePath = [state.players[0].position, ...path];
  assert.equal(path.length, 4);
  assert.ok(path.every(tile => tile.row !== 10 || tile.col !== 10));
  assert.ok(completePath.slice(1).every((tile, index) => {
    const previousTile = completePath[index];
    return Math.abs(tile.row - previousTile.row) + Math.abs(tile.col - previousTile.col) === 1;
  }));
});

test("characters face left for lower columns and reset right for higher columns", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.players[0].position = { row: 10, col: 10 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 4;

  movePlayer(state, "1", { row: 10, col: 9 });
  assert.equal(state.players[0].facing, "left");
  movePlayer(state, "1", { row: 10, col: 11 });
  assert.equal(state.players[0].facing, "right");
});

test("using all movement advances to the next player's roll phase", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" },
    { id: 2, username: "Two" }
  ]);
  state.players[0].position = { row: 10, col: 10 };
  state.players[1].position = { row: 20, col: 20 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;

  movePlayer(state, "1", { row: 9, col: 10 });
  assert.equal(state.turn.playerId, "2");
  assert.equal(state.turn.phase, "awaiting_roll");
  assert.equal(state.turn.number, 2);
});

test("a diagonal destination costs two orthogonal movement points", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.players[0].position = { row: 10, col: 10 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;
  assert.throws(() => movePlayer(state, "1", { row: 11, col: 11 }), /outside/i);
});

test("a hallway player's range stops at the room door", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.players[0].position = { row: 8, col: 27 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;

  const oneStepRange = movementDistances(state, "1");
  assert.equal(oneStepRange.has("7,27"), false);
  assert.equal(oneStepRange.has("8,28"), true);

  state.turn.movementRemaining = 3;
  const throughDoorRange = movementDistances(state, "1");
  assert.equal(throughDoorRange.get("7,28"), 2);
  assert.equal(throughDoorRange.has("7,27"), false);
});

test("entering a door spends all remaining movement and ends the turn", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" },
    { id: 2, username: "Two" }
  ]);
  state.players[0].position = { row: 8, col: 28 };
  state.players[1].position = { row: 20, col: 20 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 6;

  assert.equal(movePlayer(state, "1", { row: 7, col: 28 }), 6);
  assert.deepEqual(state.players[0].position, { row: 7, col: 28 });
  assert.equal(state.players[0].dialogueEvent, "door_open");
  assert.equal(state.players[0].dialogueEventId, 1);
  assert.equal(state.turn.playerId, "2");
  assert.equal(state.turn.phase, "awaiting_roll");
});

test("entering the Warden's office triggers Bonaparte's enter dialogue", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.players[0].position = { row: 12, col: 20 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;

  assert.equal(movePlayer(state, "1", { row: 12, col: 19 }), 1);
  assert.equal(state.players[0].dialogueEvent, null);
  assert.equal(state.players[0].dialogueEventId, 0);
  assert.equal(state.warden.dialogueEvent, "enter");
  assert.equal(state.warden.dialogueEventId, 1);
});

test("a player beginning a turn on a door can move into its room", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.players[0].position = { row: 7, col: 28 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;
  assert.equal(movementDistances(state, "1").get("6,28"), 1);
});

test("the server rejects a direct move through a room wall", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.players[0].position = { row: 8, col: 27 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;
  assert.throws(() => movePlayer(state, "1", { row: 7, col: 27 }), /outside/i);
});

test("rooms expose a blockedTile list for art obstacles", () => {
  assert.ok(rooms.every(room => Array.isArray(room.blockedTile)));
  assert.ok(rooms.every(room => room.blockedTile.every(tile =>
    Number.isInteger(tile.row) && Number.isInteger(tile.col)
  )));
});

test("blocked room tiles are excluded from legal movement and cannot be crossed", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.board.rooms = JSON.parse(JSON.stringify(state.board.rooms));
  const cafeteria = state.board.rooms.find(room => room.name === "Cafeteria");
  cafeteria.blockedTile.push({ row: 6, col: 27 });
  state.players[0].position = { row: 6, col: 28 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 2;

  const range = movementDistances(state, "1");
  assert.equal(range.has("6,27"), false);
  assert.throws(() => movePlayer(state, "1", { row: 6, col: 27 }), /outside/i);
  assert.equal(range.has("6,26"), false);
  assert.equal(range.get("5,27"), 2);
});

test("entering a secret passage teleports to another passage and triggers dialogue", () => {
  const state = createInitialGameState([{ id: 1, username: "Player", selected_character: "curie" }]);
  state.players[0].position = { row: 2, col: 24 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 3;

  movePlayer(state, "1", { row: 2, col: 23 }, () => 0);
  assert.deepEqual(state.players[0].position, { row: 23, col: 3 });
  assert.equal(state.players[0].dialogueEvent, "secret_passage_entry");
  assert.equal(state.players[0].dialogueEventId, 1);
  assert.equal(state.turn.movementRemaining, 2);
});

test("an occupied secret passage uses an available adjacent tile, including diagonals", () => {
  const state = createInitialGameState([
    { id: 1, username: "One", selected_character: "curie" },
    { id: 2, username: "Two", selected_character: "rasputin" }
  ]);
  state.players[0].position = { row: 2, col: 24 };
  state.players[1].position = { row: 23, col: 3 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 3;

  movePlayer(state, "1", { row: 2, col: 23 }, () => 0);
  assert.deepEqual(state.players[0].position, { row: 22, col: 2 });
  assert.notDeepEqual(state.players[0].position, state.players[1].position);
});

test("a player cannot re-enter the secret passage they emerged from during the same turn", () => {
  const state = createInitialGameState([{ id: 1, username: "Player", selected_character: "curie" }]);
  state.players[0].position = { row: 2, col: 24 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 4;

  movePlayer(state, "1", { row: 2, col: 23 }, () => 0);
  assert.deepEqual(state.players[0].secretPassageCooldown, { row: 23, col: 3 });
  movePlayer(state, "1", { row: 22, col: 3 }, () => 0);
  assert.equal(movementDistances(state, "1").has("23,3"), false);
  assert.throws(() => movePlayer(state, "1", { row: 23, col: 3 }), /outside/i);
});

test("a secret passage can be entered again on the player's next turn", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" },
    { id: 2, username: "Two" }
  ]);
  state.players[0].secretPassageCooldown = { row: 23, col: 3 };
  state.players[1].position = { row: 10, col: 10 };
  state.turn.playerIndex = 1;
  state.turn.playerId = "2";
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;

  movePlayer(state, "2", { row: 11, col: 10 }, () => 0);
  assert.equal(state.turn.playerId, "1");
  assert.equal(state.players[0].secretPassageCooldown, null);
});
