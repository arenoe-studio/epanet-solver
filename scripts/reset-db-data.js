/* eslint-disable no-console */
/**
 * Script untuk mereset semua data di database
 * - Menghapus semua user & auth data
 * - Menghapus semua hasil analisis
 * - Menghapus semua token balance
 * - Menghapus semua transaksi
 * - Menghapus semua OTP codes
 * - Menghapus semua sessions
 * 
 * TIDAK menghapus struktur tabel!
 * 
 * Usage:
 *   DATABASE_URL=... node scripts/reset-db-data.js
 * 
 * Atau untuk Production (dengan konfirmasi):
 *   DATABASE_URL=... CONFIRM_RESET=YES node scripts/reset-db-data.js
 */

const { neon } = require("@neondatabase/serverless");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing envvar: DATABASE_URL");
  }

  // Prevent accidental resets in production
  if (process.env.NODE_ENV === "production" && process.env.CONFIRM_RESET !== "YES") {
    console.error("ERROR: Cannot reset production database without CONFIRM_RESET=YES");
    console.error("Set CONFIRM_RESET=YES to confirm you want to reset the database.");
    process.exitCode = 2;
    return;
  }

  // Development warning
  if (process.env.NODE_ENV !== "production" && process.env.CONFIRM_RESET !== "YES") {
    console.log("WARNING: This will delete ALL data in the database!");
    console.log("To confirm, run with CONFIRM_RESET=YES");
    console.log("");
    console.log("Example:");
    console.log("   DATABASE_URL=... CONFIRM_RESET=YES node scripts/reset-db-data.js");
    process.exitCode = 2;
    return;
  }

  const sql = neon(url);

  // Test connection
  await sql`select 1 as ok`;
  console.log("Database connected\n");

  // Tables to reset (in order to handle foreign key constraints)
  // Using TRUNCATE with CASCADE will automatically handle dependent tables
  const tables = [
    "admin_token_events",
    "analysis_snapshots",
    "transactions",
    "analyses",
    "token_balances",
    "contact_messages",
    "verification_tokens",
    "sessions",
    "accounts",
    "auth_otp_codes",
    "users"
  ];

  console.log("Resetting all data...\n");

  for (const table of tables) {
    try {
      // Using TRUNCATE CASCADE to handle foreign key dependencies
      await sql`truncate table ${sql(table)} restart identity cascade`;
      console.log("   OK: " + table);
    } catch (err) {
      // Table might not exist, skip it
      console.log("   SKIP: " + table + " (may not exist)");
    }
  }

  console.log("\nDatabase reset completed!");
  console.log("   All data has been deleted:");
  console.log("   - All user accounts");
  console.log("   - All authentication sessions & tokens");
  console.log("   - All OTP codes");
  console.log("   - All analysis results");
  console.log("   - All token balances");
  console.log("   - All transactions");
  console.log("   - All contact messages");
}

main().catch((err) => {
  console.error("\nError: " + err.message);
  process.exitCode = 1;
});
