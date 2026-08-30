const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const packageJson = require(path.join(root, "package.json"));

test("npm start does not mutate database records before starting", () => {
  assert.equal(packageJson.scripts.start, "node server/start.js");

  const source = fs.readFileSync(path.join(root, "server", "start.js"), "utf8");
  assert.match(source, /startServer\(\)/);
  assert.doesNotMatch(source, /remove|reset|seed|DELETE|TRUNCATE/i);
});

test("npm run dev does not reset or seed database records", () => {
  assert.equal(packageJson.scripts.dev, "node server/dev.js");

  const source = fs.readFileSync(path.join(root, "server", "dev.js"), "utf8");
  assert.match(source, /startServer\(\)/);
  assert.doesNotMatch(source, /remove|reset|seed|DELETE|TRUNCATE/i);
  assert.equal(packageJson.scripts.reset, undefined);
});
