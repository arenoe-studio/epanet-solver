import { NextResponse } from "next/server";

import { randomUUID } from "crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { shouldBypassTokensForEmail } from "@/lib/admin";
import { upsertAnalysisSnapshot } from "@/lib/analysis-snapshots";
import { getDb } from "@/lib/db";
import { analyses, tokenBalances } from "@/lib/db/schema";
import { ensureInitialTokenBalanceRow } from "@/lib/token-balance";
import { ANALYSIS_TOKEN_COST, FIX_PRESSURE_TOKEN_COST } from "@/lib/token-constants";

function previewJson(value: unknown, maxChars = 2000) {
  try {
    const text = JSON.stringify(value);
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}…`;
  } catch {
    return String(value);
  }
}

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
  const traceId = randomUUID();
  const traceTag = `[trace:${traceId}]`;

  function jsonWithTrace(body: Record<string, unknown>, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    headers.set("x-trace-id", traceId);
    return NextResponse.json({ ...body, traceId }, { ...init, headers });
  }

  function jsonError(
    error: string,
    status: number,
    errorCode: string,
    extra?: Record<string, unknown>
  ) {
    return jsonWithTrace({ success: false, error, errorCode, ...(extra ?? {}) }, { status });
  }

  let userId: string | undefined;
  let jobId: string | undefined;
  let analysisId: number | undefined;

  try {
    const session = await auth();
    userId = session?.user?.id;
    if (!userId) {
      return jsonWithTrace({ error: "Unauthorized" }, { status: 401 });
    }
    const bypassTokens = shouldBypassTokensForEmail(session?.user?.email);

    ({ jobId } = await ctx.params);
    const url = new URL(req.url);
    const analysisIdRaw = url.searchParams.get("analysisId");
    analysisId = analysisIdRaw ? Number(analysisIdRaw) : NaN;
    if (!Number.isFinite(analysisId)) {
      return jsonWithTrace({ error: "Missing analysisId" }, { status: 400 });
    }

    const db = getDb();

    const analysisRow = await db
      .select()
      .from(analyses)
      .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId)));

    const analysis = analysisRow[0];
    if (!analysis) {
      return jsonWithTrace({ error: "Not found" }, { status: 404 });
    }

    const base = getBackendBaseUrl(req.url);
    const backendRes = await fetch(
      `${base}/v1/simulations/${encodeURIComponent(jobId)}/result`,
      { method: "GET" }
    );

    if (backendRes.status === 409) {
      return jsonWithTrace({ error: "Job not finished" }, { status: 409 });
    }

    if (!backendRes.ok) {
      const backendJson = await fetchJson(backendRes);
      const detail =
        backendJson?.detail ??
        backendJson?.error ??
        (backendRes.status === 503
          ? "Solver sedang maintenance. Silakan coba lagi beberapa saat."
          : "System error");
      return jsonWithTrace({ success: false, error: detail }, { status: backendRes.status });
    }

    const pythonJson = await fetchJson(backendRes);
    if (!pythonJson) {
      console.error(`${traceTag} Backend returned empty/invalid JSON`, {
        jobId,
        analysisId,
        status: backendRes.status,
        contentType: backendRes.headers.get("content-type")
      });
      return jsonError("Invalid backend response", 502, "E_INVALID_BACKEND_JSON");
    }

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
          inpPath: z.string(),
          mdPath: z.string()
        })
        .optional(),
      filesFinal: z
        .object({
          inpPath: z.string(),
          mdPath: z.string()
        })
        .nullable()
        .optional(),
      files: z
        .object({
          inpPath: z.string(),
          mdPath: z.string()
        })
        .optional()
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
      if (status === 503) {
        return jsonError("Solver sedang maintenance.", 503, "E_MAINTENANCE");
      }

      console.error(`${traceTag} Backend response shape mismatch`, {
        jobId,
        analysisId,
        userId,
        zodIssues: parsedSuccess.error.issues,
        backendJsonPreview: previewJson(pythonJson)
      });

      return jsonError(err, status, "E_BACKEND_FAILURE");
    }

  const result = parsedSuccess.data;

  const MAX_ITEMS = 500;
  const nodesFull = (result as any).nodes;
  const pipesFull = (result as any).pipes;
  const materialsFull = (result as any).materials;
  const nodes = Array.isArray(nodesFull) ? nodesFull.slice(0, MAX_ITEMS) : undefined;
  const pipes = Array.isArray(pipesFull) ? pipesFull.slice(0, MAX_ITEMS) : undefined;
  const materials = Array.isArray(materialsFull) ? materialsFull.slice(0, MAX_ITEMS) : undefined;
  const detailsTruncated =
    (Array.isArray(nodesFull) && nodesFull.length > MAX_ITEMS) ||
    (Array.isArray(pipesFull) && pipesFull.length > MAX_ITEMS) ||
    (Array.isArray(materialsFull) && materialsFull.length > MAX_ITEMS);

  const fileBase = `/api/simulations/${encodeURIComponent(jobId)}/files`;
  const filesV1 = {
    inpUrl: `${fileBase}/optimized_v1.inp`,
    mdUrl: `${fileBase}/report_v1.md`
  };
  const filesFinal =
    result.filesFinal && (result.filesFinal as any)?.inpPath && (result.filesFinal as any)?.mdPath
      ? {
          inpUrl: `${fileBase}/optimized_final.inp`,
          mdUrl: `${fileBase}/report_final.md`
        }
      : null;
  const files = filesFinal ?? filesV1;

  // Idempotency: if already marked success, just return the result.
  if (analysis.status === "success") {
    return jsonWithTrace({
      success: true,
      analysisId,
      summary: result.summary,
      prv: result.prv,
      files,
      filesV1,
      filesFinal,
      nodes,
      pipes,
      materials,
      networkInfo: (result as any).networkInfo,
      detailsTruncated
    });
  }

  // Deduct tokens on completion (not when the job is created), unless bypassed.
  const tokenCost = analysis.kind === "fix_pressure" ? FIX_PRESSURE_TOKEN_COST : ANALYSIS_TOKEN_COST;

    if (!bypassTokens) {
    let existingBalance: { balance: number | null };
    try {
      existingBalance = await ensureInitialTokenBalanceRow(db, userId);
    } catch (e) {
      console.error(`${traceTag} ensureInitialTokenBalanceRow failed`, {
        jobId,
        analysisId,
        userId,
        error: e
      });
      return jsonError("System error", 500, "E_ENSURE_TOKEN_BALANCE");
    }
    const balance = existingBalance.balance ?? 0;
    if (balance < tokenCost) {
      await db.update(analyses).set({ status: "failed" }).where(eq(analyses.id, analysisId));
      return jsonError("Insufficient tokens", 402, "E_INSUFFICIENT_TOKENS");
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
      return jsonError("System error", 500, "E_TOKEN_DEDUCT_FAILED");
    }

    if (updated.length === 0) {
      await db.update(analyses).set({ status: "failed" }).where(eq(analyses.id, analysisId));
      return jsonError("Insufficient tokens", 402, "E_INSUFFICIENT_TOKENS");
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

  const sourceFileUrl = `${fileBase}/input.inp`;

  try {
    const payload = {
      analysisId,
      fileName: result.summary?.fileName ?? analysis.fileName,
      sourceFileName: analysis.fileName,
      sourceFileUrl,
      summary: result.summary,
      prv: result.prv,
      files,
      filesV1,
      filesFinal,
      nodes,
      pipes,
      materials,
      networkInfo: (result as any).networkInfo,
      detailsTruncated,
      backendJobId: jobId
    };
    await upsertAnalysisSnapshot(db, analysisId, payload);
  } catch {
  }

    return jsonWithTrace({
      success: true,
      analysisId,
      summary: result.summary,
      prv: result.prv,
      files,
      filesV1,
      filesFinal,
      nodes,
      pipes,
      materials,
      networkInfo: (result as any).networkInfo,
      detailsTruncated
    });
  } catch (e) {
    console.error(`${traceTag} GET /api/simulations/:jobId/result failed`, {
      jobId,
      analysisId,
      userId,
      error: e
    });
    return jsonError("System error", 500, "E_UNHANDLED");
  }
}
