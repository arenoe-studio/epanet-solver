import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import crypto from "node:crypto";
import { z } from "zod";

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter } from "next-auth/adapters";

import { eq, sql } from "drizzle-orm";

import { isAdminEmail } from "@/lib/admin";
import { consumeOtpCode } from "@/lib/auth-otp";
import { getServerEnv } from "@/lib/env";
import { getDb, type DrizzleDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { ensureInitialTokenBalanceRow } from "@/lib/token-balance";
import {
  accounts,
  sessions,
  users,
  verificationTokens
} from "@/lib/db/schema";

export function getAuthOptions(): NextAuthOptions {
  const env = getServerEnv();
  const db = getDb();
  const baseAdapter = DrizzleAdapter(db as DrizzleDb, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens
  }) as Adapter;
  type CreateUserFn = NonNullable<Adapter["createUser"]>;

  return {
    secret: env.NEXTAUTH_SECRET,
    adapter: {
      ...baseAdapter,
      async createUser(data: Parameters<CreateUserFn>[0]) {
        // NextAuth (OAuth) may call createUser without an id.
        // Our schema uses text PK without a DB default, so we generate one.
        const existingId = (data as { id?: string }).id;
        return (baseAdapter.createUser as CreateUserFn)({
          ...data,
          id: existingId ?? crypto.randomUUID()
        });
      }
    },
    providers: [
      CredentialsProvider({
        id: "credentials",
        name: "Email & Password",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
          otp: { label: "Kode", type: "text" }
        },
        async authorize(rawCredentials) {
          const credsSchema = z.object({
            email: z.string().email(),
            password: z.string().min(1),
            otp: z.string().min(1).optional()
          });
          const parsed = credsSchema.safeParse(rawCredentials);
          if (!parsed.success) return null;

          const email = parsed.data.email.trim().toLowerCase();
          const password = parsed.data.password;
          const otp = parsed.data.otp?.trim();
          const now = new Date();

          const found = await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
              emailVerified: users.emailVerified,
              passwordHash: users.passwordHash,
              mfaEnabled: users.mfaEnabled,
              loginFailedCount: users.loginFailedCount,
              loginLockedUntil: users.loginLockedUntil
            })
            .from(users)
            .where(sql`lower(${users.email}) = lower(${email})`)
            .limit(1);

          const user = found[0];
          if (!user?.id) return null;
          if (!user.passwordHash) return null;
          if (user.loginLockedUntil && user.loginLockedUntil > now) return null;

          const passwordOk = verifyPassword(password, user.passwordHash);
          if (!passwordOk) {
            const nextFailed = (user.loginFailedCount ?? 0) + 1;
            const lock =
              nextFailed >= 10 ? new Date(now.getTime() + 15 * 60_000) : null;
            await db
              .update(users)
              .set({
                loginFailedCount: nextFailed,
                loginLockedUntil: lock
              })
              .where(eq(users.id, user.id));
            return null;
          }

          if ((user.loginFailedCount ?? 0) !== 0 || user.loginLockedUntil) {
            await db
              .update(users)
              .set({
                loginFailedCount: 0,
                loginLockedUntil: null
              })
              .where(eq(users.id, user.id));
          }

          if (!user.emailVerified) return null;

          if (user.mfaEnabled) {
            if (!otp) return null;
            const ok = await consumeOtpCode({
              db,
              email,
              purpose: "login",
              pepper: env.NEXTAUTH_SECRET,
              code: otp
            });
            if (!ok) return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image
          };
        }
      })
    ],
    pages: {
      signIn: "/login"
    },
    session: {
      strategy: "jwt"
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          token.isAdmin = isAdminEmail(user.email ?? "");
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.id as string;
          session.user.isAdmin = token.isAdmin as boolean;
        } else {
          session.user = {
            id: token.id as string,
            isAdmin: token.isAdmin as boolean,
          };
        }
        return session;
      }
    },
    events: {
      async createUser(message) {
        const userId = message.user.id;
        if (!userId) return;

        const db = getDb();
        await ensureInitialTokenBalanceRow(db, userId);
      }
    }
  };
}
