import { NextResponse } from "next/server";

import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { getSnap } from "@/lib/midtrans";
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
  const db = getDb();
  await db.insert(transactions).values({
    userId,
    orderId,
    package: pkgKey,
    tokens: pkg.tokens,
    amount: pkg.amount,
    status: "pending",
    snapToken,
    snapTokenExpiresAt
  });

  return NextResponse.json({ snapToken, orderId });
}
