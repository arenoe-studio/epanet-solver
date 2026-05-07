import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { transactions, users } from "@/lib/db/schema";
import { getMidtransTransactionStatus, type MidtransTransactionStatus } from "@/lib/midtrans";
import { syncMidtransTransaction } from "@/lib/midtrans-payment-sync";
import { getPaymentProvider } from "@/lib/payment";
import { sendPaymentConfirmationEmail } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function verifySignature(body: MidtransTransactionStatus) {
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

  let body: MidtransTransactionStatus;
  try {
    body = (await req.json()) as MidtransTransactionStatus;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
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

  if (tx.creditedAt) {
    return NextResponse.json({ ok: true });
  }

  const status = await getMidtransTransactionStatus(body.order_id);
  const { creditedNow } = await syncMidtransTransaction(db, tx, status);
  if (!creditedNow) {
    return NextResponse.json({ ok: true });
  }

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
