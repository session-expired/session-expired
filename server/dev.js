require("dotenv").config({ quiet: true });

process.env.NODE_ENV = "development";
process.env.HOST = "localhost";
process.env.PORT = "3000";
process.env.DATABASE_URL ||= "postgresql://postgres:session_expired_user@localhost:5432/session_expired";
process.env.SESSION_SECRET ||= "development-only-session-secret-change-me";
process.env.COOKIE_SECURE ||= "false";

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
