import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { authOtpCodes } from "@/lib/db/schema";
import { generateOtpCode, hashOtpCode, type OtpPurpose } from "@/lib/otp";

const MAX_ATTEMPTS = 5;

export async function issueOtpCode(opts: {
  db: any;
  email: string;
  purpose: OtpPurpose;
  pepper: string;
  ttlMinutes: number;
}): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + opts.ttlMinutes * 60_000);
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code, opts.pepper);

  await opts.db
    .delete(authOtpCodes)
    .where(
      and(
        eq(authOtpCodes.email, opts.email),
        eq(authOtpCodes.purpose, opts.purpose),
        isNull(authOtpCodes.consumedAt)
      )
    );

  await opts.db.insert(authOtpCodes).values({
    email: opts.email,
    purpose: opts.purpose,
    codeHash,
    expiresAt
  });

  return code;
}

export async function consumeOtpCode(opts: {
  db: any;
  email: string;
  purpose: OtpPurpose;
  pepper: string;
  code: string;
}): Promise<boolean> {
  const now = new Date();
  const rows = await opts.db
    .select({
      id: authOtpCodes.id,
      codeHash: authOtpCodes.codeHash,
      attempts: authOtpCodes.attempts
    })
    .from(authOtpCodes)
    .where(
      and(
        eq(authOtpCodes.email, opts.email),
        eq(authOtpCodes.purpose, opts.purpose),
        isNull(authOtpCodes.consumedAt),
        gt(authOtpCodes.expiresAt, now)
      )
    )
    .orderBy(desc(authOtpCodes.id))
    .limit(1);

  const row = rows[0];
  if (!row) return false;

  if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
    await opts.db
      .update(authOtpCodes)
      .set({ consumedAt: now })
      .where(eq(authOtpCodes.id, row.id));
    return false;
  }

  const expected = row.codeHash;
  const actual = hashOtpCode(opts.code, opts.pepper);
  if (expected !== actual) {
    const nextAttempts = (row.attempts ?? 0) + 1;
    await opts.db
      .update(authOtpCodes)
      .set(
        nextAttempts >= MAX_ATTEMPTS
          ? { attempts: nextAttempts, consumedAt: now }
          : { attempts: nextAttempts }
      )
      .where(eq(authOtpCodes.id, row.id));
    return false;
  }

  await opts.db
    .update(authOtpCodes)
    .set({ consumedAt: now })
    .where(eq(authOtpCodes.id, row.id));
  return true;
}
