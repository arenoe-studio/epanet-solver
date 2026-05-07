import { and, desc, eq, isNull } from "drizzle-orm";

import type { DbClient } from "@/lib/db";
import { transactions, users } from "@/lib/db/schema";
import { getMidtransTransactionStatus } from "@/lib/midtrans";
import { syncMidtransTransaction } from "@/lib/midtrans-payment-sync";
import { sendPaymentConfirmationEmail } from "@/lib/resend";

type SyncUserTransactionsOptions = {
  userId: string;
  orderId?: string;
  limit?: number;
};

export async function syncUserTransactions(
  db: DbClient,
  opts: SyncUserTransactionsOptions
) {
  const txRows = await db
    .select()
    .from(transactions)
    .where(
      opts.orderId
        ? and(eq(transactions.userId, opts.userId), eq(transactions.orderId, opts.orderId))
        : and(eq(transactions.userId, opts.userId), eq(transactions.status, "pending"), isNull(transactions.creditedAt))
    )
    .orderBy(desc(transactions.createdAt))
    .limit(opts.orderId ? 1 : (opts.limit ?? 5));

  if (txRows.length === 0) {
    return { synced: 0, credited: 0 };
  }

  const userRows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, opts.userId))
    .limit(1);
  const to = userRows[0]?.email ?? "";

  let synced = 0;
  let credited = 0;

  for (const tx of txRows) {
    try {
      const status = await getMidtransTransactionStatus(tx.orderId);
      const { creditedNow } = await syncMidtransTransaction(db, tx, status);
      synced += 1;

      if (creditedNow) {
        credited += 1;
        if (to && tx.tokens && tx.amount) {
          void sendPaymentConfirmationEmail({
            to,
            tokens: tx.tokens,
            amount: tx.amount,
            orderId: tx.orderId
          });
        }
      }
    } catch {
      continue;
    }
  }

  return { synced, credited };
}
