import { NextResponse } from "next/server";

import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { shouldBypassTokensForEmail } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { analyses, analysisSnapshots, tokenBalances } from "@/lib/db/schema";
import { buildPythonApiUrl } from "@/lib/python-api";
import { ensureInitialTokenBalanceRow } from "@/lib/token-balance";
import {
  DOWNLOAD_EXCEL_TOKEN_COST,
  DOWNLOAD_INP_TOKEN_COST,
  DOWNLOAD_PDF_TOKEN_COST
} from "@/lib/token-constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FormatSchema = z.enum(["inp", "pdf", "xlsx", "excel"]);
const VariantSchema = z.enum(["v1", "final", "source"]);

function stripExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

function safeFilenamePart(value: string) {
  const normalized = value
    .replace(/[\\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || "epanet";
}

function yyyymmdd(date: Date | null | undefined) {
  const iso = (date ?? new Date()).toISOString().slice(0, 10);
  return iso.replaceAll("-", "");
}

function escapePdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function buildPdfBytes(lines: Array<{ text: string; size?: number; gap?: number }>) {
  const pageHeight = 842;
  let cursorY = 770;
  const commands: string[] = [];

  for (const line of lines) {
    if (cursorY < 56) break;
    const size = line.size ?? 12;
    const gap = line.gap ?? 18;
    const clipped = line.text.length > 140 ? `${line.text.slice(0, 137)}...` : line.text;
    commands.push(`BT /F1 ${size} Tf 56 ${cursorY} Td (${escapePdfText(clipped)}) Tj ET`);
    cursorY -= gap;
  }

  const content = commands.join("\n");
  const contentLength = content.length;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`,
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${contentLength} >> stream\n${content}\nendstream endobj`
  ];

  const header = "%PDF-1.4\n";
  let body = "";
  const offsets: number[] = [0];
  let currentOffset = header.length;

  for (const obj of objects) {
    offsets.push(currentOffset);
    body += `${obj}\n`;
    currentOffset += `${obj}\n`.length;
  }

  const xrefOffset = header.length + body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(`${header}${body}${xref}${trailer}`, "utf8");
}

function parseErrorMessage(text: string) {
  try {
    const json = text ? JSON.parse(text) : null;
    return json?.detail ?? json?.error ?? "Not found";
  } catch {
    return text?.trim() || "Not found";
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtmlTable(title: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return `<h3>${escapeHtml(title)}</h3><p>(kosong)</p>`;
  const keys = Object.keys(rows[0] ?? {});
  const header = `<tr>${keys.map((k) => `<th>${escapeHtml(k)}</th>`).join("")}</tr>`;
  const body = rows
    .map(
      (r) =>
        `<tr>${keys.map((k) => `<td>${escapeHtml((r as any)[k])}</td>`).join("")}</tr>`
    )
    .join("");
  return `
    <h3>${escapeHtml(title)}</h3>
    <table border="1" cellspacing="0" cellpadding="4">
      <thead>${header}</thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

async function refundTokens(db: any, userId: string, tokenCost: number) {
  try {
    await db
      .update(tokenBalances)
      .set({
        balance: sql`${tokenBalances.balance} + ${tokenCost}`,
        totalUsed: sql`${tokenBalances.totalUsed} - ${tokenCost}`,
        updatedAt: new Date()
      })
      .where(eq(tokenBalances.userId, userId));
  } catch {
    // best-effort refund
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ analysisId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bypassTokens = shouldBypassTokensForEmail(userEmail);

  const { analysisId: analysisIdRaw } = await ctx.params;
  const analysisId = Number(analysisIdRaw);
  if (!Number.isFinite(analysisId)) {
    return NextResponse.json({ error: "Invalid analysisId" }, { status: 400 });
  }

  const url = new URL(req.url);
  const formatParsed = FormatSchema.safeParse(url.searchParams.get("format") ?? "");
  if (!formatParsed.success) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  const format = formatParsed.data === "xlsx" ? "excel" : formatParsed.data;

  const variantParam = url.searchParams.get("variant");
  const variantParsed = VariantSchema.safeParse(variantParam ?? "");
  const variantRequested = variantParsed.success ? variantParsed.data : undefined;

  const tokenCost =
    format === "pdf"
      ? DOWNLOAD_PDF_TOKEN_COST
      : format === "inp"
        ? DOWNLOAD_INP_TOKEN_COST
        : DOWNLOAD_EXCEL_TOKEN_COST;

  const db = getDb();

  const analysisRows = await db
    .select({
      id: analyses.id,
      userId: analyses.userId,
      fileName: analyses.fileName,
      createdAt: analyses.createdAt
    })
    .from(analyses)
    .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId)));

  const analysis = analysisRows[0];
  if (!analysis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const snapRows = await db
    .select({ payload: analysisSnapshots.payload })
    .from(analysisSnapshots)
    .where(eq(analysisSnapshots.analysisId, analysisId));

  const snapshot = (snapRows[0]?.payload ?? null) as any;
  const backendJobId = typeof snapshot?.backendJobId === "string" ? snapshot.backendJobId : null;
  if (!backendJobId) {
    return NextResponse.json({ error: "Result expired or unavailable" }, { status: 410 });
  }

  const hasFinalFiles = Boolean(snapshot?.filesFinal && (snapshot?.filesFinal as any)?.inpUrl);

  const variantResolved: z.infer<typeof VariantSchema> =
    variantRequested ??
    (hasFinalFiles ? "final" : "v1");

  if (variantResolved === "final" && !hasFinalFiles) {
    return NextResponse.json({ error: "Final result not available" }, { status: 404 });
  }

  const base = safeFilenamePart(stripExtension(String(analysis.fileName ?? "epanet.inp")));
  const dateStamp = yyyymmdd(analysis.createdAt ?? undefined);
  const code = `A${analysisId}`;

  const variantLabel =
    variantResolved === "source"
      ? "source"
      : hasFinalFiles
        ? variantResolved === "v1"
          ? "prePRV"
          : "postPRV"
        : "optimized";

  const fileStem = `${base}_${dateStamp}_${code}_${variantLabel}`;

  let charged = false;
  if (!bypassTokens && tokenCost > 0) {
    await ensureInitialTokenBalanceRow(db, userId);
    const updated = await db
      .update(tokenBalances)
      .set({
        balance: sql`${tokenBalances.balance} - ${tokenCost}`,
        totalUsed: sql`${tokenBalances.totalUsed} + ${tokenCost}`,
        updatedAt: new Date()
      })
      .where(and(eq(tokenBalances.userId, userId), gte(tokenBalances.balance, tokenCost)))
      .returning({ balance: tokenBalances.balance });
    if (updated.length === 0) {
      return NextResponse.json({ error: "Insufficient tokens" }, { status: 402 });
    }
    charged = true;
  }

  try {
  if (format === "inp") {
      const backendFile =
        variantResolved === "source"
          ? "input.inp"
          : variantResolved === "v1"
            ? "optimized_v1.inp"
            : "optimized_final.inp";

      const backendUrl = buildPythonApiUrl(
        req.url,
        `/v1/simulations/${encodeURIComponent(backendJobId)}/files/${encodeURIComponent(
          backendFile
        )}`
      );

      const res = await fetch(backendUrl, { method: "GET" });
      if (!res.ok) {
        const msg = parseErrorMessage(await res.text());
        if (charged) await refundTokens(db, userId, tokenCost);
        return NextResponse.json({ error: msg }, { status: res.status });
      }

      const buf = Buffer.from(await res.arrayBuffer());
      const headers = new Headers();
      headers.set("content-type", "application/octet-stream");
      headers.set("content-disposition", `attachment; filename="${fileStem}.inp"`);
      return new Response(buf, { status: 200, headers });
    }

    if (format === "pdf") {
      const reportFile =
        variantResolved === "final" ? "report_final.md" : "report_v1.md";

      const backendUrl = buildPythonApiUrl(
        req.url,
        `/v1/simulations/${encodeURIComponent(backendJobId)}/files/${encodeURIComponent(
          reportFile
        )}`
      );
      const res = await fetch(backendUrl, { method: "GET" });
      if (!res.ok) {
        const msg = parseErrorMessage(await res.text());
        if (charged) await refundTokens(db, userId, tokenCost);
        return NextResponse.json({ error: msg }, { status: res.status });
      }

      const md = await res.text();
      const mdLines = md
        .split(/\r?\n/g)
        .map((l) => l.replaceAll("\t", " ").trimEnd())
        .filter((l) => l.trim().length > 0)
        .slice(0, 40);

      const pdf = buildPdfBytes([
        { text: "EPANET Solver", size: 18, gap: 24 },
        { text: "Laporan Analisis (Ringkas)", size: 14, gap: 22 },
        { text: `File        : ${analysis.fileName ?? ""}` },
        { text: `Analisis     : ${code}` },
        { text: `Tanggal      : ${dateStamp}` },
        { text: `Versi        : ${variantLabel}` },
        { text: "" },
        ...mdLines.map((text) => ({ text, size: 10, gap: 14 }))
      ]);

      const headers = new Headers();
      headers.set("content-type", "application/pdf");
      headers.set("content-disposition", `attachment; filename="${fileStem}_report.pdf"`);
      return new Response(pdf, { status: 200, headers });
    }

    // excel (served as .xls HTML so it can be opened by Excel)
    const reportFile = variantResolved === "final" ? "report_final.md" : "report_v1.md";
    let reportText = "";
    try {
      const backendUrl = buildPythonApiUrl(
        req.url,
        `/v1/simulations/${encodeURIComponent(backendJobId)}/files/${encodeURIComponent(
          reportFile
        )}`
      );
      const res = await fetch(backendUrl, { method: "GET" });
      if (res.ok) reportText = await res.text();
    } catch {
      reportText = "";
    }

    const summary = snapshot?.summary ?? {};
    const summaryRows = [
      { key: "analysis_id", value: analysisId },
      { key: "file_name", value: String(analysis.fileName ?? "") },
      { key: "date_yyyymmdd", value: dateStamp },
      { key: "variant", value: variantLabel },
      { key: "iterations", value: summary?.iterations ?? "" },
      { key: "issues_found", value: summary?.issuesFound ?? "" },
      { key: "issues_fixed", value: summary?.issuesFixed ?? "" },
      { key: "remaining_issues", value: summary?.remainingIssues ?? "" },
      { key: "nodes", value: summary?.nodes ?? "" },
      { key: "pipes", value: summary?.pipes ?? "" }
    ];

    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
    const pipes = Array.isArray(snapshot?.pipes) ? snapshot.pipes : [];
    const materials = Array.isArray(snapshot?.materials) ? snapshot.materials : [];

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>EPANET Solver Export</title>
        </head>
        <body>
          <h2>EPANET Solver — Export Excel</h2>
          ${buildHtmlTable("Summary", summaryRows)}
          ${buildHtmlTable("Nodes", nodes)}
          ${buildHtmlTable("Pipes", pipes)}
          ${buildHtmlTable("Materials", materials)}
          <h3>Report (Markdown)</h3>
          <pre>${escapeHtml(reportText)}</pre>
        </body>
      </html>
    `;
    const out = Buffer.from(html, "utf8");
    const headers = new Headers();
    headers.set(
      "content-type",
      "application/vnd.ms-excel; charset=utf-8"
    );
    headers.set("content-disposition", `attachment; filename="${fileStem}_analysis.xls"`);
    return new Response(out, { status: 200, headers });
  } catch (e) {
    if (charged) await refundTokens(db, userId, tokenCost);
    console.error("Export failed", { analysisId, format, variantResolved, error: e });
    return NextResponse.json({ error: "System error" }, { status: 500 });
  }
}
