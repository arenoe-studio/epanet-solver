import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { tokenBalances, transactions, users } from "@/lib/db/schema";
import { getPaymentProvider } from "@/lib/payment";
import { sendPaymentConfirmationEmail } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MidtransWebhookBody = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  payment_type?: string;
};

function verifySignature(body: MidtransWebhookBody) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return false;
  const raw = `${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`;
  const expected = crypto.createHash("sha512").update(raw).digest("hex");
  return body.signature_key === expected;
}

export async function POST(req: Request) {
  if (getPaymentProvider() !== "midtrans") {
    return NextResponse.json({ ok: true });
  }

  const body = (await req.json()) as MidtransWebhookBody;
  if (!verifySignature(body)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.orderId, body.order_id))
    .limit(1);

  const tx = rows[0];
  if (!tx) {
    return NextResponse.json({ ok: true });
  }

  if (tx.status === "paid") {
    return NextResponse.json({ ok: true });
  }

  const status = body.transaction_status;
  const isPaid = status === "settlement" || status === "capture";

  if (!isPaid) {
    const mapped = status === "pending" ? "pending" : "failed";
    await db
      .update(transactions)
      .set({ status: mapped, paymentMethod: body.payment_type ?? null })
      .where(eq(transactions.orderId, body.order_id));
    return NextResponse.json({ ok: true });
  }

  await db.transaction(async (dbTx) => {
    await dbTx
      .update(transactions)
      .set({
        status: "paid",
        paymentMethod: body.payment_type ?? null,
        paidAt: new Date()
      })
      .where(eq(transactions.orderId, body.order_id));

    await dbTx
      .update(tokenBalances)
      .set({
        balance: sql`${tokenBalances.balance} + ${tx.tokens ?? 0}`,
        totalBought: sql`${tokenBalances.totalBought} + ${tx.tokens ?? 0}`
      })
      .where(eq(tokenBalances.userId, tx.userId ?? ""));

    if (tx.userId) {
      const updated = await dbTx
        .select({ id: tokenBalances.id })
        .from(tokenBalances)
        .where(eq(tokenBalances.userId, tx.userId))
        .limit(1);
      if (updated.length === 0) {
        await dbTx.insert(tokenBalances).values({
          userId: tx.userId,
          balance: tx.tokens ?? 0,
          totalBought: tx.tokens ?? 0,
          totalUsed: 0
        });
      }
    }
  });

  if (tx.userId && tx.tokens && tx.amount) {
    const userRow = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, tx.userId))
      .limit(1);

    const to = userRow[0]?.email ?? "";
    if (to) {
      void sendPaymentConfirmationEmail({
        to,
        tokens: tx.tokens,
        amount: tx.amount,
        orderId: tx.orderId
      });
    }
  }

  return NextResponse.json({ ok: true });
}
