const bcrypt = require("bcrypt");

const developmentUsers = ["user1", "user2", "user3", "user4"];

async function seedDevelopmentUsers(pool) {
  const passwordHash = await bcrypt.hash("password", 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const username of developmentUsers) {
      await client.query(
        `INSERT INTO users (username, email, password_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (LOWER(username)) DO UPDATE
         SET email = EXCLUDED.email,
             password_hash = EXCLUDED.password_hash`,
        [username, `${username}@example.com`, passwordHash]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  console.log("Development users ready: user1, user2, user3, user4 (password: password)");
}

module.exports = { seedDevelopmentUsers };
