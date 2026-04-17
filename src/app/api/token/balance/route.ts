import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { shouldBypassTokensForEmail } from "@/lib/admin";
import { getAuthOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { tokenBalances } from "@/lib/db/schema";

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
  const rows = await db
    .select({
      balance: tokenBalances.balance,
      totalBought: tokenBalances.totalBought,
      totalUsed: tokenBalances.totalUsed
    })
    .from(tokenBalances)
    .where(eq(tokenBalances.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    await db.insert(tokenBalances).values({
      userId,
      balance: 0,
      totalBought: 0,
      totalUsed: 0
    });
    return NextResponse.json({ balance: 0, totalBought: 0, totalUsed: 0 });
  }

  return NextResponse.json({
    balance: row.balance ?? 0,
    totalBought: row.totalBought ?? 0,
    totalUsed: row.totalUsed ?? 0
  });
}
