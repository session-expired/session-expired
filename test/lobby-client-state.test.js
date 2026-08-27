const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("rendering fresh lobby details re-enables the leave action", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "public", "js", "lobby.js"),
    "utf8"
  );

  assert.match(
    source,
    /leaveButton\.hidden = !isMember \|\| lobby\.status !== "waiting";\s+leaveButton\.disabled = false;/,
    "the leave button must not retain its disabled state after a previous successful leave"
  );
});

test("private lobby invite links are joined through the invite endpoint", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "public", "js", "lobby.js"),
    "utf8"
  );

  assert.match(source, /URLSearchParams\(window\.location\.search\)\.get\("invite"\)/);
  assert.match(source, /api\("\/api\/lobbies\/join-by-invite"/);
  assert.match(source, /window\.history\.replaceState\(\{\}, "", "\/lobby"\)/);
});
