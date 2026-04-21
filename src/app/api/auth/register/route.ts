import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { rateLimitAuth, rateLimitOtpSend } from "@/lib/ratelimit";
import { getRequestOrigin } from "@/lib/request-origin";
import { getResendClient, sendVerifyEmailLinkEmail } from "@/lib/resend";
import { getClientIp } from "@/lib/request-ip";
import { ensureInitialTokenBalanceRow } from "@/lib/token-balance";
import { issueVerificationToken } from "@/lib/verification-token";

export const dynamic = "force-dynamic";

const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .refine((pwd) => /[A-Z]/.test(pwd), {
    message: "Password harus mengandung huruf besar (A-Z)"
  })
  .refine((pwd) => /[a-z]/.test(pwd), {
    message: "Password harus mengandung huruf kecil (a-z)"
  })
  .refine((pwd) => /[0-9]/.test(pwd), {
    message: "Password harus mengandung angka (0-9)"
  })
  .refine((pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd), {
    message: "Password harus mengandung simbol (!@#$%^&* dll)"
  });

const bodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    email: z.string().trim().email(),
    password: passwordSchema,
    confirmPassword: z.string().min(1).optional()
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"]
  });

export async function POST(request: Request) {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return NextResponse.json(
      { error: "Konfigurasi server belum lengkap. Coba lagi nanti." },
      { status: 500 }
    );
  }
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
    const errorMessages = parsed.error.issues.map((issue) => issue.message);
    return NextResponse.json(
      { error: errorMessages[0] ?? "Input tidak valid" },
      { status: 422 }
    );
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

  const otpRl = await rateLimitOtpSend(`verify_email:${email}:${ip}`);
  if (!otpRl.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan verifikasi. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(otpRl.retryAfterSeconds) } }
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

  const origin = getRequestOrigin(request);
  const identifier = `verify_email:${email}`;

  let token: string;
  try {
    const issued = await issueVerificationToken({
      db,
      identifier,
      secret: env.NEXTAUTH_SECRET,
      ttlMs: 24 * 60 * 60_000
    });
    token = issued.token;
  } catch {
    // Best-effort cleanup to avoid creating a user that can't be verified.
    try {
      await db.delete(users).where(eq(users.id, userId));
    } catch {}

    return NextResponse.json(
      { error: "Gagal membuat link verifikasi. Coba lagi nanti." },
      { status: 500 }
    );
  }

  let emailSent = false;
  if (getResendClient()) {
    try {
      const verifyUrl = `${origin}/api/auth/verify-email?email=${encodeURIComponent(
        email
      )}&token=${encodeURIComponent(token)}`;
      await sendVerifyEmailLinkEmail({
        to: email,
        name: parsed.data.name ?? null,
        verifyUrl
      });
      emailSent = true;
    } catch {
      emailSent = false;
    }
  }

  return NextResponse.json({ ok: true, emailSent });
}
