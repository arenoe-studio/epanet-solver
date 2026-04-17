import { NextResponse } from "next/server";
import { z } from "zod";

import { sql } from "drizzle-orm";

import { issueOtpCode } from "@/lib/auth-otp";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";
import { rateLimitAuth, rateLimitOtpSend } from "@/lib/ratelimit";
import { sendAuthCodeEmail } from "@/lib/resend";
import { getClientIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().email()
});

export async function POST(request: Request) {
  const env = getServerEnv();
  const ip = getClientIp(request);

  const rl = await rateLimitAuth(`resend_verify:${ip}`);
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
  const otpRl = await rateLimitOtpSend(`verify_email:${email}:${ip}`);
  if (!otpRl.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan kode. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(otpRl.retryAfterSeconds) } }
    );
  }

  const db = getDb();
  const rows = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  const user = rows[0];
  if (!user?.id) {
    return NextResponse.json(
      { error: "Email tidak ditemukan. Silakan daftar dulu." },
      { status: 404 }
    );
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true });
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

