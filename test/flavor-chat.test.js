const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

test("flavor dialogue is sent to game chat with character-only names", () => {
  const renderer = fs.readFileSync(
    path.join(root, "public", "js", "game", "entity-renderer.js"),
    "utf8"
  );
  const chat = fs.readFileSync(path.join(root, "public", "js", "chat.js"), "utf8");

  for (const [character, displayName] of Object.entries({
    bonaparte: "Napolean",
    rasputin: "Rasputin",
    crowley: "Crowley",
    lovelace: "Lovelace",
    brahe: "Brahe",
    curie: "Curie",
    mallon: "Typhoid Mary"
  })) {
    assert.match(renderer, new RegExp(`${character}: "${displayName}"`));
  }
  assert.match(renderer, /CustomEvent\("game-flavor-message"/);
  assert.match(chat, /addMessage\("game", \{ sender, text \}\)/);
  assert.doesNotMatch(renderer, /character-speech/);
});

test("accusations trigger character flavor without using the player's username", () => {
  const controls = fs.readFileSync(
    path.join(root, "public", "js", "game", "accusation-controls.js"),
    "utf8"
  );

  assert.match(controls, /callbacks\.onDialogue\(currentPlayerCharacter, "accuse"\)/);
  assert.match(controls, /data\.correct \? "correct_accusation" : "wrong_accusation"/);
  assert.doesNotMatch(controls, /player\.username/);
});
