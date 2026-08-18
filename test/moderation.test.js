const test = require("node:test");
const assert = require("node:assert/strict");

const config = require("../server/config/moderation.json");
const {
  moderateChatMessage,
  moderateUsername,
  normalizeText
} = require("../server/chat/moderation");

const configuredSevereTerm = config.terms.severe_slurs.find((term) => /^[a-z]+$/.test(term));
const configuredModerateTerm = config.terms.moderate_slurs.find((term) => /^[a-z]+$/.test(term));

test("harmless normal chat is allowed", () => {
  assert.equal(moderateChatMessage("Good luck in the next round!").action, "allow");
});

test("ordinary profanity is not treated as identity hate", () => {
  for (const expletive of config.terms.expletives) {
    assert.equal(moderateChatMessage(`That was ${expletive}.`).action, "allow");
  }
});

test("a severe configured slur is blocked", () => {
  assert.equal(moderateChatMessage(configuredSevereTerm).action, "block");
});

test("capitalization does not evade detection", () => {
  assert.equal(moderateChatMessage(configuredSevereTerm.toUpperCase()).action, "block");
});

test("zero-width characters do not evade detection", () => {
  const midpoint = Math.floor(configuredSevereTerm.length / 2);
  const evasion = `${configuredSevereTerm.slice(0, midpoint)}\u200B${configuredSevereTerm.slice(midpoint)}`;
  assert.equal(moderateChatMessage(evasion).action, "block");
  assert.equal(normalizeText(evasion), configuredSevereTerm);
});

test("a similar sequence inside an unrelated word is not matched", () => {
  assert.equal(moderateChatMessage("Please add cinnamon and spice.").action, "allow");
});

test("a normal username is allowed", () => {
  assert.equal(moderateUsername("Player_One").action, "allow");
});

test("a moderate signal flags chat but blocks a username", () => {
  assert.equal(moderateChatMessage(configuredModerateTerm).action, "flag");
  assert.equal(moderateUsername(configuredModerateTerm).action, "block");
});

test("a username containing a severe configured term is blocked", () => {
  assert.equal(moderateUsername(`player_${configuredSevereTerm}`).action, "block");
});
