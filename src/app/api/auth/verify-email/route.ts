import { NextResponse } from "next/server";
import { z } from "zod";

import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";
import { rateLimitAuth } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";
import { consumeVerificationToken } from "@/lib/verification-token";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  email: z.string().trim().email(),
  token: z.string().trim().min(10)
});

export async function GET(request: Request) {
  const env = getServerEnv();
  const ip = getClientIp(request);

  const url = new URL(request.url);
  const rawEmail = (url.searchParams.get("email") ?? "").trim();
  const parsed = querySchema.safeParse({
    email: rawEmail,
    token: url.searchParams.get("token") ?? ""
  });

  if (!parsed.success) {
    const qp = new URLSearchParams();
    if (rawEmail) qp.set("email", rawEmail);
    qp.set("reason", "invalid");
    return NextResponse.redirect(new URL(`/verify-email-notice?${qp.toString()}`, url));
  }

  const email = parsed.data.email.toLowerCase();

  const rl = await rateLimitAuth(`verify_email_link:${ip}:${email}`);
  if (!rl.ok) {
    return NextResponse.redirect(
      new URL(
        `/verify-email-notice?email=${encodeURIComponent(email)}&reason=invalid`,
        url
      )
    );
  }

  const db = getDb();
  const identifier = `verify_email:${email}`;
  const res = await consumeVerificationToken({
    db,
    identifier,
    token: parsed.data.token,
    secret: env.NEXTAUTH_SECRET
  });

  if (res === "expired") {
    return NextResponse.redirect(
      new URL(
        `/verify-email-notice?email=${encodeURIComponent(email)}&reason=expired`,
        url
      )
    );
  }

  if (res !== "ok") {
    return NextResponse.redirect(
      new URL(
        `/verify-email-notice?email=${encodeURIComponent(email)}&reason=invalid`,
        url
      )
    );
  }

  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(sql`lower(${users.email}) = lower(${email})`);

  return NextResponse.redirect(
    new URL(`/login?verified=1&email=${encodeURIComponent(email)}`, url)
  );
}
