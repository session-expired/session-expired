require("dotenv").config({ quiet: true });

const fs = require("fs/promises");
const path = require("path");
const { Client } = require("pg");

const schemaPath = path.join(__dirname, "..", "..", "sql", "schema.sql");

async function setupDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. See .env.example.");
  }

  const schema = await fs.readFile(schemaPath, "utf8");
  const databaseSslEnabled = process.env.DATABASE_SSL
    ? process.env.DATABASE_SSL === "true"
    : process.env.NODE_ENV === "production";
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: databaseSslEnabled ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    await client.query(schema);
    console.log(`Database setup complete using ${path.relative(process.cwd(), schemaPath)}.`);
  } finally {
    await client.end();
  }
}

setupDatabase().catch((error) => {
  console.error("Database setup failed:", error.message);
  process.exitCode = 1;
});
