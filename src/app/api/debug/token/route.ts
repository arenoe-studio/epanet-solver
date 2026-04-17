import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { tokenBalances, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized", session: session ?? null },
      { status: 401 }
    );
  }

  const db = getDb();

  const userRow = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const balanceRow = await db
    .select({
      id: tokenBalances.id,
      userId: tokenBalances.userId,
      balance: tokenBalances.balance,
      totalBought: tokenBalances.totalBought,
      totalUsed: tokenBalances.totalUsed,
      updatedAt: tokenBalances.updatedAt
    })
    .from(tokenBalances)
    .where(eq(tokenBalances.userId, userId))
    .limit(1);

  return NextResponse.json({
    ok: true,
    sessionUser: { userId, email },
    dbUser: userRow[0] ?? null,
    tokenBalance: balanceRow[0] ?? null
  });
}

