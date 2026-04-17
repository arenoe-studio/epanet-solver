import { NextResponse } from "next/server";

import { desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { analyses } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
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
    .where(eq(analyses.userId, userId))
    .orderBy(desc(analyses.createdAt))
    .limit(20);

  return NextResponse.json({ items: rows });
}
