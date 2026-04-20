import { NextResponse } from "next/server";

import { and, eq, gt } from "drizzle-orm";

import { auth } from "@/lib/auth-server";
import { cleanupExpiredAnalysisSnapshots } from "@/lib/analysis-snapshots";
import { getDb } from "@/lib/db";
import { analyses, analysisSnapshots } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { analysisId: analysisIdRaw } = await params;
  const analysisId = Number(analysisIdRaw);
  if (!Number.isFinite(analysisId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date();
  await cleanupExpiredAnalysisSnapshots(db, now);

  const rows = await db
    .select({
      payload: analysisSnapshots.payload
    })
    .from(analysisSnapshots)
    .innerJoin(analyses, eq(analyses.id, analysisSnapshots.analysisId))
    .where(
      and(
        eq(analyses.userId, userId),
        eq(analysisSnapshots.analysisId, analysisId),
        gt(analysisSnapshots.expiresAt, now)
      )
    )
    .limit(1);

  const payload = rows[0]?.payload as unknown;
  if (!payload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
