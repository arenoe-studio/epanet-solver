import { NextResponse } from "next/server";

import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { shouldBypassTokensForEmail } from "@/lib/admin";
import { upsertAnalysisSnapshot } from "@/lib/analysis-snapshots";
import { getDb } from "@/lib/db";
import { analyses, tokenBalances } from "@/lib/db/schema";
import { ensureInitialTokenBalanceRow } from "@/lib/token-balance";
import { ANALYSIS_TOKEN_COST, FIX_PRESSURE_TOKEN_COST } from "@/lib/token-constants";

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

async function fetchJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const bypassTokens = shouldBypassTokensForEmail(session?.user?.email);

  const { jobId } = await ctx.params;
  const url = new URL(req.url);
  const analysisIdRaw = url.searchParams.get("analysisId");
  const analysisId = analysisIdRaw ? Number(analysisIdRaw) : NaN;
  if (!Number.isFinite(analysisId)) {
    return NextResponse.json({ error: "Missing analysisId" }, { status: 400 });
  }

  const db = getDb();

  const analysisRow = await db
    .select()
    .from(analyses)
    .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId)));

  const analysis = analysisRow[0];
  if (!analysis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const base = getBackendBaseUrl(req.url);
  const backendRes = await fetch(
    `${base}/v1/simulations/${encodeURIComponent(jobId)}/result`,
    { method: "GET" }
  );

  if (backendRes.status === 409) {
    return NextResponse.json({ error: "Job not finished" }, { status: 409 });
  }

  if (!backendRes.ok) {
    const backendJson = await fetchJson(backendRes);
    const detail =
      backendJson?.detail ??
      backendJson?.error ??
      (backendRes.status === 503
        ? "Solver sedang maintenance. Silakan coba lagi beberapa saat."
        : "System error");
    return NextResponse.json({ success: false, error: detail }, { status: backendRes.status });
  }

  const pythonJson = await fetchJson(backendRes);

  const successSchema = z
    .object({
      success: z.literal(true),
      summary: z.object({
        iterations: z.number(),
        issuesFound: z.number(),
        issuesFixed: z.number(),
        remainingIssues: z.number().optional(),
        duration: z.number().optional(),
        nodes: z.number(),
        pipes: z.number(),
        fileName: z.string().optional()
      }),
      prv: z
        .object({
          needed: z.boolean(),
          tokenCost: z.number().optional(),
          recommendations: z.array(z.record(z.string(), z.any())).optional()
        })
        .optional(),
      filesV1: z
        .object({
          inp: z.string(),
          md: z.string()
        })
        .optional(),
      filesFinal: z
        .object({
          inp: z.string(),
          md: z.string()
        })
        .nullable()
        .optional(),
      files: z.object({
        inp: z.string(),
        md: z.string()
      })
    })
    .passthrough();

  const failSchema = z.object({
    success: z.literal(false),
    refund: z.boolean().optional(),
    error: z.string().optional()
  });

  const parsedSuccess = successSchema.safeParse(pythonJson);
  const parsedFail = failSchema.safeParse(pythonJson);

  if (!parsedSuccess.success) {
    const err = parsedFail.success ? (parsedFail.data.error ?? "System error") : "System error";
    const status = err === "MAINTENANCE" ? 503 : 500;
    return NextResponse.json(
      { success: false, error: status === 503 ? "Solver sedang maintenance." : err },
      { status }
    );
  }

  const result = parsedSuccess.data;

  // Idempotency: if already marked success, just return the result.
  if (analysis.status === "success") {
    return NextResponse.json({ ...result, analysisId });
  }

  // Deduct tokens on completion (not when the job is created), unless bypassed.
  const tokenCost = analysis.kind === "fix_pressure" ? FIX_PRESSURE_TOKEN_COST : ANALYSIS_TOKEN_COST;

  if (!bypassTokens) {
    const existingBalance = await ensureInitialTokenBalanceRow(db, userId);
    const balance = existingBalance.balance ?? 0;
    if (balance < tokenCost) {
      await db.update(analyses).set({ status: "failed" }).where(eq(analyses.id, analysisId));
      return NextResponse.json({ success: false, error: "Insufficient tokens" }, { status: 402 });
    }

    let updated: Array<{ balance: number | null }> = [];
    try {
      updated = await db
        .update(tokenBalances)
        .set({
          balance: sql`${tokenBalances.balance} - ${tokenCost}`,
          totalUsed: sql`${tokenBalances.totalUsed} + ${tokenCost}`,
          updatedAt: new Date()
        })
        .where(and(eq(tokenBalances.userId, userId), gte(tokenBalances.balance, tokenCost)))
        .returning({ balance: tokenBalances.balance });
    } catch {
      await db.update(analyses).set({ status: "failed" }).where(eq(analyses.id, analysisId));
      return NextResponse.json({ success: false, error: "System error" }, { status: 500 });
    }

    if (updated.length === 0) {
      await db.update(analyses).set({ status: "failed" }).where(eq(analyses.id, analysisId));
      return NextResponse.json({ success: false, error: "Insufficient tokens" }, { status: 402 });
    }
  }

  try {
    await db
      .update(analyses)
      .set({
        status: "success",
        nodesCount: result.summary.nodes,
        pipesCount: result.summary.pipes,
        issuesFound: result.summary.issuesFound,
        issuesFixed: result.summary.issuesFixed
      })
      .where(eq(analyses.id, analysisId));
  } catch {
  }

  // Store source file in snapshot if PRV is needed (for history -> fix pressure flow).
  let sourceFileBase64: string | undefined = undefined;
  if (analysis.kind !== "fix_pressure" && (result.prv?.needed ?? false)) {
    try {
      const inpRes = await fetch(
        `${base}/v1/simulations/${encodeURIComponent(jobId)}/files/input.inp`,
        { method: "GET" }
      );
      if (inpRes.ok) {
        const buf = Buffer.from(await inpRes.arrayBuffer());
        sourceFileBase64 = buf.toString("base64");
      }
    } catch {
    }
  }

  try {
    const payload = {
      analysisId,
      fileName: result.summary?.fileName ?? analysis.fileName,
      sourceFileName: analysis.fileName,
      sourceFileBase64,
      summary: result.summary,
      prv: result.prv,
      files: result.files,
      filesV1: (result as any).filesV1,
      filesFinal: (result as any).filesFinal,
      nodes: (result as any).nodes,
      pipes: (result as any).pipes,
      materials: (result as any).materials,
      networkInfo: (result as any).networkInfo,
      backendJobId: jobId
    };
    await upsertAnalysisSnapshot(db, analysisId, payload);
  } catch {
  }

  return NextResponse.json({ ...result, analysisId });
}
