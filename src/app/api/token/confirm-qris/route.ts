import { NextResponse } from "next/server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { getPaymentAdminEmail, getPaymentProvider } from "@/lib/payment";
import { rateLimitCreateTransaction } from "@/lib/ratelimit";
import { sendAdminPendingPaymentEmail } from "@/lib/resend";
import {
  TOKEN_PACKAGES,
  resolveTokenPackageKey,
  type TokenPackageKey
} from "@/lib/token-packages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  orderId: z.string().min(8),
  package: z.string().transform((value, ctx) => {
    const key = resolveTokenPackageKey(value);
    if (!key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid package"
      });
      return z.NEVER;
    }
    return key;
  }),
  uniqueCode: z.number().int().min(1).max(99)
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimitCreateTransaction(`user:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  if (getPaymentProvider() !== "qris_static") {
    return NextResponse.json({ error: "QRIS static tidak aktif" }, { status: 400 });
  }

  const body = bodySchema.parse(await req.json());
  const pkgKey = body.package as TokenPackageKey;
  const pkg = TOKEN_PACKAGES[pkgKey];

  // Simple guard agar user tidak bisa mengkonfirmasi orderId milik user lain.
  const expectedPrefix = `EPANET-${userId.slice(0, 8)}-`;
  if (!body.orderId.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const baseAmount = pkg.amount;
  const uniqueCode = body.uniqueCode;
  const amount = baseAmount + uniqueCode;

  const db = getDb();

  try {
    await db.insert(transactions).values({
      userId,
      orderId: body.orderId,
      package: pkgKey,
      tokens: pkg.tokens,
      baseAmount,
      uniqueCode,
      amount,
      status: "pending",
      paymentMethod: "qris_static"
    });
  } catch {
    const existing = await db
      .select({
        id: transactions.id,
        orderId: transactions.orderId,
        amount: transactions.amount,
        status: transactions.status
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.orderId, body.orderId)))
      .limit(1);

    if (existing.length) {
      return NextResponse.json({
        ok: true,
        alreadyRecorded: true,
        orderId: existing[0].orderId,
        amount: existing[0].amount,
        status: existing[0].status
      });
    }

    return NextResponse.json({ error: "Gagal mencatat transaksi" }, { status: 500 });
  }

  const adminEmail = getPaymentAdminEmail();
  if (adminEmail) {
    void sendAdminPendingPaymentEmail({
      to: adminEmail,
      userEmail: session.user?.email ?? "",
      userName: session.user?.name ?? "",
      orderId: body.orderId,
      amount,
      tokens: pkg.tokens,
      packageKey: pkgKey,
      packageName: pkg.name
    });
  }

  return NextResponse.json({ ok: true, orderId: body.orderId, amount });
}
