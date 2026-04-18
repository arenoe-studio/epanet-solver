import { NextResponse } from "next/server";

import { and, desc, eq, gt } from "drizzle-orm";

import { auth } from "@/lib/auth-server";
import { cleanupExpiredAnalysisSnapshots } from "@/lib/analysis-snapshots";
import { getDb } from "@/lib/db";
import { analyses, analysisSnapshots } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  await cleanupExpiredAnalysisSnapshots(db, now);

  const rows = await db
    .select({
      id: analyses.id,
      fileName: analyses.fileName,
      kind: analyses.kind,
      parentAnalysisId: analyses.parentAnalysisId,
      status: analyses.status,
      issuesFound: analyses.issuesFound,
      issuesFixed: analyses.issuesFixed,
      createdAt: analyses.createdAt
    })
    .from(analyses)
    .innerJoin(
      analysisSnapshots,
      and(
        eq(analysisSnapshots.analysisId, analyses.id),
        gt(analysisSnapshots.expiresAt, now)
      )
    )
    .where(eq(analyses.userId, userId))
    .orderBy(desc(analyses.createdAt))
    .limit(60);

  const seenRoot = new Set<number>();
  const items = [];

  for (const row of rows) {
    const rootId =
      row.kind === "fix_pressure" && typeof row.parentAnalysisId === "number"
        ? row.parentAnalysisId
        : row.id;
    if (seenRoot.has(rootId)) continue;
    seenRoot.add(rootId);

    items.push({
      rootId,
      viewId: row.id,
      fileName: row.fileName,
      status: row.status,
      issuesFound: row.issuesFound,
      issuesFixed: row.issuesFixed,
      createdAt: row.createdAt,
      hasFinal: row.kind === "fix_pressure"
    });
    if (items.length >= 20) break;
  }

  return NextResponse.json({ items });
}
