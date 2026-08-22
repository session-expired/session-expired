const assert = require("node:assert/strict");
const test = require("node:test");
const { removeDevelopmentUsers } = require("../server/database/remove-dev-users");

test("reset removes only exact development accounts and their dependencies", async () => {
  const queries = [];
  let released = false;
  const client = {
    query: async (sql, values) => {
      queries.push({ sql: sql.replace(/\s+/g, " ").trim(), values });
      if (/^SELECT id FROM users/.test(sql)) return { rows: [{ id: "7" }, { id: "8" }] };
      return { rows: [] };
    },
    release: () => { released = true; }
  };

  const removed = await removeDevelopmentUsers({ connect: async () => client });

  assert.equal(removed, 2);
  assert.equal(queries[0].sql, "BEGIN");
  assert.deepEqual(queries[1].values, [
    "user1", "user1@example.com",
    "user2", "user2@example.com",
    "user3", "user3@example.com",
    "user4", "user4@example.com"
  ]);
  assert.match(queries[1].sql, /LOWER\(username\).*LOWER\(email\)/);
  assert.match(queries.at(-2).sql, /^DELETE FROM users/);
  assert.equal(queries.at(-1).sql, "COMMIT");
  assert.equal(released, true);
});

test("reset leaves the database alone when development users do not exist", async () => {
  const queries = [];
  const client = {
    query: async (sql) => {
      queries.push(sql.replace(/\s+/g, " ").trim());
      return /^SELECT id FROM users/.test(sql) ? { rows: [] } : { rows: [] };
    },
    release: () => {}
  };

  assert.equal(await removeDevelopmentUsers({ connect: async () => client }), 0);
  assert.deepEqual(queries.map((sql) => sql.split(" ")[0]), ["BEGIN", "SELECT", "COMMIT"]);
});
