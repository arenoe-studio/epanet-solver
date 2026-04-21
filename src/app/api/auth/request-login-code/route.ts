import { NextResponse } from "next/server";
import { z } from "zod";

import { eq, sql } from "drizzle-orm";

import { issueOtpCode } from "@/lib/auth-otp";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";
import { verifyPassword } from "@/lib/password";
import { rateLimitAuth, rateLimitOtpSend } from "@/lib/ratelimit";
import { sendAuthCodeEmail } from "@/lib/resend";
import { getClientIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const env = getServerEnv();
  const ip = getClientIp(request);

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

  const rl = await rateLimitAuth(`request_login_code:${ip}:${email}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      emailVerified: users.emailVerified,
      loginFailedCount: users.loginFailedCount,
      loginLockedUntil: users.loginLockedUntil
    })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  const user = rows[0];
  const now = new Date();
  if (!user?.id || !user.passwordHash) {
    return NextResponse.json(
      { error: "Email atau password salah." },
      { status: 401 }
    );
  }

  if (user.loginLockedUntil && user.loginLockedUntil > now) {
    return NextResponse.json(
      { error: "Akun dikunci sementara. Coba lagi nanti." },
      { status: 429 }
    );
  }

  const passOk = verifyPassword(parsed.data.password, user.passwordHash);
  if (!passOk) {
    const nextFailed = (user.loginFailedCount ?? 0) + 1;
    const lock =
      nextFailed >= 5 ? new Date(now.getTime() + 15 * 60_000) : null;
    await db
      .update(users)
      .set({
        loginFailedCount: nextFailed,
        loginLockedUntil: lock
      })
      .where(eq(users.id, user.id));
    return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { error: "Email belum diverifikasi. Silakan verifikasi dulu." },
      { status: 403 }
    );
  }

  const otpRl = await rateLimitOtpSend(`login:${email}:${ip}`);
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
    purpose: "login",
    pepper: env.NEXTAUTH_SECRET,
    ttlMinutes: ttl
  });

  await sendAuthCodeEmail({ to: email, code, purpose: "login" });

  return NextResponse.json({ ok: true });
}
