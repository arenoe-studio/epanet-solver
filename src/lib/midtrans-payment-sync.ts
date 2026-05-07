import { eq } from "drizzle-orm";

import type { DbClient } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { creditPaidTransaction } from "@/lib/payment-credit";
import type { MidtransTransactionStatus } from "@/lib/midtrans";

type SyncResult = {
  status: "pending" | "paid" | "failed";
  creditedNow: boolean;
};

function normalizeMidtransStatus(
  status: MidtransTransactionStatus
): SyncResult["status"] {
  if (status.transaction_status === "settlement") return "paid";
  if (status.transaction_status === "capture") {
    return status.fraud_status === "challenge" ? "pending" : "paid";
  }
  if (status.transaction_status === "pending" || status.transaction_status === "authorize") {
    return "pending";
  }
  return "failed";
}

export async function syncMidtransTransaction(
  db: DbClient,
  tx: typeof transactions.$inferSelect,
  status: MidtransTransactionStatus
): Promise<SyncResult> {
  if (tx.creditedAt) {
    return { status: "paid", creditedNow: false };
  }

  const normalizedStatus = normalizeMidtransStatus(status);
  if (normalizedStatus === "paid") {
    const creditedNow = await creditPaidTransaction(
      db,
      { orderId: tx.orderId },
      status.payment_type ?? tx.paymentMethod
    );
    return { status: "paid", creditedNow };
  }

  await db
    .update(transactions)
    .set({
      status: normalizedStatus,
      paymentMethod: status.payment_type ?? tx.paymentMethod
    })
    .where(eq(transactions.id, tx.id));

  return { status: normalizedStatus, creditedNow: false };
}
