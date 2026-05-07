import { NextResponse } from "next/server";

import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { syncUserTransactions } from "@/lib/transaction-status-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  orderId: z.string().trim().min(1).optional()
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    const raw = await req.json().catch(() => ({}));
    parsed = bodySchema.safeParse(raw);
  } catch {
    parsed = bodySchema.safeParse({});
  }

  if (!parsed.success) {
    return NextResponse.json({ error: "Input tidak valid" }, { status: 422 });
  }

  const db = getDb();
  const result = await syncUserTransactions(db, {
    userId,
    orderId: parsed.data.orderId,
    limit: 5
  });

  return NextResponse.json({ ok: true, ...result });
}
