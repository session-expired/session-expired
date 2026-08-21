const bcrypt = require("bcrypt");

const developmentUsers = ["user1", "user2", "user3", "user4"];

async function seedDevelopmentUsers(pool) {
  const passwordHash = await bcrypt.hash("password", 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const username of developmentUsers) {
      const values = [username, `${username}@example.com`, passwordHash];
      const result = await client.query(
        `UPDATE users
         SET username = $1,
             email = $2,
             password_hash = $3
         WHERE LOWER(username) = LOWER($1)`,
        values
      );

      if (result.rowCount === 0) {
        await client.query(
          `INSERT INTO users (username, email, password_hash)
           VALUES ($1, $2, $3)`,
          values
        );
      }
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

module.exports = { developmentUsers, seedDevelopmentUsers };
