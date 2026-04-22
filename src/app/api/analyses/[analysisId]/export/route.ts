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
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replace(/[^\x20-\x7E]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

type PdfFontKey = "F1" | "F2";

type PdfLine = { text: string; size?: number; gap?: number; font?: PdfFontKey };

// Each page can optionally be rendered in landscape orientation (A4: 842x595).
type PdfPage = {
  lines: PdfLine[];
  landscape?: boolean;
};

function getPageDims(landscape?: boolean) {
  return landscape
    ? { width: 842, height: 595, startY: 558, minY: 28, marginX: 56 }
    : { width: 595, height: 842, startY: 770, minY: 56, marginX: 56 };
}

function buildPdfBytes(pages: PdfPage[]) {
  function renderPageContent(lines: PdfLine[], landscape?: boolean) {
    const { startY, minY, marginX } = getPageDims(landscape);
    let cursorY = startY;
    const commands: string[] = [];

    for (const line of lines) {
      if (cursorY < minY) break;
      const size = line.size ?? 10;
      const gap = line.gap ?? 14;
      const font = line.font ?? "F1";
      const clipped = line.text.length > 200 ? `${line.text.slice(0, 197)}...` : line.text;
      commands.push(
        `BT /${font} ${size} Tf ${marginX} ${cursorY} Td (${escapePdfText(clipped)}) Tj ET`
      );
      cursorY -= gap;
    }

    return commands.join("\n");
  }

  const pageCount = Math.max(1, pages.length);
  const pageObjNums = Array.from({ length: pageCount }, (_, i) => 5 + i * 2);
  const contentObjNums = pageObjNums.map((n) => n + 1);

  const objects: string[] = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push(
    `2 0 obj << /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageCount} >> endobj`
  );
  objects.push("3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
  objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj");

  for (let i = 0; i < pageCount; i += 1) {
    const page = pages[i] ?? { lines: [] };
    const landscape = page.landscape ?? false;
    const { width, height } = getPageDims(landscape);
    const pageObjNum = pageObjNums[i];
    const contentObjNum = contentObjNums[i];
    objects.push(
      `${pageObjNum} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >> endobj`
    );
    const content = renderPageContent(page.lines, landscape);
    objects.push(
      `${contentObjNum} 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`
    );
  }

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

function padCell(value: string, width: number, align: "left" | "right") {
  const raw = value ?? "";
  const clipped = raw.length > width ? raw.slice(0, width) : raw;
  if (align === "right") return clipped.padStart(width, " ");
  return clipped.padEnd(width, " ");
}

function asTableRow(cells: Array<{ value: string; width: number; align: "left" | "right" }>) {
  return cells.map((c) => padCell(c.value, c.width, c.align)).join(" ");
}

function buildTablePdfPages(args: {
  headerLines: PdfLine[];
  title: string;
  headerRow: string;
  rows: string[];
  emptyLabel?: string;
  maxLinesPerPage?: number;
  landscape?: boolean;
}): PdfPage[] {
  const landscape = args.landscape ?? false;
  // Landscape pages are shorter (fewer lines fit vertically).
  const defaultMax = landscape ? 34 : 46;
  const maxLinesPerPage = args.maxLinesPerPage ?? defaultMax;
  const separator = "-".repeat(Math.max(24, Math.min(160, args.headerRow.length)));
  const pages: PdfPage[] = [];

  const rows = args.rows.length > 0 ? args.rows : [args.emptyLabel ?? "(kosong)"];

  let offset = 0;
  let pageIndex = 0;
  while (offset < rows.length) {
    const title = pageIndex === 0 ? args.title : `${args.title} (lanjutan)`;
    const lines: PdfLine[] = [
      ...args.headerLines,
      { text: title, size: 12, gap: 18, font: "F1" },
      { text: args.headerRow, size: 9, gap: 13, font: "F2" },
      { text: separator, size: 9, gap: 13, font: "F2" }
    ];

    const remaining = Math.max(1, maxLinesPerPage - lines.length);
    const chunk = rows.slice(offset, offset + remaining);
    lines.push(...chunk.map((text) => ({ text, size: 9, gap: 13, font: "F2" as const })));

    pages.push({ lines, landscape });
    offset += chunk.length;
    pageIndex += 1;
  }

  return pages;
}

// Builds the summary/overview page (first page of the PDF report).
function buildSummaryPdfPage(args: {
  headerLines: PdfLine[];
  summary: Record<string, unknown>;
  networkInfo: { totalDemandLps?: number; headReservoirM?: number } | null | undefined;
  nodes: unknown[];
  pipes: unknown[];
  variantLabel: string;
}): PdfPage {
  const { summary, networkInfo, nodes, pipes } = args;

  const vWarn = (pipes as any[]).some(
    (p) => p.code === "V-HIGH" || p.code === "HL-SMALL"
  );
  const hlWarn = (pipes as any[]).some(
    (p) => p.code === "HL-HIGH" || p.code === "HL-SMALL"
  );
  const pWarn = (nodes as any[]).some((n) => n.code !== "P-OK");

  const line = (text: string, font: PdfFontKey = "F2", size = 10, gap = 14): PdfLine => ({
    text,
    font,
    size,
    gap
  });
  const blank = (): PdfLine => ({ text: "", size: 8, gap: 10, font: "F1" });
  const section = (text: string): PdfLine => ({
    text,
    font: "F1",
    size: 10,
    gap: 16
  });

  const labelW = 22;
  const row = (label: string, value: string) =>
    line(
      `${label.padEnd(labelW)} : ${value}`
    );

  const lines: PdfLine[] = [
    ...args.headerLines,
    { text: "RINGKASAN ANALISIS", size: 13, gap: 20, font: "F1" },
    blank(),
    section("--- Informasi Jaringan ---"),
    row("Jumlah Simpul (Node)", String(summary?.nodes ?? "-")),
    row("Jumlah Pipa", String(summary?.pipes ?? "-")),
    row(
      "Total Demand",
      networkInfo?.totalDemandLps !== undefined
        ? `${Number(networkInfo.totalDemandLps).toFixed(2)} L/s`
        : "-"
    ),
    row(
      "Head Reservoir",
      networkInfo?.headReservoirM !== undefined
        ? `${Number(networkInfo.headReservoirM).toFixed(1)} m`
        : "-"
    ),
    blank(),
    section("--- Hasil Optimasi ---"),
    row("Iterasi", String(summary?.iterations ?? "-")),
    row(
      "Durasi",
      summary?.duration !== undefined ? `${summary.duration}s` : "-"
    ),
    row("Masalah Ditemukan", String(summary?.issuesFound ?? "-")),
    row("Berhasil Diperbaiki", String(summary?.issuesFixed ?? "-")),
    row("Masalah Tersisa", String(summary?.remainingIssues ?? "-")),
    blank(),
    section("--- Status Evaluasi Jaringan ---"),
    row("Kecepatan (V)", vWarn ? "Ada Masalah (V-HIGH / HL-SMALL)" : "OK"),
    row("Headloss (HL)", hlWarn ? "Ada Masalah (HL-HIGH / HL-SMALL)" : "OK"),
    row("Tekanan (P)", pWarn ? "Ada Masalah (P-LOW / P-HIGH / P-NEG)" : "OK"),
    blank(),
    section("--- Keterangan ---"),
    line(
      "Kondisi Awal  = jaringan input sebelum optimasi",
      "F1",
      9,
      13
    ),
    line(
      `Kondisi Akhir = ${args.variantLabel === "final" || args.variantLabel === "postPRV" ? "hasil Fix Pressure (diameter + PRV)" : "hasil optimasi diameter (v1)"}`,
      "F1",
      9,
      13
    ),
    line(
      "Standar       : Permen PU No. 18/2007 (V: 0.3-2.5 m/s, HL<=10 m/km, P: 10-80 m)",
      "F1",
      9,
      13
    )
  ];

  return { lines };
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

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const raw = v.trim();
  if (!raw) return null;

  const direct = Number(raw);
  if (Number.isFinite(direct)) return direct;

  if (raw.includes(",") && !raw.includes(".")) {
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function fx(v: unknown, d = 2): string {
  const n = toFiniteNumber(v);
  return typeof n === "number" ? n.toFixed(d) : "-";
}

function fxAscii(v: unknown, d = 2): string {
  const n = toFiniteNumber(v);
  return typeof n === "number" ? n.toFixed(d) : "-";
}

type ExportCondition = "awal" | "akhir";

function nodeHeadM(node: any, condition: ExportCondition, useTekanan: boolean) {
  if (condition === "awal") return toFiniteNumber(node?.headAwalM);
  return useTekanan
    ? toFiniteNumber(node?.headTekananM)
    : toFiniteNumber(node?.headDiameterM);
}

function nodePressureM(node: any, condition: ExportCondition, useTekanan: boolean) {
  if (condition === "awal") return toFiniteNumber(node?.pressureAwalM);
  return useTekanan
    ? toFiniteNumber(node?.pressureTekananM)
    : toFiniteNumber(node?.pressureDiameterM);
}

function pipeDiameterMm(pipe: any, condition: ExportCondition, useTekanan: boolean) {
  if (condition === "awal") return toFiniteNumber(pipe?.diameterAwalMm);
  return useTekanan
    ? toFiniteNumber(pipe?.diameterTekananMm)
    : toFiniteNumber(pipe?.diameterDiameterMm);
}

function pipeFlowDisplayLps(pipe: any, condition: ExportCondition, useTekanan: boolean) {
  const raw = (() => {
    if (condition === "awal") return pipe?.flowAwalLpsAbs ?? pipe?.flowAwalLps;
    if (useTekanan) return pipe?.flowTekananLpsAbs ?? pipe?.flowTekananLps;
    return pipe?.flowDiameterLpsAbs ?? pipe?.flowDiameterLps;
  })();

  const n = toFiniteNumber(raw);
  return typeof n === "number" ? Math.abs(n) : null;
}

function pipeVelocityMps(pipe: any, condition: ExportCondition, useTekanan: boolean) {
  if (condition === "awal") return toFiniteNumber(pipe?.velocityAwalMps);
  return useTekanan
    ? toFiniteNumber(pipe?.velocityTekananMps)
    : toFiniteNumber(pipe?.velocityDiameterMps);
}

function pipeUnitHeadlossMkm(pipe: any, condition: ExportCondition, useTekanan: boolean) {
  if (condition === "awal") return toFiniteNumber(pipe?.unitHeadlossAwalMkm);
  return useTekanan
    ? toFiniteNumber(pipe?.unitHeadlossTekananMkm)
    : toFiniteNumber(pipe?.unitHeadlossDiameterMkm);
}

// Returns CSS background color for a node/pipe status code.
function statusBg(code: string | undefined | null): string {
  switch (code) {
    case "P-OK":
    case "OK":
      return "#d1fae5"; // green-100
    case "P-LOW":
    case "V-LOW":
      return "#fef3c7"; // yellow-100
    case "P-HIGH":
    case "V-HIGH":
    case "HL-HIGH":
    case "HL-SMALL":
      return "#fee2e2"; // red-100
    case "P-NEG":
      return "#ede9fe"; // violet-100
    default:
      return "transparent";
  }
}

function buildHtmlTable(title: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return `<h3>${escapeHtml(title)}</h3><p>(kosong)</p>`;
  const keys = Object.keys(rows[0] ?? {});
  const header = `<tr>${keys.map((k) => `<th>${escapeHtml(k)}</th>`).join("")}</tr>`;
  const body = rows
    .map(
      (r) =>
        `<tr>${keys
          .map((k) => {
            const val = (r as any)[k];
            if (k === "Status") {
              const bg = statusBg(String(val));
              return `<td style="background:${bg};font-weight:600">${escapeHtml(val)}</td>`;
            }
            return `<td>${escapeHtml(val)}</td>`;
          })
          .join("")}</tr>`
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

    // ─── PDF ──────────────────────────────────────────────────────────────────
    if (format === "pdf") {
      const includeAkhir = variantResolved !== "source";
      const useTekanan = variantResolved === "final";

      const nodes: any[] = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
      const pipes: any[] = Array.isArray(snapshot?.pipes) ? snapshot.pipes : [];
      const materials: any[] = Array.isArray(snapshot?.materials) ? snapshot.materials : [];
      const summary: Record<string, unknown> = snapshot?.summary ?? {};
      const networkInfo = snapshot?.networkInfo ?? null;

      const akhirLabel =
        useTekanan
          ? "Kondisi Akhir (Fix Pressure / Post-PRV)"
          : "Kondisi Akhir (Optimasi Diameter / v1)";

      // Header block printed at the top of every page.
      const headerLines: PdfLine[] = [
        { text: "EPANET Solver", size: 16, gap: 22, font: "F1" },
        { text: "Laporan Hasil Analisis Jaringan Air Bersih", size: 11, gap: 16, font: "F1" },
        { text: `File     : ${String(analysis.fileName ?? "")}`, size: 9, gap: 13, font: "F1" },
        {
          text: `Analisis : ${code}    Tanggal: ${dateStamp}    Versi: ${variantLabel}`,
          size: 9,
          gap: 13,
          font: "F1"
        },
        { text: "", size: 8, gap: 10, font: "F1" }
      ];

      // ── Node columns (portrait) ──────────────────────────────────────────
      // Portrait usable: ~80 chars at Courier 9pt
      const nodeColsAwal = [
        { value: "Node", width: 16, align: "left" as const },
        { value: "Elevation (m)", width: 13, align: "right" as const },
        { value: "Base Demand (L/s)", width: 18, align: "right" as const },
        { value: "Head (m)", width: 10, align: "right" as const },
        { value: "Pressure (m)", width: 12, align: "right" as const }
      ];
      const nodeColsAkhir = [
        ...nodeColsAwal,
        { value: "Status", width: 10, align: "right" as const }
      ];

      // ── Link columns (landscape) ─────────────────────────────────────────
      // Landscape usable: ~115 chars at Courier 9pt
      const linkColsAwal = [
        { value: "Links", width: 16, align: "left" as const },
        { value: "Length (m)", width: 10, align: "right" as const },
        { value: "Diameter (mm)", width: 13, align: "right" as const },
        { value: "Roughness (C)", width: 13, align: "right" as const },
        { value: "Flow (L/s)", width: 10, align: "right" as const },
        { value: "Velocity (m/s)", width: 13, align: "right" as const },
        { value: "Unit Headloss (m/km)", width: 20, align: "right" as const }
      ];
      const linkColsAkhir = [
        ...linkColsAwal,
        { value: "Status", width: 10, align: "right" as const }
      ];

      // ── Materials columns (landscape) ────────────────────────────────────
      const matCols = [
        { value: "Pipa", width: 16, align: "left" as const },
        { value: "D Rekomendasi (mm)", width: 18, align: "right" as const },
        { value: "Material", width: 22, align: "left" as const },
        { value: "Nilai C", width: 8, align: "right" as const },
        { value: "Tek Kerja (m)", width: 13, align: "right" as const },
        { value: "Catatan", width: 35, align: "left" as const }
      ];

      function nodeRowsFor(condition: ExportCondition, withStatus: boolean) {
        return nodes.map((n) => {
          const cells = [
            { value: String(n?.id ?? ""), width: 16, align: "left" as const },
            { value: fxAscii(n?.elevation, 2), width: 13, align: "right" as const },
            { value: fxAscii(n?.baseDemandLps, 2), width: 18, align: "right" as const },
            { value: fxAscii(nodeHeadM(n, condition, useTekanan), 2), width: 10, align: "right" as const },
            { value: fxAscii(nodePressureM(n, condition, useTekanan), 2), width: 12, align: "right" as const }
          ];
          if (withStatus) cells.push({ value: String(n?.code ?? "-"), width: 10, align: "right" as const });
          return asTableRow(cells);
        });
      }

      function linkRowsFor(condition: ExportCondition, withStatus: boolean) {
        return pipes.map((p) => {
          const cells = [
            { value: String(p?.id ?? ""), width: 16, align: "left" as const },
            { value: fxAscii(p?.length, 1), width: 10, align: "right" as const },
            { value: fxAscii(pipeDiameterMm(p, condition, useTekanan), 1), width: 13, align: "right" as const },
            { value: fxAscii(p?.roughnessC, 0), width: 13, align: "right" as const },
            { value: fxAscii(pipeFlowDisplayLps(p, condition, useTekanan), 3), width: 10, align: "right" as const },
            { value: fxAscii(pipeVelocityMps(p, condition, useTekanan), 3), width: 13, align: "right" as const },
            { value: fxAscii(pipeUnitHeadlossMkm(p, condition, useTekanan), 2), width: 20, align: "right" as const }
          ];
          if (withStatus) cells.push({ value: String(p?.code ?? "-"), width: 10, align: "right" as const });
          return asTableRow(cells);
        });
      }

      function matRows() {
        return materials.map((m) =>
          asTableRow([
            { value: String(m?.pipeId ?? ""), width: 16, align: "left" },
            { value: fxAscii(m?.diameterMm, 1), width: 18, align: "right" },
            { value: String(m?.material ?? "-").slice(0, 22), width: 22, align: "left" },
            { value: fxAscii(m?.C, 0), width: 8, align: "right" },
            { value: fxAscii(m?.pressureWorkingM, 2), width: 13, align: "right" },
            {
              value: (Array.isArray(m?.notes) ? (m.notes as string[]).join("; ") : "-") || "-",
              width: 35,
              align: "left"
            }
          ])
        );
      }

      // Build all PDF pages
      const allPages: PdfPage[] = [
        // Page 1: Summary
        buildSummaryPdfPage({ headerLines, summary, networkInfo, nodes, pipes, variantLabel }),

        // Pages: Kondisi Awal - Nodes (portrait)
        ...buildTablePdfPages({
          headerLines,
          title: "Kondisi Awal - Nodes",
          headerRow: asTableRow(nodeColsAwal),
          rows: nodeRowsFor("awal", false),
          emptyLabel: "(Tidak ada data node)"
        }),

        // Pages: Kondisi Awal - Links (landscape)
        ...buildTablePdfPages({
          headerLines,
          title: "Kondisi Awal - Links",
          headerRow: asTableRow(linkColsAwal),
          rows: linkRowsFor("awal", false),
          emptyLabel: "(Tidak ada data links)",
          landscape: true
        }),

        // Pages: Kondisi Akhir (only when not source variant)
        ...(includeAkhir
          ? [
              ...buildTablePdfPages({
                headerLines,
                title: `${akhirLabel} - Nodes`,
                headerRow: asTableRow(nodeColsAkhir),
                rows: nodeRowsFor("akhir", true),
                emptyLabel: "(Tidak ada data node)"
              }),
              ...buildTablePdfPages({
                headerLines,
                title: `${akhirLabel} - Links`,
                headerRow: asTableRow(linkColsAkhir),
                rows: linkRowsFor("akhir", true),
                emptyLabel: "(Tidak ada data links)",
                landscape: true
              })
            ]
          : [
              {
                lines: [
                  ...headerLines,
                  { text: "Kondisi Akhir", size: 12, gap: 18, font: "F1" as const },
                  {
                    text: "(Tidak ditampilkan untuk variant=source)",
                    size: 10,
                    gap: 14,
                    font: "F1" as const
                  }
                ]
              }
            ]),

        // Pages: Materials (landscape, if any)
        ...(materials.length > 0
          ? buildTablePdfPages({
              headerLines,
              title: "Material Pipa Rekomendasi",
              headerRow: asTableRow(matCols),
              rows: matRows(),
              emptyLabel: "(Tidak ada data material)",
              landscape: true
            })
          : [])
      ];

      const pdf = buildPdfBytes(allPages);

      const headers = new Headers();
      headers.set("content-type", "application/pdf");
      headers.set("content-disposition", `attachment; filename="${fileStem}_report.pdf"`);
      return new Response(pdf, { status: 200, headers });
    }

    // ─── EXCEL (HTML served as .xls) ─────────────────────────────────────────
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
    const networkInfo = snapshot?.networkInfo ?? null;
    const useTekanan = variantResolved === "final";
    const includeAkhir = variantResolved !== "source";
    const kondisiAkhirLabel = useTekanan
      ? "Kondisi Akhir = hasil Fix Pressure (diameter + PRV)"
      : "Kondisi Akhir = hasil optimasi diameter (v1)";

    const nodes: any[] = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
    const pipes: any[] = Array.isArray(snapshot?.pipes) ? snapshot.pipes : [];
    const materials: any[] = Array.isArray(snapshot?.materials) ? snapshot.materials : [];

    const summaryRows = [
      { Keterangan: "Analysis ID", Nilai: analysisId },
      { Keterangan: "File", Nilai: String(analysis.fileName ?? "") },
      { Keterangan: "Tanggal (yyyymmdd)", Nilai: dateStamp },
      { Keterangan: "Versi export", Nilai: variantLabel },
      { Keterangan: "Kondisi Akhir", Nilai: kondisiAkhirLabel },
      { Keterangan: "---", Nilai: "---" },
      { Keterangan: "Jumlah Simpul (Node)", Nilai: summary?.nodes ?? "-" },
      { Keterangan: "Jumlah Pipa", Nilai: summary?.pipes ?? "-" },
      {
        Keterangan: "Total Demand (L/s)",
        Nilai: networkInfo?.totalDemandLps !== undefined
          ? Number(networkInfo.totalDemandLps).toFixed(2)
          : "-"
      },
      {
        Keterangan: "Head Reservoir (m)",
        Nilai: networkInfo?.headReservoirM !== undefined
          ? Number(networkInfo.headReservoirM).toFixed(1)
          : "-"
      },
      { Keterangan: "---", Nilai: "---" },
      { Keterangan: "Iterasi Optimasi", Nilai: summary?.iterations ?? "-" },
      { Keterangan: "Durasi (s)", Nilai: summary?.duration ?? "-" },
      { Keterangan: "Masalah Ditemukan", Nilai: summary?.issuesFound ?? "-" },
      { Keterangan: "Berhasil Diperbaiki", Nilai: summary?.issuesFixed ?? "-" },
      { Keterangan: "Masalah Tersisa", Nilai: summary?.remainingIssues ?? "-" }
    ];

    // Nodes — Kondisi Awal (no status code, just initial simulation values)
    const nodesRowsAwal = nodes.map((n: any) => ({
      Node: String(n?.id ?? ""),
      "Elevation (m)": fxAscii(n?.elevation, 2),
      "Base Demand (L/s)": fxAscii(n?.baseDemandLps, 2),
      "Head (m)": fxAscii(nodeHeadM(n, "awal", useTekanan), 2),
      "Pressure (m)": fxAscii(nodePressureM(n, "awal", useTekanan), 2)
    }));

    // Nodes — Kondisi Akhir (with Status column from optimization result)
    const nodesRowsAkhir = nodes.map((n: any) => ({
      Node: String(n?.id ?? ""),
      "Elevation (m)": fxAscii(n?.elevation, 2),
      "Base Demand (L/s)": fxAscii(n?.baseDemandLps, 2),
      "Head (m)": fxAscii(nodeHeadM(n, "akhir", useTekanan), 2),
      "Pressure (m)": fxAscii(nodePressureM(n, "akhir", useTekanan), 2),
      Status: String(n?.code ?? "-")
    }));

    // Links — Kondisi Awal
    const linksRowsAwal = pipes.map((p: any) => ({
      Links: String(p?.id ?? ""),
      "Length (m)": fxAscii(p?.length, 1),
      "Diameter (mm)": fxAscii(pipeDiameterMm(p, "awal", useTekanan), 1),
      "Roughness (C)": fxAscii(p?.roughnessC, 0),
      "Flow (L/s)": fxAscii(pipeFlowDisplayLps(p, "awal", useTekanan), 3),
      "Velocity (m/s)": fxAscii(pipeVelocityMps(p, "awal", useTekanan), 3),
      "Unit Headloss (m/km)": fxAscii(pipeUnitHeadlossMkm(p, "awal", useTekanan), 2)
    }));

    // Links — Kondisi Akhir (with Status column)
    const linksRowsAkhir = pipes.map((p: any) => ({
      Links: String(p?.id ?? ""),
      "Length (m)": fxAscii(p?.length, 1),
      "Diameter (mm)": fxAscii(pipeDiameterMm(p, "akhir", useTekanan), 1),
      "Roughness (C)": fxAscii(p?.roughnessC, 0),
      "Flow (L/s)": fxAscii(pipeFlowDisplayLps(p, "akhir", useTekanan), 3),
      "Velocity (m/s)": fxAscii(pipeVelocityMps(p, "akhir", useTekanan), 3),
      "Unit Headloss (m/km)": fxAscii(pipeUnitHeadlossMkm(p, "akhir", useTekanan), 2),
      Status: String(p?.code ?? "-")
    }));

    // Materials — all notes joined
    const materialsRows = materials.map((m: any) => ({
      Pipa: String(m?.pipeId ?? ""),
      "D Rekomendasi (mm)": fxAscii(m?.diameterMm, 1),
      Material: String(m?.material ?? "-"),
      "Nilai C": fxAscii(m?.C, 0),
      "Tekanan Kerja (m)": fxAscii(m?.pressureWorkingM, 2),
      Catatan: (Array.isArray(m?.notes) ? (m.notes as string[]).join("; ") : "") || "-"
    }));

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>EPANET Solver Export</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 13px; }
            h2 { margin: 20px 0 6px; border-bottom: 2px solid #334155; padding-bottom: 4px; color: #0f172a; }
            h3 { margin: 14px 0 6px; color: #1e293b; }
            .meta { color: #64748b; font-size: 11px; margin-bottom: 6px; }
            .section-label {
              display: inline-block;
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 3px 10px;
              font-size: 11px;
              font-weight: 600;
              color: #475569;
              margin: 10px 0 6px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            table { border-collapse: collapse; margin: 4px 0 18px; }
            th, td { border: 1px solid #94a3b8; padding: 4px 8px; white-space: nowrap; font-size: 12px; }
            th { background: #e2e8f0; font-weight: 700; text-align: left; }
            td { text-align: right; }
            td:first-child { text-align: left; font-weight: 600; }
            .ok   { background: #d1fae5; }
            .warn { background: #fef3c7; }
            .err  { background: #fee2e2; }
            pre { white-space: pre-wrap; font-family: Consolas, monospace; font-size: 11px;
                  background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 4px; }
            .matrix-table td { text-align: left; font-weight: normal; }
          </style>
        </head>
        <body>
          <h2>EPANET Solver &mdash; Laporan Analisis Jaringan Air Bersih</h2>
          <div class="meta">
            File: <strong>${escapeHtml(analysis.fileName ?? "")}</strong> &nbsp;|&nbsp;
            Analisis: <strong>${escapeHtml(code)}</strong> &nbsp;|&nbsp;
            Tanggal: <strong>${escapeHtml(dateStamp)}</strong> &nbsp;|&nbsp;
            Versi: <strong>${escapeHtml(variantLabel)}</strong>
          </div>
          <div class="meta">${escapeHtml(kondisiAkhirLabel)}</div>

          ${buildHtmlTable("Ringkasan", summaryRows)}

          <h2>Kondisi Awal (Jaringan Input Sebelum Optimasi)</h2>
          <div class="meta">Data hasil simulasi awal sebelum perubahan diameter dilakukan.</div>
          ${buildHtmlTable("Nodes &mdash; Kondisi Awal", nodesRowsAwal)}
          ${buildHtmlTable("Links &mdash; Kondisi Awal", linksRowsAwal)}

          <h2>Kondisi Akhir (${escapeHtml(
            useTekanan ? "Fix Pressure / Post-PRV" : "Optimasi Diameter / v1"
          )})</h2>
          <div class="meta">
            Data hasil optimasi akhir. Kolom <strong>Status</strong> menunjukkan kondisi setiap elemen
            (OK = sesuai standar, P-LOW/P-HIGH = masalah tekanan, V-HIGH/HL-HIGH = masalah kecepatan/headloss).
          </div>
          ${
            includeAkhir
              ? `${buildHtmlTable("Nodes &mdash; Kondisi Akhir", nodesRowsAkhir)}${buildHtmlTable("Links &mdash; Kondisi Akhir", linksRowsAkhir)}`
              : `<div class="meta">(Tidak ditampilkan untuk variant=source)</div>`
          }

          ${materialsRows.length > 0 ? `
          <h2>Material Pipa Rekomendasi</h2>
          <div class="meta">Rekomendasi material berdasarkan tekanan kerja dan diameter hasil optimasi.</div>
          ${buildHtmlTable("Materials", materialsRows)}
          <h3>Dasar Pemilihan Material</h3>
          <table class="matrix-table">
            <thead><tr><th>Kondisi</th><th>Material</th><th>Nilai C</th></tr></thead>
            <tbody>
              <tr><td>Tekanan &le; 100m, D &le; 110mm</td><td>PVC AW PN-10</td><td>140</td></tr>
              <tr><td>Tekanan &le; 100m, D &gt; 110mm</td><td>HDPE PE100 PN-10</td><td>140</td></tr>
              <tr><td>Tekanan 100&ndash;160m</td><td>HDPE PE100 PN-16</td><td>140</td></tr>
              <tr><td>Tekanan &gt; 160m</td><td>GIP Heavy / Steel</td><td>120</td></tr>
            </tbody>
          </table>
          <div class="meta">Referensi: SNI 06-2550-1991 (PVC) &middot; SNI 4829.2:2015 (HDPE) &middot; SNI 07-0242.1-2000 (GIP) &middot; EPANET 2.2 Manual Table 3.2</div>
          ` : ""}

          ${reportText ? `<h2>Laporan Lengkap (Markdown)</h2><pre>${escapeHtml(reportText)}</pre>` : ""}
        </body>
      </html>
    `;

    // UTF-8 BOM so Excel opens with correct encoding.
    const out = Buffer.from(`﻿${html}`, "utf8");
    const headers = new Headers();
    headers.set("content-type", "application/vnd.ms-excel; charset=utf-8");
    headers.set("content-disposition", `attachment; filename="${fileStem}_analysis.xls"`);
    return new Response(out, { status: 200, headers });
  } catch (e) {
    if (charged) await refundTokens(db, userId, tokenCost);
    console.error("Export failed", { analysisId, format, variantResolved, error: e });
    return NextResponse.json({ error: "System error" }, { status: 500 });
  }
}
