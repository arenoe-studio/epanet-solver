import { and, eq, lte } from "drizzle-orm";

import type { DbClient } from "@/lib/db";
import { analysisSnapshots } from "@/lib/db/schema";

export const ANALYSIS_SNAPSHOT_TTL_DAYS = 3;

export function getAnalysisSnapshotExpiresAt(now = new Date()) {
  return new Date(now.getTime() + ANALYSIS_SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function cleanupExpiredAnalysisSnapshots(db: DbClient, now = new Date()) {
  try {
    await db.delete(analysisSnapshots).where(lte(analysisSnapshots.expiresAt, now));
  } catch (error) {
    console.error("Failed to cleanup expired analysis snapshots", { error, now });
  }
}

export async function upsertAnalysisSnapshot(
  db: DbClient,
  analysisId: number,
  payload: unknown,
  now = new Date()
) {
  const expiresAt = getAnalysisSnapshotExpiresAt(now);
  try {
    await db
      .insert(analysisSnapshots)
      .values({ analysisId, payload, expiresAt })
      .onConflictDoUpdate({
        target: analysisSnapshots.analysisId,
        set: { payload, expiresAt }
      });
    return;
  } catch (error) {
    console.error("Failed to upsert analysis snapshot via upsert path", { analysisId, error });
  }

  try {
    await db
      .delete(analysisSnapshots)
      .where(and(eq(analysisSnapshots.analysisId, analysisId)));
    await db.insert(analysisSnapshots).values({ analysisId, payload, expiresAt });
  } catch (error) {
    console.error("Failed to upsert analysis snapshot via replace path", { analysisId, error });
  }
}
