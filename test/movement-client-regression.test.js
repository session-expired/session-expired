const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const board = fs.readFileSync(path.join(root, "public", "js", "game", "board.js"), "utf8");
const renderer = fs.readFileSync(path.join(root, "public", "js", "game", "entity-renderer.js"), "utf8");
const deduction = fs.readFileSync(path.join(root, "public", "js", "game", "deduction-controls.js"), "utf8");

test("player movement is awaited under one client input lock", () => {
  assert.match(board, /let movementInProgress = false/);
  assert.match(board, /if \(movementInProgress\) return;\s*setMovementLocked\(true\)/);
  assert.match(board, /await entityRenderer\.animate\(/);
  assert.match(board, /finally \{[\s\S]*setMovementLocked\(false\)/);
});

test("the renderer advances path segments with requestAnimationFrame", () => {
  assert.doesNotMatch(renderer, /sprite\.animate\(/);
  assert.match(renderer, /for \(let index = 1; index < tiles\.length/);
  assert.match(renderer, /await nextFrame\(\);\s*await nextFrame\(\)/);
  assert.match(renderer, /window\.requestAnimationFrame\(step\)/);
  assert.match(renderer, /\(now - startedAt\) \/ 180/);
});

test("board, turn, Guess, and Accusation input honor the movement lock", () => {
  assert.match(board, /elements\.board\.addEventListener\("click"[\s\S]*if \(movementInProgress\) return/);
  assert.match(board, /elements\.rollMovementButton\.addEventListener[\s\S]*if \(movementInProgress\) return/);
  assert.match(board, /elements\.endTurnButton\.addEventListener[\s\S]*if \(movementInProgress\) return/);
  assert.match(board, /async function leaveGame[\s\S]*if \(movementInProgress\) return/);
  assert.match(board, /canPerformAction: \(\) => !movementInProgress/);
  assert.match(deduction, /callbacks\.canPerformAction\?\.\(\) !== false/);
});

test("authoritative refreshes are deferred instead of snapping an active player", () => {
  assert.match(board, /if \(movementInProgress\) \{\s*deferredGameState = event\.detail/);
  assert.match(board, /if \(deferredGameState\) \{\s*gameState = deferredGameState/);
  assert.match(renderer, /function cancelAnimations\(\)/);
});
