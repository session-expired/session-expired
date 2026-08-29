const { pool, startServer } = require("./server");
const { removeDevelopmentUsers } = require("./database/remove-dev-users");

async function run() {
  try {
    const removed = await removeDevelopmentUsers(pool);
    if (removed) {
      console.log(
        `Removed ${removed} development test user${removed === 1 ? "" : "s"}; all other users were retained.`
      );
    }
    await startServer();
  } catch (error) {
    console.error("Unable to start the server:", error.message);
    await pool.end();
    process.exitCode = 1;
  }
}

run();
