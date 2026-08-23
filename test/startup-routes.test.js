const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const packageJson = require(path.join(root, "package.json"));

test("npm start uses the persistent database startup route", () => {
  assert.equal(packageJson.scripts.start, "node server/start.js");

  const source = fs.readFileSync(path.join(root, "server", "start.js"), "utf8");
  assert.doesNotMatch(source, /reset-dev|seed-dev|resetDevelopmentDatabase|seedDevelopmentUsers/);
});

test("development reset and seed remain confined to npm run dev", () => {
  assert.equal(packageJson.scripts.dev, "node server/dev.js");

  const source = fs.readFileSync(path.join(root, "server", "dev.js"), "utf8");
  assert.match(source, /resetDevelopmentDatabase/);
  assert.match(source, /seedDevelopmentUsers/);
});
