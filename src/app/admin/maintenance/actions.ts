"use server";

import { revalidatePath } from "next/cache";

import { and, isNotNull, lte, or } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { analysisSnapshots, authOtpCodes } from "@/lib/db/schema";

const confirmSchema = z.object({
  confirm: z.string().min(1)
});

function requireDeleteConfirm(formData: FormData) {
  const parsed = confirmSchema.safeParse({ confirm: formData.get("confirm") });
  if (!parsed.success) return false;
  return parsed.data.confirm.trim().toUpperCase() === "DELETE";
}

export async function adminCleanupExpiredAnalysisSnapshots(formData: FormData) {
  if (!requireDeleteConfirm(formData)) return;
  await requireAdmin();

  const db = getDb();
  const now = new Date();
  await db.delete(analysisSnapshots).where(lte(analysisSnapshots.expiresAt, now));

  revalidatePath("/admin/maintenance");
  revalidatePath("/admin");
}

const otpSchema = z.object({
  confirm: z.string().min(1),
  days: z.coerce.number().int().min(1).max(90).default(14)
});

export async function adminCleanupOldOtpCodes(formData: FormData) {
  const parsed = otpSchema.safeParse({
    confirm: formData.get("confirm"),
    days: formData.get("days")
  });
  if (!parsed.success) return;
  if (parsed.data.confirm.trim().toUpperCase() !== "DELETE") return;

  await requireAdmin();

  const db = getDb();
  const cutoff = new Date(Date.now() - parsed.data.days * 24 * 60 * 60_000);

  await db
    .delete(authOtpCodes)
    .where(
      or(
        lte(authOtpCodes.expiresAt, cutoff),
        and(isNotNull(authOtpCodes.consumedAt), lte(authOtpCodes.createdAt, cutoff))
      )
    );

  revalidatePath("/admin/maintenance");
}

