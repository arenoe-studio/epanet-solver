import { eq } from "drizzle-orm";

import type { getDb } from "@/lib/db";
import { tokenBalances } from "@/lib/db/schema";

type Db = ReturnType<typeof getDb>;

export const INITIAL_FREE_TOKENS = 6;

export async function ensureInitialTokenBalanceRow(db: Db, userId: string) {
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
      balance: INITIAL_FREE_TOKENS,
      totalBought: INITIAL_FREE_TOKENS,
      totalUsed: 0
    });
    return { balance: INITIAL_FREE_TOKENS, totalBought: INITIAL_FREE_TOKENS, totalUsed: 0 };
  }

  const balance = row.balance ?? 0;
  const totalBought = row.totalBought ?? 0;
  const totalUsed = row.totalUsed ?? 0;

  if (balance === 0 && totalBought === 0 && totalUsed === 0) {
    await db
      .update(tokenBalances)
      .set({
        balance: INITIAL_FREE_TOKENS,
        totalBought: INITIAL_FREE_TOKENS,
        updatedAt: new Date()
      })
      .where(eq(tokenBalances.userId, userId));
    return { balance: INITIAL_FREE_TOKENS, totalBought: INITIAL_FREE_TOKENS, totalUsed: 0 };
  }

  return { balance, totalBought, totalUsed };
}

