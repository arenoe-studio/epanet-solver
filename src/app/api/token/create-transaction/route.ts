import { NextResponse } from "next/server";

import { randomInt } from "crypto";
import { z } from "zod";

import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { transactions, users } from "@/lib/db/schema";
import { getSnap } from "@/lib/midtrans";
import { getPaymentProvider, getQrisStaticConfig } from "@/lib/payment";
import { rateLimitCreateTransaction } from "@/lib/ratelimit";
import {
  TOKEN_PACKAGES,
  resolveTokenPackageKey,
  type TokenPackageKey
} from "@/lib/token-packages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
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
  })
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user?.email?.trim()) {
    return NextResponse.json(
      { error: "Email akun belum tersedia. Silakan logout lalu login ulang." },
      { status: 401 }
    );
  }

  const rl = await rateLimitCreateTransaction(`user:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const body = bodySchema.parse(await req.json());
  const pkgKey = body.package as TokenPackageKey;
  const pkg = TOKEN_PACKAGES[pkgKey];
  const orderId = `EPANET-${userId.slice(0, 8)}-${Date.now()}`;

  const db = getDb();
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRows.length === 0) {
    await db.insert(users).values({
      id: userId,
      email: session.user.email.trim(),
      name: session.user?.name?.trim() ? session.user.name.trim() : null
    });
  }

  const provider = getPaymentProvider();

  if (provider === "midtrans") {
    const snapToken = await getSnap().createTransactionToken({
      transaction_details: { order_id: orderId, gross_amount: pkg.amount },
      customer_details: {
        email: session.user?.email ?? "",
        first_name: session.user?.name ?? ""
      },
      item_details: [
        { id: pkgKey, name: pkg.name, price: pkg.amount, quantity: 1 }
      ]
    });

    const snapTokenExpiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000);
    await db.insert(transactions).values({
      userId,
      orderId,
      package: pkgKey,
      tokens: pkg.tokens,
      amount: pkg.amount,
      status: "pending",
      paymentMethod: "midtrans",
      snapToken,
      snapTokenExpiresAt
    });

    return NextResponse.json({ provider, snapToken, orderId });
  }

  const qris = getQrisStaticConfig();
  if (!qris) {
    return NextResponse.json(
      {
        error:
          "Metode pembayaran QRIS belum dikonfigurasi. Set NEXT_PUBLIC_QRIS_STATIC_QR_IMAGE_URL."
      },
      { status: 500 }
    );
  }

  // QRIS static: jangan langsung mencatat transaksi sebelum user konfirmasi.
  const uniqueCode = randomInt(1, 100); // 1..99
  const baseAmount = pkg.amount;
  const amount = baseAmount + uniqueCode;

  return NextResponse.json({
    provider,
    orderId,
    qris,
    baseAmount,
    uniqueCode,
    amount,
    tokens: pkg.tokens,
    package: pkgKey
  });
}
