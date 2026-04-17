/* eslint-disable no-console */

const path = require("node:path");

require("dotenv").config({ path: path.join(process.cwd(), ".env.local") });

const { neon } = require("@neondatabase/serverless");

function usage() {
  console.log("Usage: node scripts/grant-tokens.js <email> <amount>");
  console.log('Example: node scripts/grant-tokens.js "arenoe.studio@gmail.com" 100');
}

async function main() {
  const email = process.argv[2];
  const amountRaw = process.argv[3];
  const amount = Number(amountRaw);

  if (!email || !amountRaw || !Number.isFinite(amount) || amount <= 0) {
    usage();
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing env var: DATABASE_URL (ensure .env.local is set)");
  }

  const sql = neon(url);

  const userRes = await sql.query(
    "select id, email from users where lower(email) = lower($1) limit 1",
    [email]
  );
  const userRows = userRes?.rows ?? userRes ?? [];

  const userId = userRows?.[0]?.id;
  if (!userId) {
    throw new Error(
      `User not found for email ${email}. Sign in once so the user record is created.`
    );
  }

  await sql.query(
    `
      insert into token_balances (user_id, balance, total_bought, total_used, updated_at)
      values ($1, $2, $2, 0, now())
      on conflict (user_id) do update
      set
        balance = token_balances.balance + excluded.balance,
        total_bought = token_balances.total_bought + excluded.total_bought,
        updated_at = now()
    `,
    [userId, amount]
  );

  const balanceRes = await sql.query(
    "select balance, total_bought, total_used from token_balances where user_id = $1 limit 1",
    [userId]
  );
  const balanceRows = balanceRes?.rows ?? balanceRes ?? [];

  const row = balanceRows?.[0] ?? null;
  console.log(
    JSON.stringify(
      {
        ok: true,
        email,
        userId,
        added: amount,
        balance: row?.balance ?? null,
        totalBought: row?.total_bought ?? null,
        totalUsed: row?.total_used ?? null
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
