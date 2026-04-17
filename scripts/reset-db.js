/* eslint-disable no-console */
const { neon } = require("@neondatabase/serverless");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing env var: DATABASE_URL");
  }

  if (process.env.CONFIRM_RESET_DB !== "YES") {
    console.error(
      "Refusing to reset DB without CONFIRM_RESET_DB=YES (this will DROP SCHEMA public CASCADE)."
    );
    process.exitCode = 2;
    return;
  }

  const sql = neon(url);

  await sql`select 1 as ok`;

  console.log("Dropping schema public (CASCADE)...");
  await sql`drop schema if exists public cascade`;

  console.log("Recreating schema public...");
  await sql`create schema public`;

  console.log("DB reset completed.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

