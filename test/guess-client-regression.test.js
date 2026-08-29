const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("shared Deduction controls are constructed before rendering uses them", () => {
  const source = fs.readFileSync(path.join(root, "public", "js", "game", "board.js"), "utf8");
  const declaration = source.indexOf("const deductionControls = createDeductionControls");
  const renderReference = source.indexOf("deductionControls.render");
  const initializeReference = source.indexOf("deductionControls.initialize");
  assert.ok(declaration >= 0, "deductionControls must be constructed");
  assert.ok(declaration < renderReference, "deductionControls must exist before renderTurn uses it");
  assert.ok(declaration < initializeReference, "deductionControls must exist before initialization");
});

test("Guess markup and DOM bindings stay synchronized", () => {
  const html = fs.readFileSync(path.join(root, "public", "pages", "game.html"), "utf8");
  const dom = fs.readFileSync(path.join(root, "public", "js", "game", "board-dom.js"), "utf8");
  for (const id of ["open-guess", "open-accusation", "deduction-panel", "deduction-fields", "cancel-deduction"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
    assert.match(dom, new RegExp(`getElementById\\(["']${id}["']\\)`));
  }
});

test("player rendering remains after turn-control rendering", () => {
  const source = fs.readFileSync(path.join(root, "public", "js", "game", "board.js"), "utf8");
  const renderGameState = source.slice(source.indexOf("function renderGameState"), source.indexOf("function animateWardenMove"));
  assert.ok(renderGameState.indexOf("renderTurn()") < renderGameState.indexOf("entityRenderer.render()"));
  assert.match(renderGameState, /entityRenderer\.render\(\)/);
});

test("Deduction choices use custom buttons with cross-platform elimination marks", () => {
  const html = fs.readFileSync(path.join(root, "public", "pages", "game.html"), "utf8");
  const controls = fs.readFileSync(path.join(root, "public", "js", "game", "deduction-controls.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "public", "css", "game.css"), "utf8");
  assert.doesNotMatch(html, /<select[^>]+name=["'](?:killer|victim|room|method)["']/);
  assert.match(controls, /document\.createElement\("button"\)/);
  assert.match(controls, /mark\.textContent = isEliminated \? "×" : ""/);
  assert.match(controls, /submittedMode === "guess" \? await guess\(gameId, selections\) : await accuse\(gameId, selections\)/);
  assert.doesNotMatch(css, /accusation-option-eliminated|accusation-controls option/);
});
