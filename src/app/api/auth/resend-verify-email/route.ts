import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";
import { getRequestOrigin } from "@/lib/request-origin";
import { rateLimitAuth, rateLimitOtpSend } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";
import { getResendClient, sendVerifyEmailLinkEmail } from "@/lib/resend";
import { issueVerificationToken } from "@/lib/verification-token";

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
  const db = getDb();

  const rows = await db
    .select({ name: users.name, emailVerified: users.emailVerified })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  const user = rows[0];

  // Anti-enumeration: tetap balas ok meskipun user tidak ada / sudah verified.
  if (!user || user.emailVerified) {
    return NextResponse.json({ ok: true, emailSent: true });
  }

  const otpRl = await rateLimitOtpSend(`verify_email:${email}:${ip}`);
  if (!otpRl.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan verifikasi. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(otpRl.retryAfterSeconds) } }
    );
  }

  const origin = getRequestOrigin(request);
  const identifier = `verify_email:${email}`;

  const issued = await issueVerificationToken({
    db,
    identifier,
    secret: env.NEXTAUTH_SECRET,
    ttlMs: 24 * 60 * 60_000
  });

  let emailSent = false;
  if (getResendClient()) {
    try {
      const verifyUrl = `${origin}/api/auth/verify-email?email=${encodeURIComponent(
        email
      )}&token=${encodeURIComponent(issued.token)}`;
      await sendVerifyEmailLinkEmail({
        to: email,
        name: user.name ?? null,
        verifyUrl
      });
      emailSent = true;
    } catch {
      emailSent = false;
    }
  }

  return NextResponse.json({ ok: true, emailSent });
}

