/* eslint-disable no-console */

const path = require("node:path");

require("dotenv").config({ path: path.join(process.cwd(), ".env.local") });

const { neon } = require("@neondatabase/serverless");

function usage() {
  console.log("Usage: node scripts/reset-db.js --yes");
  console.log("");
  console.log("This will TRUNCATE ALL app/auth tables (destructive).");
}

function parseDbTarget(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      database: u.pathname.replace(/^\//, "") || "(unknown)"
    };
  } catch {
    return { host: "(unparseable)", database: "(unparseable)" };
  }
}

async function main() {
  const yes = process.argv.includes("--yes");
  if (!yes) {
    usage();
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing env var: DATABASE_URL (ensure .env.local is set)");
  }

  const target = parseDbTarget(url);
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: "reset-db",
        target,
        note: "Truncating all tables..."
      },
      null,
      2
    )
  );

  const sql = neon(url);

  // Order doesn't matter with CASCADE, but keeping explicit list avoids surprises.
  await sql.query(`
    TRUNCATE
      "accounts",
      "sessions",
      "verificationToken",
      "token_balances",
      "transactions",
      "analyses",
      "users"
    RESTART IDENTITY CASCADE;
  `);

  console.log(JSON.stringify({ ok: true, truncated: true }, null, 2));
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

