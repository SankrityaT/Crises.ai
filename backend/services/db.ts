import { config } from "dotenv";

config({ path: ".env.local", override: true });
config();

import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../../db/schema";

let pool: Pool | null = null;
let database: NodePgDatabase<typeof schema> | null = null;

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is undefined. Provide a connection string to enable persistence."
    );
  }

  const shouldUseSSL = process.env.DATABASE_SSL !== "false";

  return new Pool({
    connectionString,
    ssl: shouldUseSSL ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30_000),
  });
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!database) {
    pool = createPool();
    database = drizzle(pool, { schema });
  }

  return database;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    database = null;
  }
}

export type Database = NodePgDatabase<typeof schema>;
export { schema };
