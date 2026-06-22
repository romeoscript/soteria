import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export type Db = NodePgDatabase<typeof schema>;

let pool: pg.Pool | undefined;

export function createPool(databaseUrl: string): pg.Pool {
  pool = new pg.Pool({ connectionString: databaseUrl });
  return pool;
}

export function createDb(databaseUrl: string): Db {
  return drizzle(createPool(databaseUrl), { schema });
}

export async function closePool(): Promise<void> {
  await pool?.end();
}
