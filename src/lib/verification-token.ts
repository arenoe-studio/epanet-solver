import crypto from "node:crypto";

import { and, eq, gt } from "drizzle-orm";

import type { DbClient } from "@/lib/db";
import { verificationTokens } from "@/lib/db/schema";

function hashToken(token: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function issueVerificationToken(opts: {
  db: DbClient;
  identifier: string;
  secret: string;
  ttlMs: number;
}): Promise<{ token: string; expires: Date }> {
  const now = new Date();
  const expires = new Date(now.getTime() + opts.ttlMs);
  const token = generateToken();
  const tokenHash = hashToken(token, opts.secret);

  await opts.db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, opts.identifier));
  await opts.db.insert(verificationTokens).values({
    identifier: opts.identifier,
    token: tokenHash,
    expires
  });

  return { token, expires };
}

export async function consumeVerificationToken(opts: {
  db: DbClient;
  identifier: string;
  token: string;
  secret: string;
}): Promise<"ok" | "expired" | "invalid"> {
  const now = new Date();
  const tokenHash = hashToken(opts.token, opts.secret);

  const rows = await opts.db
    .select({
      expires: verificationTokens.expires
    })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, opts.identifier),
        eq(verificationTokens.token, tokenHash)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return "invalid";

  if (!(row.expires && row.expires > now)) {
    await opts.db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, opts.identifier));
    return "expired";
  }

  await opts.db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, opts.identifier),
        eq(verificationTokens.token, tokenHash)
      )
    );
  return "ok";
}

export async function hasUnexpiredVerificationToken(opts: {
  db: DbClient;
  identifier: string;
}): Promise<boolean> {
  const now = new Date();
  const rows = await opts.db
    .select({ identifier: verificationTokens.identifier })
    .from(verificationTokens)
    .where(
      and(eq(verificationTokens.identifier, opts.identifier), gt(verificationTokens.expires, now))
    )
    .limit(1);
  return !!rows[0]?.identifier;
}

