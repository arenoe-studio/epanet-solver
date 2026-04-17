import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { sql } from "drizzle-orm";

import { issueOtpCode } from "@/lib/auth-otp";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { rateLimitAuth, rateLimitOtpSend } from "@/lib/ratelimit";
import { sendAuthCodeEmail } from "@/lib/resend";
import { getClientIp } from "@/lib/request-ip";
import { ensureInitialTokenBalanceRow } from "@/lib/token-balance";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email(),
  password: z.string().min(12).max(256)
});

export async function POST(request: Request) {
  const env = getServerEnv();
  const ip = getClientIp(request);

  const rl = await rateLimitAuth(`register:${ip}`);
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
  const passwordHash = hashPassword(parsed.data.password);
  const db = getDb();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  if (existing[0]?.id) {
    return NextResponse.json(
      { error: "Email sudah terdaftar. Silakan masuk." },
      { status: 409 }
    );
  }

  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    email,
    name: parsed.data.name ?? null,
    passwordHash
  });

  await ensureInitialTokenBalanceRow(db, userId);

  const otpRl = await rateLimitOtpSend(`verify_email:${email}:${ip}`);
  if (!otpRl.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan kode. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(otpRl.retryAfterSeconds) } }
    );
  }

  const ttl = env.AUTH_OTP_TTL_MINUTES ?? 10;
  const code = await issueOtpCode({
    db,
    email,
    purpose: "verify_email",
    pepper: env.NEXTAUTH_SECRET,
    ttlMinutes: ttl
  });
  await sendAuthCodeEmail({ to: email, code, purpose: "verify_email" });

  return NextResponse.json({ ok: true });
}

