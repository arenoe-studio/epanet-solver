import { NextResponse } from "next/server";

import { desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { transactions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: transactions.id,
      orderId: transactions.orderId,
      package: transactions.package,
      tokens: transactions.tokens,
      amount: transactions.amount,
      status: transactions.status,
      paymentMethod: transactions.paymentMethod,
      createdAt: transactions.createdAt,
      paidAt: transactions.paidAt
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(20);

  return NextResponse.json({ items: rows });
}

