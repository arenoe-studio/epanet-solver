import { and, eq, lte } from "drizzle-orm";

import { analysisSnapshots } from "@/lib/db/schema";

export const ANALYSIS_SNAPSHOT_TTL_DAYS = 3;

export function getAnalysisSnapshotExpiresAt(now = new Date()) {
  return new Date(now.getTime() + ANALYSIS_SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function cleanupExpiredAnalysisSnapshots(db: any, now = new Date()) {
  try {
    await db.delete(analysisSnapshots).where(lte(analysisSnapshots.expiresAt, now));
  } catch {
    // ignore cleanup failures
  }
}

export async function upsertAnalysisSnapshot(
  db: any,
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
  } catch {
    // Fallback for older drizzle clients that may not support onConflictDoUpdate for this table.
  }

  try {
    await db
      .delete(analysisSnapshots)
      .where(and(eq(analysisSnapshots.analysisId, analysisId)));
    await db.insert(analysisSnapshots).values({ analysisId, payload, expiresAt });
  } catch {
    // ignore persist errors
  }
}
