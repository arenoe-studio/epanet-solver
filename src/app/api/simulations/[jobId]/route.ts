import { NextResponse } from "next/server";

import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { analyses } from "@/lib/db/schema";
import { buildPythonApiUrl } from "@/lib/python-api";

async function parseBackendBody(res: Response) {
  const text = await res.text();
  if (!text) return { text: "", json: null as any };
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null as any };
  }
}

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
    const { text, json } = await parseBackendBody(res);

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
