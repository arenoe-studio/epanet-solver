import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";
import { getRequestOrigin } from "@/lib/request-origin";
import { rateLimitAuth, rateLimitOtpSend } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";
import { getResendClient, sendResetPasswordLinkEmail } from "@/lib/resend";
import { issueVerificationToken } from "@/lib/verification-token";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().email()
});

export async function POST(request: Request) {
  const env = getServerEnv();
  const ip = getClientIp(request);

  const rl = await rateLimitAuth(`forgot_password:${ip}`);
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
    return NextResponse.json({ ok: true });
  }

  const email = parsed.data.email.toLowerCase();
  const db = getDb();

  const rows = await db
    .select({ name: users.name })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  const user = rows[0];

  // Anti-enumeration: selalu return ok.
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const sendRl = await rateLimitOtpSend(`reset_password:${email}:${ip}`);
  if (!sendRl.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(sendRl.retryAfterSeconds) } }
    );
  }

  const origin = getRequestOrigin(request);
  const identifier = `reset_password:${email}`;

  const issued = await issueVerificationToken({
    db,
    identifier,
    secret: env.NEXTAUTH_SECRET,
    ttlMs: 60 * 60_000
  });

  if (getResendClient()) {
    try {
      const resetUrl = `${origin}/reset-password?email=${encodeURIComponent(
        email
      )}&token=${encodeURIComponent(issued.token)}`;
      await sendResetPasswordLinkEmail({ to: email, resetUrl });
    } catch {
      // Best-effort: jangan bocorkan detail ke client.
    }
  }

  return NextResponse.json({ ok: true });
}

