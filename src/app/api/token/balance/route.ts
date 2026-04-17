import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { shouldBypassTokensForEmail } from "@/lib/admin";
import { getAuthOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureInitialTokenBalanceRow } from "@/lib/token-balance";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(getAuthOptions());
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (shouldBypassTokensForEmail(userEmail)) {
    return NextResponse.json({ balance: 999999, totalBought: 0, totalUsed: 0 });
  }

  const db = getDb();
  const row = await ensureInitialTokenBalanceRow(db, userId);
  return NextResponse.json(row);
}
