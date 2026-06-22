import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "../config.js";
import { createPool, closePool } from "./client.js";
import { logger } from "../logger.js";

// Minimal ordered-SQL migrator: applies drizzle/*.sql in filename order,
// recording each in schema_migrations so re-runs are no-ops.
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../../drizzle");

async function main() {
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run migrations");
  }
  const pool = createPool(config.DATABASE_URL);

  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamp NOT NULL DEFAULT now())"
  );
  const { rows } = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      logger.info({ file }, "applied migration");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  await closePool();
  logger.info("migrations up to date");
}

main().catch((err) => {
  logger.error({ err }, "migration failed");
  process.exit(1);
});
