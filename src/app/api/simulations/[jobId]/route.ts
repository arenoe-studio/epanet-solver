import { NextResponse } from "next/server";

import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { analyses } from "@/lib/db/schema";

function getBackendBaseUrl(requestUrl: string) {
  const env = process.env.PYTHON_API_URL;
  if (env) {
    try {
      const u = new URL(env);
      if (u.pathname && u.pathname !== "/") {
        return `${u.origin}`;
      }
      return env.replace(/\/+$/, "");
    } catch {
      return env;
    }
  }
  return new URL(requestUrl).origin;
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
  const base = getBackendBaseUrl(req.url);

  try {
    const res = await fetch(`${base}/v1/simulations/${encodeURIComponent(jobId)}`, {
      method: "GET"
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

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

    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ error: "System error" }, { status: 500 });
  }
}
