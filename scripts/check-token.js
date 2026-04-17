/* eslint-disable no-console */

const path = require("node:path");

require("dotenv").config({ path: path.join(process.cwd(), ".env.local") });

const { neon } = require("@neondatabase/serverless");

function usage() {
  console.log("Usage: node scripts/check-token.js <email>");
  console.log('Example: node scripts/check-token.js "arenoe.studio@gmail.com"');
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    usage();
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing env var: DATABASE_URL (ensure .env.local is set)");
  }

  const sql = neon(url);

  const userRes = await sql.query(
    "select id, email, created_at from users where lower(email) = lower($1) limit 1",
    [email]
  );
  const userRows = userRes?.rows ?? userRes ?? [];
  const user = userRows?.[0] ?? null;

  if (!user?.id) {
    console.log(JSON.stringify({ ok: false, error: "User not found", email }, null, 2));
    return;
  }

  const balRes = await sql.query(
    "select id, user_id, balance, total_bought, total_used, updated_at from token_balances where user_id = $1 limit 1",
    [user.id]
  );
  const balRows = balRes?.rows ?? balRes ?? [];
  const balance = balRows?.[0] ?? null;

  console.log(
    JSON.stringify(
      {
        ok: true,
        email,
        user,
        tokenBalance: balance
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

