import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth-server";
import { shouldBypassTokensForEmail } from "@/lib/admin";
import { upsertAnalysisSnapshot } from "@/lib/analysis-snapshots";
import { getDb } from "@/lib/db";
import { analyses } from "@/lib/db/schema";
import { rateLimitAnalyze } from "@/lib/ratelimit";
import { ensureInitialTokenBalanceRow } from "@/lib/token-balance";
import { FIX_PRESSURE_TOKEN_COST } from "@/lib/token-constants";

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

function getBackendBaseUrl(requestUrl: string) {
  const env = process.env.PYTHON_API_URL;
  if (env) {
    try {
      const u = new URL(env);
      if (u.pathname && u.pathname !== "/") return `${u.origin}`;
      return env.replace(/\/+$/, "");
    } catch {
      return env;
    }
  }
  return new URL(requestUrl).origin;
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

  const parentAnalysisIdRaw = formData.get("parentAnalysisId");
  const parentAnalysisId =
    typeof parentAnalysisIdRaw === "string" && parentAnalysisIdRaw.trim()
      ? Number(parentAnalysisIdRaw)
      : null;

  const db = getDb();

  if (!bypassTokens) {
    const existingBalance = await ensureInitialTokenBalanceRow(db, userId);
    const balance = existingBalance.balance ?? 0;
    if (balance < FIX_PRESSURE_TOKEN_COST) {
      return NextResponse.json({ error: "Insufficient tokens" }, { status: 402 });
    }
  }

  const inserted = await db
    .insert(analyses)
    .values({
      userId,
      fileName: file.name,
      kind: "fix_pressure",
      parentAnalysisId: Number.isFinite(parentAnalysisId) ? parentAnalysisId : null,
      status: "processing",
      tokensUsed: bypassTokens ? 0 : FIX_PRESSURE_TOKEN_COST
    })
    .returning({ id: analyses.id });

  const analysisId = inserted[0]?.id;
  if (!analysisId) {
    return NextResponse.json({ error: "Failed to create analysis" }, { status: 500 });
  }

  const pythonFormData = new FormData();
  pythonFormData.set("file", file);
  pythonFormData.set("action", "fix_pressure");

  try {
    const base = getBackendBaseUrl(req.url);
    const pythonRes = await fetch(`${base}/v1/simulations`, {
      method: "POST",
      body: pythonFormData
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
        parentAnalysisId,
        status: "processing",
        backendJobId: String(json.id)
      });
    } catch {
    }

    return NextResponse.json({ success: true, analysisId, jobId: String(json.id) });
  } catch {
    await db.update(analyses).set({ status: "failed" }).where(eq(analyses.id, analysisId));
    return NextResponse.json({ success: false, error: "System error" }, { status: 500 });
  }
}
