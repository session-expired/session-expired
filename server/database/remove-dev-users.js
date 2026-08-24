require("dotenv").config({
  path: require("path").join(__dirname, "..", "..", ".env"),
  quiet: true
});

const { Pool } = require("pg");
const { developmentUsers } = require("./seed-dev");

async function removeDevelopmentUsers(pool) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const conditions = developmentUsers.map((_, index) => {
      const usernameParameter = index * 2 + 1;
      const emailParameter = usernameParameter + 1;
      return `(LOWER(username) = LOWER($${usernameParameter}) AND LOWER(email) = LOWER($${emailParameter}))`;
    });
    const identifiers = developmentUsers.flatMap((username) => [
      username,
      `${username}@example.com`
    ]);
    const users = await client.query(
      `SELECT id FROM users WHERE ${conditions.join(" OR ")} FOR UPDATE`,
      identifiers
    );
    const userIds = users.rows.map(({ id }) => String(id));

    if (userIds.length) {
      // Clear dependent records whose foreign keys do not cascade. Lobbies hosted
      // by test users must go too; their games otherwise prevent lobby deletion.
      await client.query(
        "DELETE FROM messages WHERE sender_id = ANY($1::bigint[]) OR recipient_id = ANY($1::bigint[])",
        [userIds]
      );
      await client.query(
        "DELETE FROM games WHERE lobby_id IN (SELECT id FROM lobbies WHERE host_id = ANY($1::bigint[]))",
        [userIds]
      );
      await client.query("DELETE FROM lobbies WHERE host_id = ANY($1::bigint[])", [userIds]);
      await client.query("DELETE FROM lobby_players WHERE user_id = ANY($1::bigint[])", [userIds]);
      await client.query(
        "DELETE FROM user_sessions WHERE sess ->> 'userId' = ANY($1::text[])",
        [userIds]
      );
      await client.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [userIds]);
    }

    await client.query("COMMIT");
    return userIds.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set.");
  const databaseSslEnabled = process.env.DATABASE_SSL
    ? process.env.DATABASE_SSL === "true"
    : process.env.NODE_ENV === "production";
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: databaseSslEnabled ? { rejectUnauthorized: false } : false
  });

  try {
    const removed = await removeDevelopmentUsers(pool);
    console.log(
      removed
        ? `Removed ${removed} development test user${removed === 1 ? "" : "s"}; all other users were retained.`
        : "No development test users were found; the database was unchanged."
    );
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error("Development user cleanup failed; no partial changes were kept:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { removeDevelopmentUsers };
