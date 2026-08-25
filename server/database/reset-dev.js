async function resetDevelopmentDatabase(pool) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `TRUNCATE TABLE
         completed_games,
         games,
         lobby_players,
         lobbies,
         messages,
         user_sessions,
         users
       RESTART IDENTITY CASCADE`
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  console.log("Development database reset complete.");
}

module.exports = { resetDevelopmentDatabase };
