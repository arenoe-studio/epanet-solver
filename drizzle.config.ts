import { existsSync } from "node:fs";

import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// Drizzle Kit does not automatically load Next.js `.env.local`.
// Load it here so `DATABASE_URL` is available for `drizzle-kit push/generate/studio`.
if (!process.env.DATABASE_URL) {
  if (existsSync(".env.local")) {
    dotenv.config({ path: ".env.local" });
  } else if (existsSync(".env")) {
    dotenv.config({ path: ".env" });
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "Missing env var: DATABASE_URL. Add it to `.env.local` (no leading '#') then re-run drizzle-kit."
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL
  }
});
