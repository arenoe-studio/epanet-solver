import {
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

// Auth.js / NextAuth (Drizzle Adapter) tables
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: text("image"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow()
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email)
  })
);

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state")
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] })
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull()
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] })
  })
);

// App tables (PRD)
export const tokenBalances = pgTable(
  "token_balances",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    balance: integer("balance").default(0),
    totalBought: integer("total_bought").default(0),
    totalUsed: integer("total_used").default(0),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow()
  },
  (table) => ({
    userIdUnique: uniqueIndex("token_balances_user_id_unique").on(table.userId)
  })
);

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  fileName: text("file_name"),
  kind: text("kind").notNull().default("optimize"), // optimize | fix_pressure
  parentAnalysisId: integer("parent_analysis_id"),
  status: text("status"), // success | failed | processing
  nodesCount: integer("nodes_count"),
  pipesCount: integer("pipes_count"),
  issuesFound: integer("issues_found"),
  issuesFixed: integer("issues_fixed"),
  tokensUsed: integer("tokens_used").default(6),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow()
});

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    orderId: text("order_id").notNull(),
    package: text("package"), // starter | value
    tokens: integer("tokens"),
    amount: integer("amount"),
    status: text("status"), // pending | paid | failed
    paymentMethod: text("payment_method"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    paidAt: timestamp("paid_at", { mode: "date" })
  },
  (table) => ({
    orderUnique: uniqueIndex("transactions_order_id_unique").on(table.orderId)
  })
);
