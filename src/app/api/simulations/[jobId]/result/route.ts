import { NextResponse } from "next/server";

import { randomUUID } from "crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { shouldBypassTokensForEmail } from "@/lib/admin";
import { upsertAnalysisSnapshot } from "@/lib/analysis-snapshots";
import { getDb } from "@/lib/db";
import { analyses, tokenBalances } from "@/lib/db/schema";
import { buildPythonApiUrl } from "@/lib/python-api";
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

    const backendRes = await fetch(
      buildPythonApiUrl(req.url, `/v1/simulations/${encodeURIComponent(jobId)}/result`),
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
        fileName: z.string().optional(),
        action: z.enum(["analyze", "fix_pressure"]).optional(),
        pressureOptimizationAvailable: z.boolean().optional()
      }),
      prv: z
        .object({
          needed: z.boolean(),
          tokenCost: z.number().optional(),
          recommendations: z.array(z.record(z.string(), z.any())).optional()
        })
        .passthrough()
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

  const nodesFull = (result as any).nodes;
  const pipesFull = (result as any).pipes;
  const materialsFull = (result as any).materials;

  function toNumberOrNull(value: unknown): number | null {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim()) {
      const raw = value.trim();
      const direct = Number(raw);
      if (Number.isFinite(direct)) return direct;

      // Support locales that use comma as decimal separator (e.g., "12,34").
      if (raw.includes(",") && !raw.includes(".")) {
        const n = Number(raw.replace(",", "."));
        return Number.isFinite(n) ? n : null;
      }

      return null;
    }
    return null;
  }

  function pickNumber(raw: any, keys: string[]): number | null {
    for (const key of keys) {
      const v = toNumberOrNull(raw?.[key]);
      if (typeof v === "number") return v;
    }
    return null;
  }

  function pickNumberFromM3s(raw: any, keys: string[]): number | null {
    const m3s = pickNumber(raw, keys);
    if (typeof m3s !== "number") return null;
    return m3s * 1000.0;
  }

  const allowedNodeCodes = new Set(["P-OK", "P-LOW", "P-HIGH", "P-NEG"]);
  function normalizeNode(raw: any) {
    const elevation = pickNumber(raw, ["elevation", "elev", "elevM", "elevation_m"]);

    const pressureBefore = pickNumber(raw, [
      "pressureBefore",
      "pressure_before",
      "pressureBeforeM",
      "pressure_before_m"
    ]);
    const pressureAfter = pickNumber(raw, [
      "pressureAfter",
      "pressure_after",
      "pressureAfterM",
      "pressure_after_m"
    ]);

    const baseDemandLps =
      pickNumber(raw, ["baseDemandLps", "base_demand_lps", "baseDemand", "base_demand"]) ??
      pickNumberFromM3s(raw, ["baseDemandM3s", "base_demand_m3s"]);

    const headAwalM_raw = pickNumber(raw, ["headAwalM", "head_awal_m", "headBefore", "head_before"]);
    const headDiameterM_raw = pickNumber(raw, [
      "headDiameterM",
      "head_diameter_m",
      "headAfter",
      "head_after"
    ]);
    const headTekananM_raw = pickNumber(raw, ["headTekananM", "head_tekanan_m", "headFinal", "head_final"]);

    const pressureAwalM =
      pickNumber(raw, ["pressureAwalM", "pressure_awal_m", "pressureBefore", "pressure_before"]) ??
      pressureBefore;
    const pressureDiameterM =
      pickNumber(raw, ["pressureDiameterM", "pressure_diameter_m"]) ??
      pickNumber(raw, ["pressureAfter", "pressure_after"]) ??
      pressureAfter;
    const pressureTekananM =
      pickNumber(raw, ["pressureTekananM", "pressure_tekanan_m"]) ??
      pickNumber(raw, ["pressureAfter", "pressure_after"]) ??
      pressureAfter;

    // Fallback: if backend doesn't provide head, derive it from elevation + pressure (both meters).
    const headAwalM =
      headAwalM_raw ??
      (typeof elevation === "number" && typeof pressureAwalM === "number"
        ? elevation + pressureAwalM
        : null);
    const headDiameterM =
      headDiameterM_raw ??
      (typeof elevation === "number" && typeof pressureDiameterM === "number"
        ? elevation + pressureDiameterM
        : null);
    const headTekananM =
      headTekananM_raw ??
      (typeof elevation === "number" && typeof pressureTekananM === "number"
        ? elevation + pressureTekananM
        : null);

    let code: string =
      (typeof raw?.code === "string" && raw.code) ||
      (typeof raw?.codeAfter === "string" && raw.codeAfter) ||
      (typeof raw?.codeBefore === "string" && raw.codeBefore) ||
      "";

    if (!allowedNodeCodes.has(code)) {
      if (typeof pressureAfter === "number") {
        if (pressureAfter < 0) code = "P-NEG";
        else if (pressureAfter < 10) code = "P-LOW";
        else if (pressureAfter > 80) code = "P-HIGH";
        else code = "P-OK";
      } else {
        code = "P-OK";
      }
    }

    return {
      id: String(raw?.id ?? ""),
      elevation,
      baseDemandLps,
      headAwalM,
      headDiameterM,
      headTekananM,
      pressureAwalM,
      pressureDiameterM,
      pressureTekananM,
      pressureBefore,
      pressureAfter,
      code
    };
  }

  const allowedPipeCodes = new Set(["OK", "V-LOW", "V-HIGH", "HL-HIGH", "HL-SMALL"]);
  function normalizePipe(raw: any) {
    let code: string =
      (typeof raw?.code === "string" && raw.code) ||
      (typeof raw?.compositeAfter === "string" && raw.compositeAfter) ||
      (typeof raw?.compositeBefore === "string" && raw.compositeBefore) ||
      "OK";
    if (!allowedPipeCodes.has(code)) code = "OK";

    return {
      id: String(raw?.id ?? ""),
      fromNode: typeof raw?.fromNode === "string" ? raw.fromNode : null,
      toNode: typeof raw?.toNode === "string" ? raw.toNode : null,
      length: pickNumber(raw, ["length", "len", "lengthM", "length_m"]),
      roughnessC: pickNumber(raw, ["roughnessC", "roughness_c", "roughness", "C", "c"]),
      diameterAwalMm:
        pickNumber(raw, ["diameterAwalMm", "diameter_awal_mm"]) ??
        pickNumber(raw, ["diameterBefore", "diameter_before", "diameterBeforeMm", "diameter_before_mm"]),
      diameterDiameterMm:
        pickNumber(raw, ["diameterDiameterMm", "diameter_diameter_mm"]) ??
        pickNumber(raw, ["diameterAfter", "diameter_after", "diameterAfterMm", "diameter_after_mm"]),
      diameterTekananMm:
        pickNumber(raw, ["diameterTekananMm", "diameter_tekanan_mm"]) ??
        pickNumber(raw, ["diameterAfter", "diameter_after", "diameterAfterMm", "diameter_after_mm"]),
      flowAwalLps:
        pickNumber(raw, ["flowAwalLps", "flow_awal_lps"]) ??
        pickNumberFromM3s(raw, ["flowAwalM3s", "flow_awal_m3s"]),
      flowDiameterLps:
        pickNumber(raw, ["flowDiameterLps", "flow_diameter_lps"]) ??
        pickNumberFromM3s(raw, ["flowDiameterM3s", "flow_diameter_m3s"]),
      flowTekananLps:
        pickNumber(raw, ["flowTekananLps", "flow_tekanan_lps"]) ??
        pickNumberFromM3s(raw, ["flowTekananM3s", "flow_tekanan_m3s"]),
      flowAwalLpsAbs:
        pickNumber(raw, ["flowAwalLpsAbs", "flow_awal_lps_abs"]) ??
        ((): number | null => {
          const v = pickNumber(raw, ["flowAwalLps", "flow_awal_lps"]) ?? pickNumberFromM3s(raw, ["flowAwalM3s", "flow_awal_m3s"]);
          return typeof v === "number" ? Math.abs(v) : null;
        })(),
      flowDiameterLpsAbs:
        pickNumber(raw, ["flowDiameterLpsAbs", "flow_diameter_lps_abs"]) ??
        ((): number | null => {
          const v =
            pickNumber(raw, ["flowDiameterLps", "flow_diameter_lps"]) ??
            pickNumberFromM3s(raw, ["flowDiameterM3s", "flow_diameter_m3s"]);
          return typeof v === "number" ? Math.abs(v) : null;
        })(),
      flowTekananLpsAbs:
        pickNumber(raw, ["flowTekananLpsAbs", "flow_tekanan_lps_abs"]) ??
        ((): number | null => {
          const v =
            pickNumber(raw, ["flowTekananLps", "flow_tekanan_lps"]) ??
            pickNumberFromM3s(raw, ["flowTekananM3s", "flow_tekanan_m3s"]);
          return typeof v === "number" ? Math.abs(v) : null;
        })(),
      flowAwalDir: typeof raw?.flowAwalDir === "string" ? raw.flowAwalDir : null,
      flowDiameterDir: typeof raw?.flowDiameterDir === "string" ? raw.flowDiameterDir : null,
      flowTekananDir: typeof raw?.flowTekananDir === "string" ? raw.flowTekananDir : null,
      velocityAwalMps:
        pickNumber(raw, ["velocityAwalMps", "velocity_awal_mps"]) ?? pickNumber(raw, ["velocityBefore", "velocity_before"]),
      velocityDiameterMps:
        pickNumber(raw, ["velocityDiameterMps", "velocity_diameter_mps"]) ?? pickNumber(raw, ["velocityAfter", "velocity_after"]),
      velocityTekananMps:
        pickNumber(raw, ["velocityTekananMps", "velocity_tekanan_mps"]) ?? pickNumber(raw, ["velocityAfter", "velocity_after"]),
      unitHeadlossAwalMkm:
        pickNumber(raw, ["unitHeadlossAwalMkm", "unit_headloss_awal_mkm"]) ?? pickNumber(raw, ["headlossBefore", "headloss_before"]),
      unitHeadlossDiameterMkm:
        pickNumber(raw, ["unitHeadlossDiameterMkm", "unit_headloss_diameter_mkm"]) ?? pickNumber(raw, ["headlossAfter", "headloss_after"]),
      unitHeadlossTekananMkm:
        pickNumber(raw, ["unitHeadlossTekananMkm", "unit_headloss_tekanan_mkm"]) ?? pickNumber(raw, ["headlossAfter", "headloss_after"]),
      diameterBefore: pickNumber(raw, ["diameterBefore", "diameter_before", "diameterBeforeMm", "diameter_before_mm"]),
      diameterAfter: pickNumber(raw, ["diameterAfter", "diameter_after", "diameterAfterMm", "diameter_after_mm"]),
      velocityBefore: pickNumber(raw, ["velocityBefore", "velocity_before"]),
      velocityAfter: pickNumber(raw, ["velocityAfter", "velocity_after"]),
      headlossBefore: pickNumber(raw, ["headlossBefore", "headloss_before"]),
      headlossAfter: pickNumber(raw, ["headlossAfter", "headloss_after"]),
      code
    };
  }

  const nodes = Array.isArray(nodesFull) ? nodesFull.map(normalizeNode) : undefined;
  const pipes = Array.isArray(pipesFull) ? pipesFull.map(normalizePipe) : undefined;
  const materials = Array.isArray(materialsFull) ? materialsFull : undefined;
  const detailsTruncated = false;

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

  // NOTE: Download sekarang melalui `/api/analyses/:analysisId/export` agar:
  // - ada pricing token per format
  // - nama file konsisten (berdasarkan nama asli + kode/tanggal)
  // - jobId tidak diekspos ke client (mengurangi bypass/download liar)
  const publicFilesV1: Record<string, never> = {};
  const publicFilesFinal = filesFinal ? ({} as Record<string, never>) : null;
  const publicFiles = publicFilesFinal ?? publicFilesV1;

  // Idempotency: if already marked success, just return the result.
  if (analysis.status === "success") {
    return jsonWithTrace({
      success: true,
      analysisId,
      summary: result.summary,
      prv: result.prv,
      files: publicFiles,
      filesV1: publicFilesV1,
      filesFinal: publicFilesFinal,
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
      files: publicFiles,
      filesV1: publicFilesV1,
      filesFinal: publicFilesFinal,
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
