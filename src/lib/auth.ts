import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import crypto from "node:crypto";

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import type { Adapter } from "next-auth/adapters";

import { isAdminEmail } from "@/lib/admin";
import { getServerEnv } from "@/lib/env";
import { getDb } from "@/lib/db";
import {
  accounts,
  sessions,
  tokenBalances,
  users,
  verificationTokens
} from "@/lib/db/schema";

export function getAuthOptions(): NextAuthOptions {
  const env = getServerEnv();
  const db = getDb();
  const baseAdapter = DrizzleAdapter(db, {
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
      GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET
      })
    ],
    session: {
      strategy: "database"
    },
    callbacks: {
      async session({ session }) {
        const email = session.user?.email;
        const userIsAdmin = isAdminEmail(email);
        if (session.user) {
          session.user.isAdmin = userIsAdmin;
        } else {
          session.user = { isAdmin: userIsAdmin };
        }
        return session;
      }
    },
    events: {
      async createUser(message) {
        const userId = message.user.id;
        if (!userId) return;

        const db = getDb();
        const existing = await db
          .select({ id: tokenBalances.id })
          .from(tokenBalances)
          .where(eq(tokenBalances.userId, userId))
          .limit(1);

        if (existing.length > 0) return;

        await db.insert(tokenBalances).values({
          userId,
          balance: 6,
          totalBought: 6,
          totalUsed: 0
        });
      }
    }
  };
}
