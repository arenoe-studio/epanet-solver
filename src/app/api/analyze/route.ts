import { NextResponse } from "next/server";

import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { shouldBypassTokensForEmail } from "@/lib/admin";
import { upsertAnalysisSnapshot } from "@/lib/analysis-snapshots";
import { getDb } from "@/lib/db";
import { analyses, tokenBalances } from "@/lib/db/schema";
import { rateLimitAnalyze } from "@/lib/ratelimit";
import { ensureInitialTokenBalanceRow } from "@/lib/token-balance";
import { ANALYSIS_TOKEN_COST } from "@/lib/token-constants";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function getPythonUrl(requestUrl: string) {
  if (process.env.PYTHON_API_URL) return process.env.PYTHON_API_URL;
  return new URL("/api/analyze_python", requestUrl).toString();
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

  let pythonJson: unknown = null;
  let pythonStatus = 500;
  try {
    const pythonRes = await fetch(getPythonUrl(req.url), {
      method: "POST",
      body: pythonFormData
    });
    pythonStatus = pythonRes.status;
    const text = await pythonRes.text();
    try {
      pythonJson = text ? JSON.parse(text) : null;
    } catch {
      pythonJson = { success: false, refund: true, error: "System error" };
      pythonStatus = 500;
    }
  } catch {
    pythonJson = { success: false, refund: true, error: "System error" };
    pythonStatus = 500;
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

  if (parsedSuccess.success) {
    const result = parsedSuccess.data;
    if (bypassTokens) {
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
    } else {
      let updated: Array<{ balance: number | null }> = [];
      try {
        updated = await db
          .update(tokenBalances)
          .set({
            balance: sql`${tokenBalances.balance} - ${ANALYSIS_TOKEN_COST}`,
            totalUsed: sql`${tokenBalances.totalUsed} + ${ANALYSIS_TOKEN_COST}`,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(tokenBalances.userId, userId),
              gte(tokenBalances.balance, ANALYSIS_TOKEN_COST)
            )
          )
          .returning({ balance: tokenBalances.balance });
      } catch {
        await db.update(analyses).set({ status: "failed" }).where(eq(analyses.id, analysisId));
        return NextResponse.json({ success: false, error: "System error" }, { status: 500 });
      }

      if (updated.length === 0) {
        await db.update(analyses).set({ status: "failed" }).where(eq(analyses.id, analysisId));
        return NextResponse.json(
          { success: false, error: "Insufficient tokens" },
          { status: 402 }
        );
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
        // If persisting the analysis metadata fails, still return the analysis result.
      }
    }

    try {
      const prvNeeded = result.prv?.needed ?? false;
      const sourceFileBase64 = prvNeeded
        ? Buffer.from(await file.arrayBuffer()).toString("base64")
        : undefined;
      const payload = {
        analysisId,
        fileName: result.summary?.fileName ?? file.name,
        sourceFileName: file.name,
        sourceFileBase64,
        summary: result.summary,
        prv: result.prv,
        files: result.files,
        filesV1: result.filesV1,
        filesFinal: result.filesFinal,
        nodes: (result as any).nodes,
        pipes: (result as any).pipes,
        materials: (result as any).materials,
        networkInfo: (result as any).networkInfo
      };
      await upsertAnalysisSnapshot(db, analysisId, payload);
    } catch {
      // ignore snapshot failures
    }

    return NextResponse.json({ ...result, analysisId });
  }

  await db.update(analyses).set({ status: "failed" }).where(eq(analyses.id, analysisId));
  const error = parsedFail.success ? (parsedFail.data.error ?? "System error") : "System error";

  return NextResponse.json(
    { success: false, error },
    { status: pythonStatus === 422 ? 422 : 500 }
  );
}
