import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;
type HttpDb = Omit<Db, "transaction">;

let cachedDb: HttpDb | null = null;

export function getDb() {
  if (cachedDb) return cachedDb;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing env var: DATABASE_URL");
  }

  const sql = neon(url);
  cachedDb = drizzle(sql, { schema }) as HttpDb;
  return cachedDb;
}

export type DbClient = ReturnType<typeof getDb>;
export type DrizzleDb = Db;
