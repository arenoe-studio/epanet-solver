import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import crypto from "node:crypto";

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter } from "next-auth/adapters";

import { isAdminEmail } from "@/lib/admin";
import { getServerEnv } from "@/lib/env";
import { getDb } from "@/lib/db";
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
      async session({ session, user }) {
        const email = session.user?.email;
        const userIsAdmin = isAdminEmail(email);
        if (session.user) {
          session.user.isAdmin = userIsAdmin;
          if (user?.id && !session.user.id) {
            session.user.id = user.id;
          }
        } else {
          session.user = { isAdmin: userIsAdmin, id: user?.id };
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
