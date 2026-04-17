const { existsSync } = require("node:fs");

const dotenv = require("dotenv");
const { defineConfig } = require("drizzle-kit");

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

module.exports = defineConfig({
  schema: "./src/lib/db/schema.drizzle.js",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL
  }
});
