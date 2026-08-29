const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequireAdmin } = require("../server/admin/admin");

function responseRecorder() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(location) { this.statusCode = 302; this.location = location; return this; }
  };
}

test("admin middleware redirects an unauthenticated page request", async () => {
  const middleware = createRequireAdmin({ query: async () => assert.fail("database should not be queried") });
  const response = responseRecorder();
  await middleware({ session: {}, originalUrl: "/admin" }, response, () => assert.fail("next should not run"));
  assert.equal(response.statusCode, 302);
  assert.equal(response.location, "/login?returnTo=%2Fadmin");
});

test("admin middleware returns 401 for an unauthenticated API request", async () => {
  const middleware = createRequireAdmin({ query: async () => assert.fail("database should not be queried") });
  const response = responseRecorder();
  await middleware({ session: {}, originalUrl: "/api/admin/users" }, response, () => assert.fail("next should not run"));
  assert.equal(response.statusCode, 401);
});

test("admin middleware rejects a normal user based on the stored role", async () => {
  const middleware = createRequireAdmin({ query: async () => ({ rows: [{ role: "user", banned: false }] }) });
  const response = responseRecorder();
  await middleware({ session: { userId: 4 }, originalUrl: "/api/admin/users" }, response, () => assert.fail("next should not run"));
  assert.equal(response.statusCode, 403);
});

test("admin middleware permits an unbanned admin", async () => {
  const middleware = createRequireAdmin({ query: async () => ({ rows: [{ role: "admin", banned: false }] }) });
  let called = false;
  await middleware({ session: { userId: 8 }, originalUrl: "/admin" }, responseRecorder(), () => { called = true; });
  assert.equal(called, true);
});
