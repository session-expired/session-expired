require("dotenv").config({ quiet: true });

// This flag is set only by the npm run dev entry point. The normal server entry
// point never enables the single-player testing exception.
process.env.SESSION_EXPIRED_DEV_RUNNER = "true";

const { pool, startServer } = require("./server");
const { resetDevelopmentDatabase } = require("./database/reset-dev");
const { seedDevelopmentUsers } = require("./database/seed-dev");

resetDevelopmentDatabase(pool)
  .then(() => seedDevelopmentUsers(pool))
  .then(() => startServer())
  .catch(async (error) => {
    const details =
      error.errors?.map((cause) => cause.message).join("; ") || error.message;

    console.error(
      "Unable to reset and seed the development database. Is PostgreSQL running, initialized, and is DATABASE_URL correct?",
      details
    );

    await pool.end();
    process.exitCode = 1;
  });
