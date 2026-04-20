import { NextResponse } from "next/server";

import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { analyses } from "@/lib/db/schema";
import { parseJsonResponse } from "@/lib/http";
import { buildPythonApiUrl } from "@/lib/python-api";

export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { jobId } = await ctx.params;
  const url = new URL(req.url);
  const analysisIdRaw = url.searchParams.get("analysisId");
  const analysisId = analysisIdRaw ? Number(analysisIdRaw) : NaN;
  try {
    const res = await fetch(buildPythonApiUrl(req.url, `/v1/simulations/${encodeURIComponent(jobId)}`), {
      method: "GET"
    });
    const { text, json } = await parseJsonResponse(res);

    if (json?.status === "failed" && Number.isFinite(analysisId)) {
      try {
        const db = getDb();
        await db
          .update(analyses)
          .set({ status: "failed" })
          .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId)));
      } catch {
      }
    }

    if (json) {
      return NextResponse.json(json, { status: res.status });
    }

    return NextResponse.json(
      { error: text?.trim() || "Invalid backend response" },
      { status: res.status }
    );
  } catch {
    return NextResponse.json({ error: "System error" }, { status: 500 });
  }
}
