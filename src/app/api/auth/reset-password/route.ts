import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";

import { consumeVerificationToken } from "@/lib/verification-token";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { rateLimitAuth } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";

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
  .refine((pwd) => /[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]/.test(pwd), {
    message: "Password harus mengandung simbol (!@#$%^&* dll)"
  });

const bodySchema = z
  .object({
    email: z.string().trim().email(),
    token: z.string().trim().min(10),
    password: passwordSchema,
    confirmPassword: z.string().min(1).optional()
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"]
  });

export async function POST(request: Request) {
  const env = getServerEnv();
  const ip = getClientIp(request);

  const rl = await rateLimitAuth(`reset_password:${ip}`);
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
  const db = getDb();

  const identifier = `reset_password:${email}`;
  const tokenRes = await consumeVerificationToken({
    db,
    identifier,
    token: parsed.data.token,
    secret: env.NEXTAUTH_SECRET
  });

  if (tokenRes !== "ok") {
    return NextResponse.json(
      { error: "Link reset tidak valid atau kadaluarsa." },
      { status: 400 }
    );
  }

  const passwordHash = hashPassword(parsed.data.password);
  const updated = await db
    .update(users)
    .set({
      passwordHash,
      loginFailedCount: 0,
      loginLockedUntil: null
    })
    .where(sql`lower(${users.email}) = lower(${email})`);

  // Drizzle returns a Result; no reliable rowCount in all drivers, so we just respond ok.
  void updated;

  return NextResponse.json({ ok: true });
}
