const { pool, startServer } = require("./server");
const { seedDevelopmentUsers } = require("./database/seed-dev");

seedDevelopmentUsers(pool)
  .then(() => startServer())
  .catch(async (error) => {
    console.error("Unable to seed development users:", error.message);
    await pool.end();
    process.exitCode = 1;
  });
