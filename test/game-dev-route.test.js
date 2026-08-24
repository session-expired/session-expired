const assert = require("node:assert/strict");
const test = require("node:test");

const packageJson = require("../package.json");
const { app, state, user } = require("../server/game-dev");
const { spawnPoints, secretPass } = require("../server/game/board");
const { characterIds } = require("../server/lobby/characters");

test("npm run game uses the isolated game development server", () => {
  assert.equal(packageJson.scripts.game, "node server/game-dev.js");
});

test("the game development server uses a random playable character", () => {
  assert.deepEqual(user, { id: "1", username: "user1" });
  assert.equal(state.players.length, 1);
  assert.equal(state.players[0].username, "user1");
  assert.ok(characterIds.has(state.players[0].character));
});

test("the board source includes the spawn points used by the game state", () => {
  assert.ok(spawnPoints.some(point =>
    point.row === state.players[0].position.row && point.col === state.players[0].position.col
  ));
});

test("the board source exports secret passage locations for the click inspector", () => {
  assert.ok(secretPass.length > 0);
  assert.deepEqual(secretPass[0], { row: 2, col: 23 });
});

test("the game development server exposes only game routes", () => {
  const routePaths = app._router.stack
    .filter(layer => layer.route)
    .map(layer => layer.route.path);

  assert.ok(routePaths.includes("/game/1"));
  assert.ok(routePaths.includes("/api/games/1"));
  assert.ok(!routePaths.includes("/login"));
  assert.ok(!routePaths.includes("/lobby"));
});
