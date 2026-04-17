import { NextResponse } from "next/server";

import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { getSnap, PACKAGES, type PackageKey } from "@/lib/midtrans";
import { rateLimitCreateTransaction } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  package: z.enum(["starter", "value"])
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
  const pkgKey = body.package as PackageKey;
  const pkg = PACKAGES[pkgKey];
  const orderId = `EPANET-${userId.slice(0, 8)}-${Date.now()}`;

  const db = getDb();
  await db.insert(transactions).values({
    userId,
    orderId,
    package: pkgKey,
    tokens: pkg.tokens,
    amount: pkg.amount,
    status: "pending"
  });

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

  return NextResponse.json({ snapToken, orderId });
}
