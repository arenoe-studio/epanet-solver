"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";
import { eq, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { adminTokenEvents, contactMessages, tokenBalances, transactions, users } from "@/lib/db/schema";
import { sendPaymentConfirmationEmail } from "@/lib/resend";

const adjustTokensSchema = z.object({
  userId: z.string().min(1),
  kind: z.enum(["grant", "refund", "revoke"]),
  amount: z.coerce.number().int().positive().max(1_000_000),
  note: z.string().max(500).optional()
});

export async function adminAdjustTokens(formData: FormData) {
  const parsed = adjustTokensSchema.safeParse({
    userId: formData.get("userId"),
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    note: formData.get("note") ?? undefined
  });
  if (!parsed.success) return;

  const { email: adminEmail } = await requireAdmin();
  const { userId, kind, amount, note } = parsed.data;
  const delta = kind === "revoke" ? -amount : amount;

  const db = getDb();
  await db.transaction(async (dbTx) => {
    const rows = await dbTx
      .select({
        id: tokenBalances.id,
        balance: tokenBalances.balance,
        totalBought: tokenBalances.totalBought,
        totalUsed: tokenBalances.totalUsed
      })
      .from(tokenBalances)
      .where(eq(tokenBalances.userId, userId))
      .limit(1);

    const existing = rows[0];
    const beforeBalance = existing?.balance ?? 0;
    const beforeBought = existing?.totalBought ?? 0;
    const beforeUsed = existing?.totalUsed ?? 0;

    const afterBalance = Math.max(0, beforeBalance + delta);
    const afterBought =
      kind === "grant" ? beforeBought + amount : beforeBought;
    const afterUsed =
      kind === "refund"
        ? Math.max(0, beforeUsed - amount)
        : beforeUsed;

    if (!existing?.id) {
      await dbTx.insert(tokenBalances).values({
        userId,
        balance: afterBalance,
        totalBought: afterBought,
        totalUsed: afterUsed,
        updatedAt: new Date()
      });
    } else {
      await dbTx
        .update(tokenBalances)
        .set({
          balance: afterBalance,
          totalBought: afterBought,
          totalUsed: afterUsed,
          updatedAt: new Date()
        })
        .where(eq(tokenBalances.userId, userId));
    }

    await dbTx.insert(adminTokenEvents).values({
      userId,
      adminEmail,
      kind,
      delta,
      balanceBefore: beforeBalance,
      balanceAfter: afterBalance,
      note: note?.trim() ? note.trim() : null
    });
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/admin/ledger");
}

const setTokensSchema = z.object({
  userId: z.string().min(1),
  newBalance: z.coerce.number().int().min(0).max(1_000_000),
  note: z.string().max(500).optional()
});

export async function adminSetTokens(formData: FormData) {
  const parsed = setTokensSchema.safeParse({
    userId: formData.get("userId"),
    newBalance: formData.get("newBalance"),
    note: formData.get("note") ?? undefined
  });
  if (!parsed.success) return;

  const { email: adminEmail } = await requireAdmin();
  const { userId, newBalance, note } = parsed.data;

  const db = getDb();
  await db.transaction(async (dbTx) => {
    const rows = await dbTx
      .select({
        id: tokenBalances.id,
        balance: tokenBalances.balance,
        totalBought: tokenBalances.totalBought,
        totalUsed: tokenBalances.totalUsed
      })
      .from(tokenBalances)
      .where(eq(tokenBalances.userId, userId))
      .limit(1);

    const existing = rows[0];
    const beforeBalance = existing?.balance ?? 0;
    const beforeBought = existing?.totalBought ?? 0;
    const beforeUsed = existing?.totalUsed ?? 0;
    const delta = newBalance - beforeBalance;

    const afterBought = delta > 0 ? beforeBought + delta : beforeBought;

    if (!existing?.id) {
      await dbTx.insert(tokenBalances).values({
        userId,
        balance: newBalance,
        totalBought: afterBought,
        totalUsed: beforeUsed,
        updatedAt: new Date()
      });
    } else {
      await dbTx
        .update(tokenBalances)
        .set({
          balance: newBalance,
          totalBought: afterBought,
          updatedAt: new Date()
        })
        .where(eq(tokenBalances.userId, userId));
    }

    await dbTx.insert(adminTokenEvents).values({
      userId,
      adminEmail,
      kind: "set",
      delta,
      balanceBefore: beforeBalance,
      balanceAfter: newBalance,
      note: note?.trim() ? note.trim() : null
    });
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/admin/ledger");
}

const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  verified: z.enum(["yes", "no"]).optional()
});

export async function adminUpdateUser(formData: FormData) {
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name") ?? undefined,
    verified: formData.get("verified") ?? undefined
  });
  if (!parsed.success) return;

  await requireAdmin();
  const { userId, name, verified } = parsed.data;

  const db = getDb();
  await db
    .update(users)
    .set({
      name: name?.trim() ? name.trim() : null,
      emailVerified: verified === "yes" ? new Date() : null
    })
    .where(eq(users.id, userId));

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

const updateReportSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["open", "resolved", "spam"]).optional(),
  adminNotes: z.string().max(2000).optional()
});

export async function adminUpdateReport(formData: FormData) {
  const parsed = updateReportSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status") ?? undefined,
    adminNotes: formData.get("adminNotes") ?? undefined
  });
  if (!parsed.success) return;

  await requireAdmin();
  const { id, status, adminNotes } = parsed.data;

  const db = getDb();
  await db
    .update(contactMessages)
    .set({
      status: status ?? undefined,
      adminNotes: adminNotes?.trim() ? adminNotes.trim() : null
    })
    .where(eq(contactMessages.id, id));

  revalidatePath(`/admin/reports/${id}`);
  revalidatePath("/admin/reports");
}

const updateTxSchema = z.object({
  transactionId: z.coerce.number().int().positive(),
  status: z.enum(["pending", "paid", "failed"]),
  paymentMethod: z.string().max(100).optional()
});

export async function adminUpdateTransaction(formData: FormData) {
  const parsed = updateTxSchema.safeParse({
    transactionId: formData.get("transactionId"),
    status: formData.get("status"),
    paymentMethod: formData.get("paymentMethod") ?? undefined
  });
  if (!parsed.success) return;

  await requireAdmin();
  const { transactionId, status, paymentMethod } = parsed.data;

  const db = getDb();
  const txRows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  const tx = txRows[0];
  if (!tx || !tx.userId) return;
  const userId = tx.userId;

  if (status !== "paid") {
    await db
      .update(transactions)
      .set({
        status,
        paymentMethod: paymentMethod?.trim() ? paymentMethod.trim() : tx.paymentMethod,
        paidAt: null
      })
      .where(eq(transactions.id, transactionId));

    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    return;
  }

  if (tx.status === "paid") {
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    return;
  }

  await db.transaction(async (dbTx) => {
    await dbTx
      .update(transactions)
      .set({
        status: "paid",
        paymentMethod: paymentMethod?.trim() ? paymentMethod.trim() : tx.paymentMethod,
        paidAt: new Date()
      })
      .where(eq(transactions.id, transactionId));

    await dbTx
      .update(tokenBalances)
      .set({
        balance: sql`${tokenBalances.balance} + ${tx.tokens ?? 0}`,
        totalBought: sql`${tokenBalances.totalBought} + ${tx.tokens ?? 0}`,
        updatedAt: new Date()
      })
      .where(eq(tokenBalances.userId, userId));

    const updated = await dbTx
      .select({ id: tokenBalances.id })
      .from(tokenBalances)
      .where(eq(tokenBalances.userId, userId))
      .limit(1);
    if (updated.length === 0) {
      await dbTx.insert(tokenBalances).values({
        userId,
        balance: tx.tokens ?? 0,
        totalBought: tx.tokens ?? 0,
        totalUsed: 0,
        updatedAt: new Date()
      });
    }
  });

  const userRows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const to = userRows[0]?.email ?? "";
  if (to && tx.tokens && tx.amount) {
    void sendPaymentConfirmationEmail({
      to,
      tokens: tx.tokens,
      amount: tx.amount,
      orderId: tx.orderId
    });
  }

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  revalidatePath("/checkout");
}
