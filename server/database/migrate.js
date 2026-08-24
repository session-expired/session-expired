require("dotenv").config({
  path: require("path").join(__dirname, "..", "..", ".env"),
  quiet: true
});

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { Client } = require("pg");

const migrationsDirectory = path.join(__dirname, "..", "..", "sql", "migrations");
const lockId = 736_947_221;

function checksum(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

async function readMigrations() {
  const entries = await fs.readdir(migrationsDirectory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && /^\d+_[a-z0-9_-]+\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (!filenames.length) throw new Error("No SQL migrations were found.");

  return Promise.all(filenames.map(async (filename) => {
    const sql = await fs.readFile(path.join(migrationsDirectory, filename), "utf8");
    return { filename, sql, checksum: checksum(sql) };
  }));
}

async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set.");
  const databaseSslEnabled = process.env.DATABASE_SSL
    ? process.env.DATABASE_SSL === "true"
    : process.env.NODE_ENV === "production";
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: databaseSslEnabled ? { rejectUnauthorized: false } : false
  });

  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [lockId]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename TEXT PRIMARY KEY,
         checksum CHAR(64) NOT NULL,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`
    );

    const migrations = await readMigrations();
    const appliedResult = await client.query("SELECT filename, checksum FROM schema_migrations");
    const applied = new Map(appliedResult.rows.map((row) => [row.filename, row.checksum.trim()]));
    let appliedCount = 0;

    for (const migration of migrations) {
      const previousChecksum = applied.get(migration.filename);
      if (previousChecksum) {
        if (previousChecksum !== migration.checksum) {
          throw new Error(`Applied migration ${migration.filename} has been modified.`);
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
          [migration.filename, migration.checksum]
        );
        await client.query("COMMIT");
        appliedCount += 1;
        console.log(`Applied ${migration.filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log(appliedCount ? `Database migration complete (${appliedCount} applied).` : "Database is already up to date.");
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
    } finally {
      await client.end();
    }
  }
}

if (require.main === module) {
  migrate().catch((error) => {
    console.error("Database migration failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { checksum, readMigrations, migrate };
