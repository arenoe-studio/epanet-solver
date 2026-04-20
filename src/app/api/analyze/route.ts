import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth-server";
import { shouldBypassTokensForEmail } from "@/lib/admin";
import { upsertAnalysisSnapshot } from "@/lib/analysis-snapshots";
import { getDb } from "@/lib/db";
import { analyses } from "@/lib/db/schema";
import { buildPythonApiUrl } from "@/lib/python-api";
import { rateLimitAnalyze } from "@/lib/ratelimit";
import { ensureInitialTokenBalanceRow } from "@/lib/token-balance";
import { ANALYSIS_TOKEN_COST } from "@/lib/token-constants";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

async function parseBackendBody(res: Response) {
  const text = await res.text();
  if (!text) return { text: "", json: null as any };
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null as any };
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bypassTokens = shouldBypassTokensForEmail(userEmail);

  const rl = await rateLimitAnalyze(`user:${userId}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".inp")) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  const db = getDb();

  if (!bypassTokens) {
    const existingBalance = await ensureInitialTokenBalanceRow(db, userId);
    const balance = existingBalance.balance ?? 0;
    if (balance < ANALYSIS_TOKEN_COST) {
      return NextResponse.json({ error: "Insufficient tokens" }, { status: 402 });
    }
  }

  const inserted = await db
    .insert(analyses)
    .values({
      userId,
      fileName: file.name,
      kind: "optimize",
      status: "processing",
      tokensUsed: bypassTokens ? 0 : ANALYSIS_TOKEN_COST
    })
    .returning({ id: analyses.id });

  const analysisId = inserted[0]?.id;
  if (!analysisId) {
    return NextResponse.json({ error: "Failed to create analysis" }, { status: 500 });
  }

  const pythonFormData = new FormData();
  pythonFormData.set("file", file);
  pythonFormData.set("action", "analyze");

  try {
    const pythonRes = await fetch(buildPythonApiUrl(req.url, "/v1/simulations"), {
      method: "POST",
      body: pythonFormData,
      signal: AbortSignal.timeout(15000)
    });
    const { text, json } = await parseBackendBody(pythonRes);

    if (!pythonRes.ok || !json?.id) {
      await db.update(analyses).set({ status: "failed" }).where(eq(analyses.id, analysisId));
      const msg =
        json?.detail ??
        json?.error ??
        (text && text.trim()) ??
        (pythonRes.status === 503
          ? "Solver sedang maintenance. Silakan coba lagi beberapa saat."
          : "System error");
      return NextResponse.json({ success: false, error: msg }, { status: pythonRes.status });
    }

    try {
      await upsertAnalysisSnapshot(db, analysisId, {
        analysisId,
        fileName: file.name,
        sourceFileName: file.name,
        status: "processing",
        backendJobId: String(json.id)
      });
    } catch {
    }

    return NextResponse.json({ success: true, analysisId, jobId: String(json.id) });
  } catch (error) {
    await db.update(analyses).set({ status: "failed" }).where(eq(analyses.id, analysisId));
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Backend Python API timeout"
        : "System error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
