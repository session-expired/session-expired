const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createInitialGameState,
  hintCatalog,
  hintSupportsSolution,
  solutionPools,
  createSolution,
  rooms,
  spawnPoints,
  blockedTiles,
  searchItems,
  blockingAreaAt,
  rollMovementDie,
  movementDistances,
  movementPath,
  movePlayer,
  takeWardenTurn,
  endPlayerTurn,
  completeWardenTurn,
  removePlayerFromGame,
  discoverHint,
  validateHintDistribution,
  submitAccusation
} = require("../server/game/board");

test("a launched game snapshots the board and its lobby players", () => {
  const players = [
    { id: "10", username: "Ada", selected_character: "lovelace" },
    { id: "11", username: "Grace", selected_character: "curie" }
  ];
  const state = createInitialGameState(players, () => 0, { id: 27, name: "The Broken Window" });

  assert.equal(state.status, "active");
  assert.equal(state.lobbyId, "27");
  assert.equal(state.lobbyName, "The Broken Window");
  assert.equal(state.board.rows, 24);
  assert.equal(state.board.cols, 30);
  assert.deepEqual(state.board.rooms.map(room => room.id), rooms.map(room => room.id));
  assert.deepEqual(state.players.map(({ id, username, character }) => ({ id, username, character })), [
    { id: "10", username: "Ada", character: "lovelace" },
    { id: "11", username: "Grace", character: "curie" }
  ]);
  assert.ok(spawnPoints.some(point =>
    point.row === state.players[0].position.row && point.col === state.players[0].position.col
  ));
  assert.notDeepEqual(state.players[0].position, state.players[1].position);
  assert.ok(state.players.every(player => player.canAccuse));
  assert.ok(state.players.every(player => player.turnsToSkip === 0));
  assert.ok(state.players.every(player => Array.isArray(player.discoveredHintIds)));
  assert.ok(state.players.every(player => Array.isArray(player.discoveredHints)));
  assert.ok(state.players.every(player => player.discoveredHints.length === hintCatalog.categories.length));
  assert.ok(state.players.every(player =>
    hintCatalog.categories.every(category => player.discoveredHints.filter(hint => hint.category === category).length === 1)
  ));
  assert.deepEqual(state.solution, {
    killer: "brahe",
    victim: "nicholas_ii",
    room: "hydrotherapy",
    method: "electrocuted"
  });
  assert.equal(state.winner, null);
  assert.equal(state.fullRounds, 0);
  assert.equal(state.endedAt, null);
  assert.equal(typeof state.createdAt, "number");
});

test("each lobby receives its own game solution snapshot", () => {
  const players = [{ id: 1, username: "Player", selected_character: "curie" }];
  const first = createInitialGameState(players, () => 0, { id: 1, name: "Lobby One" });
  const second = createInitialGameState(players, () => 0, { id: 2, name: "Lobby Two" });

  first.solution.killer = "crowley";

  assert.equal(first.lobbyName, "Lobby One");
  assert.equal(second.lobbyName, "Lobby Two");
  assert.equal(second.solution.killer, "brahe");
});

test("rooms expose stable IDs and hint links", () => {
  assert.deepEqual(rooms.map(room => room.id), [
    "wardens_office", "padded_cell", "cafeteria", "operating_theater", "rec_room",
    "showers", "solitary_confinement", "hydrotherapy", "electrotherapy"
  ]);
  assert.ok(rooms.every(room => Array.isArray(room.hintIds)));
});

test("a game's populated hints never rule out its correct accusation", () => {
  const state = createInitialGameState([
    { id: "1", username: "Ada", selected_character: "lovelace" }
  ], () => 0);
  const activeHintIds = state.board.rooms.flatMap(room => room.hintIds);

  assert.ok(activeHintIds.length > 0);
  for (const hintId of activeHintIds) {
    const hint = hintCatalog.hints.find(candidate => candidate.id === hintId);
    assert.ok(hintSupportsSolution(hint, state.solution), `${hintId} contradicts the solution`);
  }
});

test("all active hints are distributed exactly once among search items", () => {
  const state = createInitialGameState([
    { id: "1", username: "Ada", selected_character: "lovelace" }
  ], () => 0.5);
  const activeHintIds = state.board.rooms.flatMap(room => room.hintIds).sort();
  const distributedHintIds = state.board.searchItems.flatMap(item => item.hintIds).sort();

  assert.ok(state.board.searchItems.length > 1);
  assert.deepEqual(distributedHintIds, activeHintIds);
  assert.equal(new Set(distributedHintIds).size, distributedHintIds.length);
});

test("starting hints are unique between four players and never placed on the board", () => {
  const players = Array.from({ length: 4 }, (_, index) => ({ id: index + 1, username: `Player ${index + 1}` }));
  const state = createInitialGameState(players, () => 0.5);
  const boardHintIds = new Set(state.board.searchItems.flatMap(item => item.hintIds));

  for (const category of hintCatalog.categories) {
    const dealt = state.players.map(player => player.discoveredHints.find(hint => hint.category === category).id);
    assert.equal(new Set(dealt).size, 4);
    assert.ok(dealt.every(hintId => !boardHintIds.has(hintId)));
  }
});

test("the hint catalog uses valid categories, rooms, and accusation options", () => {
  const optionsByCategory = {
    murderer: solutionPools.killers,
    victim: solutionPools.victims,
    room: solutionPools.rooms,
    method: solutionPools.methods
  };

  for (const hint of hintCatalog.hints) {
    assert.ok(hintCatalog.categories.includes(hint.category));
    assert.ok(hintCatalog.roomIds.includes(hint.roomId));
    assert.ok(optionsByCategory[hint.category].some(option => option.id === hint.excludes));
  }
});

test("a player discovers and depletes a search-item hint from an adjacent tile", () => {
  const state = createInitialGameState([
    { id: "1", username: "Ada", selected_character: "lovelace" },
    { id: "2", username: "Grace", selected_character: "curie" }
  ], () => 0);
  const player = state.players.find(candidate => candidate.id === state.turn.playerId);
  player.position = { row: 3, col: 2 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 4;
  const catalog = {
    categories: ["murderer", "victim", "room", "method"],
    roomIds: rooms.map(room => room.id),
    hints: [{
      id: "muddy_cuff", category: "murderer", roomId: "rec_room",
      text: "A muddy cuff.", excludes: "mallon"
    }]
  };
  state.board.searchItems = [{
    id: "desk", rows: { start: 3, end: 3 }, cols: { start: 3, end: 4 },
    description: "A desk.", roomId: "rec_room", hintIds: ["muddy_cuff"]
  }];
  const startingHintIds = [...player.discoveredHintIds];
  const startingHints = [...player.discoveredHints];

  const first = discoverHint(state, player.id, "desk", catalog);
  state.turn.phase = "moving";
  state.turn.movementRemaining = 2;
  const second = discoverHint(state, player.id, "desk", catalog);

  assert.equal(first.empty, false);
  assert.equal(second.empty, true);
  assert.deepEqual(state.board.searchItems[0].hintIds, []);
  assert.deepEqual(player.discoveredHintIds, [...startingHintIds, "muddy_cuff"]);
  assert.deepEqual(player.discoveredHints, [...startingHints, {
    id: "muddy_cuff",
    category: "murderer",
    text: "A muddy cuff.",
    excludes: "mallon",
    searchItemId: "desk"
  }]);
  assert.equal(state.turn.movementRemaining, 0);
  assert.equal(state.turn.phase, "awaiting_end");
});

test("generated hint distributions are solvable, protect answers, and respect capacity", () => {
  for (let index = 0; index < 100; index++) {
    let seed = index + 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const state = createInitialGameState([{ id: "1", username: "Ada" }], random);
    assert.equal(validateHintDistribution(state), true);
    assert.ok(state.board.searchItems.every(item => item.hintIds.length <= 7));
  }
});

test("searches award at most two shared hints and empty searches trigger dialogue", () => {
  const state = createInitialGameState([{ id: "1", username: "Ada", selected_character: "lovelace" }], () => 0);
  const player = state.players[0];
  const item = state.board.searchItems.find(source => source.roomId === "rec_room");
  const validIds = hintCatalog.hints.filter(hint => hintSupportsSolution(hint, state.solution)).slice(0, 5).map(hint => hint.id);
  item.hintIds = [...validIds];
  player.position = { row: item.rows.start - 1, col: item.cols.start };
  state.turn.playerId = player.id;
  const remaining = [];
  for (let search = 0; search < 4; search++) {
    state.turn.phase = "moving";
    state.turn.movementRemaining = 3;
    const result = discoverHint(state, player.id, item.id);
    remaining.push(item.hintIds.length);
    assert.ok(result.hints.length <= 2);
  }
  assert.deepEqual(remaining, [3, 1, 0, 0]);
  assert.equal(player.dialogueEvent, "empty_search");
  assert.equal(player.dialogueEventId, 1);
  assert.equal(state.turn.movementRemaining, 0);
});

test("hints cannot be collected away from their search item or by an inactive player", () => {
  const state = createInitialGameState([
    { id: "1", username: "Ada", selected_character: "lovelace" },
    { id: "2", username: "Grace", selected_character: "curie" }
  ], () => 0);
  const current = state.players.find(candidate => candidate.id === state.turn.playerId);
  const inactive = state.players.find(candidate => candidate.id !== state.turn.playerId);
  current.position = { row: 7, col: 8 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 3;
  const catalog = {
    categories: ["murderer", "victim", "room", "method"],
    roomIds: rooms.map(room => room.id),
    hints: [{ id: "muddy_cuff", category: "murderer", roomId: "rec_room", text: "A muddy cuff." }]
  };
  state.board.searchItems = [{
    id: "desk", rows: { start: 3, end: 3 }, cols: { start: 3, end: 4 },
    description: "A desk.", roomId: "rec_room", hintIds: ["muddy_cuff"]
  }];
  const currentHints = [...current.discoveredHintIds];
  const inactiveHints = [...inactive.discoveredHintIds];

  assert.throws(() => discoverHint(state, current.id, "muddy_cuff", catalog), /adjacent to the search item/);
  assert.throws(() => discoverHint(state, inactive.id, "muddy_cuff", catalog), /not this player's turn/);
  assert.deepEqual(current.discoveredHintIds, currentHints);
  assert.deepEqual(inactive.discoveredHintIds, inactiveHints);
});

test("a search item is unavailable outside its associated room", () => {
  const state = createInitialGameState([{ id: "1", username: "Ada" }], () => 0.5);
  const player = state.players[0];
  player.position = { row: 3, col: 2 };
  state.turn.playerId = player.id;
  state.turn.phase = "moving";
  state.turn.movementRemaining = 3;
  const hint = hintCatalog.hints.find(candidate => hintSupportsSolution(candidate, state.solution));
  state.board.searchItems = [{
    id: "misplaced_desk",
    rows: { start: 3, end: 3 },
    cols: { start: 3, end: 3 },
    description: "A desk assigned to another room.",
    roomId: "cafeteria",
    hintIds: [hint.id]
  }];
  const startingHintIds = [...player.discoveredHintIds];

  assert.throws(() => discoverHint(state, player.id, hint.id), /current room/);
  assert.deepEqual(player.discoveredHintIds, startingHintIds);
  assert.equal(state.turn.movementRemaining, 3);
});

test("a game solution draws all four accusation fields from their pools", () => {
  const first = createSolution(() => 0);
  const last = createSolution(() => 0.999999);
  for (const [field, poolName] of [["killer", "killers"], ["victim", "victims"], ["room", "rooms"], ["method", "methods"]]) {
    assert.ok(solutionPools[poolName].some(option => option.id === first[field]));
    assert.ok(solutionPools[poolName].some(option => option.id === last[field]));
    assert.notEqual(first[field], last[field]);
  }
  assert.ok(solutionPools.rooms.every(room => room.id !== "wardens_office"));
});

test("players receive randomized, exclusive spawn points", () => {
  const players = Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    username: `Player ${index + 1}`,
    selected_character: "curie"
  }));

  const state = createInitialGameState(players, () => 0.5);
  const positions = state.players.map(player => `${player.position.row},${player.position.col}`);

  assert.equal(new Set(positions).size, players.length);
  assert.notDeepEqual(state.players.map(player => player.position), spawnPoints);
});

test("a game cannot start with more than four players", () => {
  const players = Array.from({ length: 5 }, (_, index) => ({ id: index }));
  assert.throws(() => createInitialGameState(players), /at most 4 players/i);
});

test("a game starts with the first player awaiting a 1d8 movement roll", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  assert.deepEqual(state.turn, {
    number: 1,
    round: 1,
    order: ["1"],
    playerIndex: 0,
    playerId: "1",
    phase: "awaiting_roll",
    die: { sides: 8, roll: null },
    movementRemaining: 0,
    visitedPositions: []
  });
});

test("turn order is shuffled once and remains stable across rounds", () => {
  const players = [1, 2, 3, 4].map(id => ({ id, username: `Player ${id}` }));
  const state = createInitialGameState(players, () => 0);
  assert.deepEqual(state.turn.order, ["2", "3", "4", "1"]);
  const originalOrder = [...state.turn.order];
  for (const id of originalOrder) {
    assert.equal(state.turn.playerId, id);
    state.turn.phase = "awaiting_end";
    state.turn.movementRemaining = 0;
    endPlayerTurn(state, id, () => 0);
  }
  assert.equal(state.turn.phase, "warden");
  assert.equal(state.turn.playerId, null);
  assert.equal(completeWardenTurn(state), true);
  assert.deepEqual(state.turn.order, originalOrder);
  assert.equal(state.turn.playerId, originalOrder[0]);
  assert.equal(state.turn.round, 2);
});

test("ending a turn is locked immediately and cannot be applied twice", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" }, { id: 2, username: "Two" }
  ], () => 0.999);
  state.turn.phase = "awaiting_end";
  endPlayerTurn(state, "1");
  assert.equal(state.turn.playerId, "2");
  assert.throws(() => endPlayerTurn(state, "1"), /not this player's turn/i);
  assert.throws(() => movePlayer(state, "1", { row: 1, col: 1 }), /not this player's turn|roll/i);
});

test("a current player who leaves is skipped without deadlocking the turn", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" }, { id: 2, username: "Two" }, { id: 3, username: "Three" }
  ], () => 0.999);
  assert.equal(state.turn.playerId, "1");
  removePlayerFromGame(state, "1");
  assert.equal(state.turn.playerId, "2");
  assert.deepEqual(state.turn.order, ["2", "3"]);
});

test("a finished game cannot be reactivated by a stale Warden completion", () => {
  const state = createInitialGameState([{ id: 1, username: "One" }]);
  state.turn.phase = "awaiting_end";
  endPlayerTurn(state, "1", () => 0);
  state.status = "finished";
  state.turn.phase = "finished";
  assert.equal(completeWardenTurn(state), false);
  assert.equal(state.turn.playerId, null);
});

test("accusations are restricted to the active player", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" }, { id: 2, username: "Two" }
  ], () => 0.999);
  state.players[1].position = { row: 13, col: 12 };
  assert.throws(() => submitAccusation(state, "2", state.solution), /not this player's turn/i);
});

test("the active player must be orthogonally adjacent to the Warden to accuse", () => {
  const state = createInitialGameState([{ id: 1, username: "One" }]);
  state.players[0].position = { row: 13, col: 11 };
  assert.throws(() => submitAccusation(state, "1", state.solution), /adjacent to the Warden/i);
  state.players[0].position = { row: 12, col: 12 };
  assert.throws(() => submitAccusation(state, "1", state.solution), /adjacent to the Warden/i);
  state.players[0].position = { row: 13, col: 12 };
  assert.equal(submitAccusation(state, "1", state.solution), true);
});

test("current Warden position is used for accusation eligibility", () => {
  const state = createInitialGameState([{ id: 1, username: "One" }]);
  state.players[0].position = { row: 13, col: 12 };
  state.warden.position = { row: 13, col: 14 };
  assert.throws(() => submitAccusation(state, "1", state.solution), /adjacent to the Warden/i);
});

test("an incorrect accusation returns the player to a spawn and consumes the turn", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" }, { id: 2, username: "Two" }
  ], () => 0.999);
  state.players[0].position = { row: 13, col: 12 };
  const positionBefore = { ...state.players[0].position };
  const wrongKiller = state.solution.killer === "crowley" ? "curie" : "crowley";
  assert.equal(submitAccusation(state, "1", { ...state.solution, killer: wrongKiller }, () => 0), false);
  assert.equal(state.players[0].canAccuse, true);
  assert.equal(state.players[0].turnsToSkip, 1);
  assert.notDeepEqual(state.players[0].position, positionBefore);
  assert.ok(spawnPoints.some(point =>
    point.row === state.players[0].position.row && point.col === state.players[0].position.col
  ));
  assert.notDeepEqual(state.players[0].position, state.players[1].position);
  assert.equal(state.turn.playerId, "2");
  assert.throws(
    () => submitAccusation(state, "1", state.solution),
    /not this player's turn/i
  );
});

test("a bad accuser loses exactly their next turn", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" }, { id: 2, username: "Two" }
  ], () => 0.999);
  state.players[0].position = { row: 13, col: 12 };
  const wrongKiller = state.solution.killer === "crowley" ? "curie" : "crowley";
  submitAccusation(state, "1", { ...state.solution, killer: wrongKiller }, () => 0);
  state.turn.phase = "awaiting_end";
  endPlayerTurn(state, "2", () => 0);
  assert.equal(state.turn.phase, "warden");

  completeWardenTurn(state, () => 0);
  assert.equal(state.turn.playerId, "2");
  assert.equal(state.players[0].turnsToSkip, 0);
  state.turn.phase = "awaiting_end";
  endPlayerTurn(state, "2", () => 0);
  completeWardenTurn(state, () => 0);
  assert.equal(state.turn.playerId, "1");
});

test("a correct accusation finishes the turn state without advancing", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" }, { id: 2, username: "Two" }
  ], () => 0.999);
  state.players[0].position = { row: 13, col: 12 };
  assert.equal(submitAccusation(state, "1", state.solution), true);
  assert.equal(state.status, "finished");
  assert.equal(state.turn.phase, "finished");
  assert.equal(state.turn.playerId, null);
  assert.equal(typeof state.endedAt, "number");
  assert.equal(completeWardenTurn(state), false);
});

test("the murder room is required for a correct accusation", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" }, { id: 2, username: "Two" }
  ], () => 0);
  const activePlayer = state.players.find(player => player.id === state.turn.playerId);
  activePlayer.position = { row: 13, col: 12 };
  const wrongRoom = solutionPools.rooms.find(room => room.id !== state.solution.room).id;

  assert.equal(submitAccusation(state, activePlayer.id, { ...state.solution, room: wrongRoom }), false);
  assert.equal(state.winner, null);
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
  assert.deepEqual(state.turn.visitedPositions, [state.players[0].position]);
  assert.throws(() => rollMovementDie(state, "1"), /already been rolled/i);
});

test("a player cannot end their turn while movement points remain", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  rollMovementDie(state, "1", () => 0.5);
  assert.throws(() => endPlayerTurn(state, "1"), /use all movement points/i);
  assert.equal(state.turn.playerId, "1");
  assert.equal(state.turn.movementRemaining, 5);
});

test("a player with no remaining legal moves may end their turn", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" },
    { id: 2, username: "Two" },
    { id: 3, username: "Three" },
    { id: 4, username: "Four" }
  ], () => 0.999);
  state.players[0].position = { row: 1, col: 1 };
  state.players[1].position = { row: 1, col: 2 };
  state.players[2].position = { row: 2, col: 1 };
  state.players[3].position = { row: 20, col: 20 };
  state.turn.order = ["1", "2", "3", "4"];
  state.turn.playerId = "1";
  state.turn.playerIndex = 0;
  state.turn.phase = "moving";
  state.turn.movementRemaining = 6;
  state.turn.visitedPositions = [{ row: 1, col: 1 }];

  assert.equal(movementDistances(state, "1").size, 0);
  assert.doesNotThrow(() => endPlayerTurn(state, "1"));
  assert.equal(state.turn.playerId, "2");
});

test("a player cannot revisit or path through a position used earlier in the same turn", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.players[0].position = { row: 18, col: 10 };
  rollMovementDie(state, "1", () => 0.5);
  movePlayer(state, "1", { row: 18, col: 11 });
  movePlayer(state, "1", { row: 18, col: 12 });

  assert.deepEqual(state.turn.visitedPositions, [
    { row: 18, col: 10 }, { row: 18, col: 11 }, { row: 18, col: 12 }
  ]);
  assert.equal(movementDistances(state, "1").has("18,11"), false);
  assert.equal(movementDistances(state, "1").has("18,10"), false);
  assert.throws(() => movePlayer(state, "1", { row: 18, col: 11 }), /outside/i);
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
  state.turn.playerId = "1";
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
  assert.equal(state.fullRounds, 1);
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
  state.players[0].position = { row: 4, col: 1 };
  state.players[1].position = { row: 3, col: 1 };
  state.turn.playerIndex = 1;
  state.turn.order = ["1", "2"];
  state.turn.playerId = "2";
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;

  movePlayer(state, "2", { row: 3, col: 2 }, () => 0);
  assert.equal(state.turn.phase, "awaiting_end");
  endPlayerTurn(state, "2", () => 0);
  assert.equal(state.turn.playerId, null);
  assert.equal(state.turn.phase, "warden");
  assert.equal(state.warden.lastRoll, 1);
  assert.equal(state.warden.lastPath.length, 1);
  assert.equal(completeWardenTurn(state), true);
  assert.equal(state.turn.playerId, "1");
  assert.equal(state.turn.round, 2);
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

test("using all movement requires an explicit end turn before the next player is active", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" },
    { id: 2, username: "Two" }
  ]);
  state.players[0].position = { row: 10, col: 10 };
  state.players[1].position = { row: 20, col: 20 };
  state.turn.order = ["1", "2"];
  state.turn.playerId = "1";
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;

  movePlayer(state, "1", { row: 9, col: 10 });
  assert.equal(state.turn.playerId, "1");
  assert.equal(state.turn.phase, "awaiting_end");
  endPlayerTurn(state, "1");
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

test("entering a door spends all remaining movement and awaits explicit end turn", () => {
  const state = createInitialGameState([
    { id: 1, username: "One" },
    { id: 2, username: "Two" }
  ]);
  state.players[0].position = { row: 8, col: 28 };
  state.players[1].position = { row: 20, col: 20 };
  state.turn.order = ["1", "2"];
  state.turn.playerId = "1";
  state.turn.phase = "moving";
  state.turn.movementRemaining = 6;

  assert.equal(movePlayer(state, "1", { row: 7, col: 28 }), 6);
  assert.deepEqual(state.players[0].position, { row: 7, col: 28 });
  assert.equal(state.players[0].dialogueEvent, "door_open");
  assert.equal(state.players[0].dialogueEventId, 1);
  assert.equal(state.turn.playerId, "1");
  assert.equal(state.turn.phase, "awaiting_end");
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
  state.players[0].position = { row: 7, col: 7 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;
  assert.equal(movementDistances(state, "1").get("6,7"), 1);
});

test("the server rejects a direct move through a room wall", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.players[0].position = { row: 8, col: 27 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;
  assert.throws(() => movePlayer(state, "1", { row: 7, col: 27 }), /outside/i);
});

test("blocked areas are independent from rooms and support inclusive ranges", () => {
  assert.ok(rooms.every(room => !("blockedTile" in room)));
  assert.ok(blockedTiles.some(area => area.rows.start < area.rows.end && area.cols.start < area.cols.end));
  assert.ok(blockedTiles.every(area =>
    Number.isInteger(area.rows.start) && Number.isInteger(area.rows.end) &&
    Number.isInteger(area.cols.start) && Number.isInteger(area.cols.end)
  ));
});

test("blocked hallway ranges are excluded from legal movement and cannot be crossed", () => {
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.board.blockedTiles = [{
    id: "hallway_test", rows: { start: 9, end: 10 }, cols: { start: 11, end: 11 }
  }];
  state.players[0].position = { row: 9, col: 10 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 2;

  const range = movementDistances(state, "1");
  assert.equal(range.has("9,11"), false);
  assert.equal(range.has("10,11"), false);
  assert.throws(() => movePlayer(state, "1", { row: 9, col: 11 }), /outside/i);
});

test("search items are blocked movement areas with descriptions and room associations", () => {
  assert.ok(Array.isArray(searchItems));
  const state = createInitialGameState([{ id: 1, username: "Player" }]);
  state.board.searchItems = [{
    id: "hallway_cart",
    rows: { start: 9, end: 9 },
    cols: { start: 11, end: 12 },
    description: "An abandoned medicine cart.",
    roomId: "wardens_office",
    hintIds: []
  }];
  state.players[0].position = { row: 9, col: 10 };
  state.turn.phase = "moving";
  state.turn.movementRemaining = 2;

  assert.equal(movementDistances(state, "1").has("9,11"), false);
  assert.throws(() => movePlayer(state, "1", { row: 9, col: 11 }), /outside/i);
});

test("configured blocking and search areas load across every room", () => {
  const searchableRoomIds = new Set(searchItems.map(item => item.roomId));
  assert.deepEqual(searchableRoomIds, new Set(rooms.map(room => room.id).filter(id => id !== "wardens_office")));
  assert.ok(blockedTiles.length > 20);
});

test("a search item takes priority when it overlaps a blocked area", () => {
  const state = createInitialGameState([{ id: "1", username: "Player" }]);
  state.board.blockedTiles = [{
    id: "cabinet_back", rows: { start: 4, end: 5 }, cols: { start: 4, end: 5 }
  }];
  state.board.searchItems = [{
    id: "cabinet", rows: { start: 5, end: 6 }, cols: { start: 5, end: 6 },
    roomId: "rec_room", description: "Cabinet", hintIds: []
  }];

  assert.equal(blockingAreaAt(state, { row: 5, col: 5 }).id, "cabinet");
});

test("searching requires retained movement points", () => {
  const state = createInitialGameState([{ id: "1", username: "Ada" }], () => 0.5);
  const item = state.board.searchItems.find(candidate => candidate.hintIds.length);
  const hintId = item.hintIds[0];
  state.players[0].position = { row: item.rows.start - 1, col: item.cols.start };
  state.turn.playerId = "1";
  state.turn.phase = "awaiting_end";
  state.turn.movementRemaining = 0;
  const startingHintIds = [...state.players[0].discoveredHintIds];

  assert.throws(() => discoverHint(state, "1", hintId), /retain movement points/);
  assert.deepEqual(state.players[0].discoveredHintIds, startingHintIds);
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
  state.turn.playerId = "1";
  state.turn.phase = "moving";
  state.turn.movementRemaining = 3;

  movePlayer(state, "1", { row: 2, col: 23 }, () => 0);
  assert.ok(Math.abs(state.players[0].position.row - 23) <= 1);
  assert.ok(Math.abs(state.players[0].position.col - 3) <= 1);
  assert.notDeepEqual(state.players[0].position, { row: 23, col: 3 });
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
  state.turn.order = ["1", "2"];
  state.turn.playerId = "2";
  state.turn.phase = "moving";
  state.turn.movementRemaining = 1;

  movePlayer(state, "2", { row: 11, col: 10 }, () => 0);
  assert.equal(state.turn.phase, "awaiting_end");
  endPlayerTurn(state, "2", () => 0);
  assert.equal(state.turn.phase, "warden");
  completeWardenTurn(state);
  assert.equal(state.turn.playerId, "1");
  assert.equal(state.players[0].secretPassageCooldown, null);
});
