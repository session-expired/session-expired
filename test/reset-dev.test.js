const test = require("node:test");
const assert = require("node:assert/strict");
const { resetDevelopmentDatabase } = require("../server/database/reset-dev");

test("development reset truncates application data inside a transaction", async () => {
  const queries = [];
  let released = false;
  const client = {
    query: async (sql) => queries.push(sql.replace(/\s+/g, " ").trim()),
    release: () => { released = true; }
  };
  const pool = { connect: async () => client };

  await resetDevelopmentDatabase(pool);

  assert.equal(queries[0], "BEGIN");
  assert.match(queries[1], /^TRUNCATE TABLE completed_games, games, lobby_players, lobbies, messages, user_sessions, users RESTART IDENTITY CASCADE$/);
  assert.equal(queries[2], "COMMIT");
  assert.equal(released, true);
});
