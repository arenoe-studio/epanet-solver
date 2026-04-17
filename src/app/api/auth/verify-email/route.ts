import { NextResponse } from "next/server";
import { z } from "zod";

import { sql } from "drizzle-orm";

import { consumeOtpCode } from "@/lib/auth-otp";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";
import { rateLimitAuth } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().min(6).max(6)
});

export async function POST(request: Request) {
  const env = getServerEnv();
  const ip = getClientIp(request);
  const rl = await rateLimitAuth(`verify_email:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  }

  const email = parsed.data.email.toLowerCase();
  const db = getDb();

  const ok = await consumeOtpCode({
    db,
    email,
    purpose: "verify_email",
    pepper: env.NEXTAUTH_SECRET,
    code: parsed.data.code
  });

  if (!ok) {
    return NextResponse.json({ error: "Kode salah atau kadaluarsa." }, { status: 400 });
  }

  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(sql`lower(${users.email}) = lower(${email})`);

  return NextResponse.json({ ok: true });
}
