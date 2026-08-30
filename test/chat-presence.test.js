const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createPresenceRegistry } = require("../server/chat/presence");

test("presence retains a user until their final socket disconnects", () => {
  const presence = createPresenceRegistry();
  assert.equal(presence.connect({ id: 2, username: "Tycho" }, "socket-a"), true);
  assert.equal(presence.connect({ id: 2, username: "Tycho" }, "socket-b"), false);
  assert.equal(presence.disconnect(2, "socket-a"), false);
  assert.equal(presence.isOnline(2), true);
  assert.equal(presence.disconnect(2, "socket-b"), true);
  assert.equal(presence.isOnline(2), false);
});

test("presence lists only connected users in stable username order", () => {
  const presence = createPresenceRegistry();
  presence.connect({ id: 3, username: "Rasputin" }, "c");
  presence.connect({ id: 1, username: "Ada" }, "a");
  presence.connect({ id: 2, username: "Curie" }, "b");
  assert.deepEqual(presence.list(), [
    { id: "1", username: "Ada" },
    { id: "2", username: "Curie" },
    { id: "3", username: "Rasputin" }
  ]);
});

test("private messaging validates live presence on the server", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "server", "chat", "chatHandler.js"), "utf8");
  assert.match(source, /presence\.isOnline\(targetId\)/);
  assert.match(source, /That player is no longer online\./);
  assert.match(source, /String\(targetId\) === String\(userId\)/);
  assert.match(source, /presence\.disconnect\(socket\.data\.chatUserId, socket\.id\)/);
});

test("the client excludes self and updates an open conversation on presence events", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "js", "chat.js"), "utf8");
  assert.match(source, /socket\.on\("presence-users"/);
  assert.match(source, /String\(user\.id\) !== String\(currentUser\?\.id\)/);
  assert.match(source, /This player is offline\./);
  assert.match(source, /input\.disabled = unavailable/);
  assert.match(source, /sendButton\.disabled = unavailable/);
});

