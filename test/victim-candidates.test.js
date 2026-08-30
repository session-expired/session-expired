const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createInitialGameState,
  hintCatalog,
  solutionPools,
  victimCandidatesForCharacters,
  WARDEN_VICTIM_SOURCE
} = require("../server/game/board");
const { characterIds } = require("../server/lobby/characters");

function players(characters) {
  return characters.map((character, index) => ({
    id: String(index + 1), username: `Player ${index + 1}`, selected_character: character
  }));
}

function sourcesFor(candidateIds) {
  const ids = new Set(candidateIds);
  return new Set(solutionPools.victims.filter(victim => ids.has(victim.id)).map(victim => victim.sourceCharacter));
}

test("three active characters expose only their victims plus Napoleon's", () => {
  const active = ["rasputin", "lovelace", "curie"];
  const state = createInitialGameState(players(active), () => 0.25);
  assert.deepEqual(sourcesFor(state.candidates.victims), new Set([...active, WARDEN_VICTIM_SOURCE]));
  assert.equal(state.candidates.victims.length, 16);
});

test("one active character still includes Napoleon's victims", () => {
  const state = createInitialGameState(players(["mallon"]), () => 0.5);
  assert.deepEqual(sourcesFor(state.candidates.victims), new Set(["mallon", WARDEN_VICTIM_SOURCE]));
  assert.equal(state.candidates.victims.length, 8);
});

test("all playable character sources plus Napoleon are available", () => {
  const candidates = victimCandidatesForCharacters([...characterIds]);
  assert.deepEqual(new Set(candidates.map(victim => victim.sourceCharacter)),
    new Set([...characterIds, WARDEN_VICTIM_SOURCE]));
});

test("the answer and every generated victim hint stay inside the game candidate pool", () => {
  const state = createInitialGameState(players(["rasputin", "lovelace", "curie"]), () => 0.75);
  const allowed = new Set(state.candidates.victims);
  assert.ok(allowed.has(state.solution.victim));
  const generatedIds = [
    ...state.players.flatMap(player => player.discoveredHintIds),
    ...state.board.searchItems.flatMap(item => item.hintIds)
  ];
  for (const hintId of generatedIds) {
    const hint = hintCatalog.hints.find(candidate => candidate.id === hintId);
    if (hint.category === "victim") assert.ok(allowed.has(hint.excludes), hint.id);
  }
});

test("the shared Deduction selector filters victim metadata by authoritative state IDs", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "js", "game", "deduction-controls.js"), "utf8");
  assert.match(source, /currentState\.candidates\?\.victims/);
  assert.match(source, /optionsByField\[field\]\.filter\(option => allowedVictims\.has\(option\.id\)\)/);
});

