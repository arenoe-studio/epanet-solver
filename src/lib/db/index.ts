import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (cachedDb) return cachedDb;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing env var: DATABASE_URL");
  }

  const sql = neon(url);
  cachedDb = drizzle(sql, { schema });
  return cachedDb;
}
