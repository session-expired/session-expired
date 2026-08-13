require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
  quiet: true
});

const { pool, startServer } = require("./server");
const { seedDevelopmentUsers } = require("./database/seed-dev");

seedDevelopmentUsers(pool)
  .then(() => startServer())
  .catch(async (error) => {
    const details = error.errors?.map((cause) => cause.message).join("; ") || error.message;
    console.error("Unable to seed development users. Is PostgreSQL running and is DATABASE_URL correct?", details);
    await pool.end();
    process.exitCode = 1;
  });
