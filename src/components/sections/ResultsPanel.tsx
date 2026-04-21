"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ANALYSIS_TOKEN_COST,
  DOWNLOAD_EXCEL_TOKEN_COST,
  DOWNLOAD_INP_TOKEN_COST,
  DOWNLOAD_PDF_TOKEN_COST,
  FIX_PRESSURE_TOKEN_COST
} from "@/lib/token-constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { openBuyTokenModal } from "@/lib/ui-events";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisResult } from "@/types";

type ResultsPanelProps = {
  result: AnalysisResult;
  onBackToUpload?: () => void;
  onAnalyzeAnother: () => void;
  onFixPressure: () => void;
  isFixingPressure: boolean;
  tokenBalance?: number | null;
};

function fx(v: unknown, d = 2): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—";
}

function downloadBase64File(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadUrlFile(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.click();
}

function parseFilenameFromContentDisposition(headerValue: string | null) {
  if (!headerValue) return null;
  const m = /filename\\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i.exec(headerValue);
  const raw = decodeURIComponent((m?.[1] ?? m?.[2] ?? "").trim());
  return raw || null;
}

function StatusDot({ color }: { color: string }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden />;
}

function PillButton({
  active,
  disabled,
  onClick,
  children
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition ${
        disabled
          ? "cursor-not-allowed border-border-lavender bg-cloud-gray/60 text-silver"
          : active
            ? "border-expo-black bg-expo-black text-white"
            : "border-border-lavender bg-white text-slate-gray hover:bg-cloud-gray"
      }`}
    >
      {children}
    </button>
  );
}

export function ResultsPanel({
  result,
  onBackToUpload,
  onAnalyzeAnother,
  onFixPressure,
  isFixingPressure,
  tokenBalance
}: ResultsPanelProps) {
  type ResultsCondition = "awal" | "diameter" | "tekanan";
  type ResultsTab = "nodes" | "links" | "materials";

  const [materialAccordionOpen, setMaterialAccordionOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const filesV1 = result.filesV1 ?? result.files;
  const filesFinal = result.filesFinal ?? null;
  const prvNeeded = result.prv?.needed ?? false;
  const prvRecs = result.prv?.recommendations ?? [];
  const postFix = result.prv?.postFix;
  const fixCost = result.prv?.tokenCost ?? FIX_PRESSURE_TOKEN_COST;
  const exportDisabled = exportBusy !== null;
  const pressureOptimizationAvailable = Boolean(
    (result.summary as any)?.pressureOptimizationAvailable ?? filesFinal
  );

  const defaultCondition: ResultsCondition = (() => {
    const action = (result.summary as any)?.action;
    if (pressureOptimizationAvailable && action === "fix_pressure") return "tekanan";
    return "diameter";
  })();

  const [condition, setCondition] = useState<ResultsCondition>(defaultCondition);
  const [activeTab, setActiveTab] = useState<ResultsTab>("nodes");

  function costBadge(tokenCost: number) {
    if (tokenCost <= 0) return <Badge className="bg-green-600 text-white">Gratis</Badge>;
    return (
      <Badge variant="outline" className="whitespace-nowrap">
        {tokenCost} token
      </Badge>
    );
  }

  function DownloadAction({
    title,
    subtitle,
    tokenCost,
    onClick
  }: {
    title: string;
    subtitle: string;
    tokenCost: number;
    onClick: () => void;
  }) {
    return (
      <div className="space-y-1.5">
        <Button
          onClick={onClick}
          variant="outline"
          size="sm"
          disabled={exportDisabled}
          className="w-full justify-between gap-2"
        >
          <span className="text-left">{title}</span>
          {costBadge(tokenCost)}
        </Button>
        <p className="px-1 text-[11px] leading-snug text-slate-gray">{subtitle}</p>
      </div>
    );
  }

  async function downloadExport(
    format: "inp" | "pdf" | "excel",
    variant?: "v1" | "final"
  ) {
    const key = `${format}:${variant ?? "auto"}`;
    setExportBusy(key);
    setExportError(null);

    try {
      const qs = new URLSearchParams({ format });
      if (variant) qs.set("variant", variant);

      const res = await fetch(`/api/analyses/${result.analysisId}/export?${qs.toString()}`, {
        method: "POST"
      });

      if (!res.ok) {
        let msg = "Gagal mengunduh file.";
        try {
          const json = await res.json();
          msg = json?.error ?? msg;
        } catch {
          // ignore
        }

        if (res.status === 402) {
          openBuyTokenModal();
        }

        setExportError(msg);
        return;
      }

      const filename =
        parseFilenameFromContentDisposition(res.headers.get("content-disposition")) ??
        `epanet-export.${format === "excel" ? "xls" : format}`;

      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = filename;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
    } catch {
      setExportError("System error saat mengunduh file.");
    } finally {
      setExportBusy(null);
    }
  }

  const nodes = result.nodes ?? [];
  const pipes = result.pipes ?? [];
  const materials = result.materials ?? [];
  const networkInfo = result.networkInfo;
  const remainingIssues = result.summary.remainingIssues ?? 0;
  const remainingPressureIssues =
    (postFix?.remainingHighNodes.length ?? 0)
    + (postFix?.remainingLowNodes.length ?? 0)
    + (postFix?.remainingNegativeNodes.length ?? 0);
  const remainingPipeIssues = pipes.filter((p) => p.code !== "OK").length;
  const isPressureResolved = postFix?.status === "resolved";

  const vStatus = useMemo(
    () => (pipes.some((p) => p.code === "V-HIGH" || p.code === "HL-SMALL") ? "warn" : "ok"),
    [pipes]
  );
  const hlStatus = useMemo(
    () => (pipes.some((p) => p.code === "HL-HIGH" || p.code === "HL-SMALL") ? "warn" : "ok"),
    [pipes]
  );
  const pStatus = useMemo(
    () => (nodes.some((n) => n.code !== "P-OK") ? "warn" : "ok"),
    [nodes]
  );

  const hasPHighNodes = nodes.some((n) => n.code === "P-HIGH");

  const overallBadge = filesFinal
    ? isPressureResolved
      ? remainingPipeIssues > 0
        ? { text: "Fix pressure selesai", color: "green" as const }
        : { text: "Analisis lengkap", color: "green" as const }
      : { text: "Fix pressure belum tuntas", color: "yellow" as const }
    : prvNeeded
      ? { text: "Analisis selesai — tekanan perlu ditangani", color: "yellow" as const }
      : { text: "Analisis selesai", color: "green" as const };

  const badgeClass =
    overallBadge.color === "green"
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-yellow-200 bg-yellow-50 text-yellow-700";

  const dotClass =
    overallBadge.color === "green" ? "bg-green-500" : "bg-yellow-500";

  const prvFixedNodes = useMemo(() => {
    if (!filesFinal || !prvNeeded) return [];
    const coveredNodeIds = new Set(prvRecs.flatMap((r) => r.coveredNodes));
    return nodes.filter((n) => coveredNodeIds.has(n.id));
  }, [filesFinal, prvNeeded, prvRecs, nodes]);

  function nodePressureM(n: (typeof nodes)[number]): number | null {
    if (condition === "awal") return (n as any).pressureAwalM ?? n.pressureBefore ?? null;
    if (condition === "diameter") return (n as any).pressureDiameterM ?? n.pressureAfter ?? null;
    if (condition === "tekanan") return (n as any).pressureTekananM ?? n.pressureAfter ?? null;
    return null;
  }

  function nodeHeadM(n: (typeof nodes)[number]): number | null {
    if (condition === "awal") return (n as any).headAwalM ?? null;
    if (condition === "diameter") return (n as any).headDiameterM ?? null;
    if (condition === "tekanan") return (n as any).headTekananM ?? null;
    return null;
  }

  function pipeDiameterMm(p: (typeof pipes)[number]): number | null {
    if (condition === "awal") return (p as any).diameterAwalMm ?? p.diameterBefore ?? null;
    if (condition === "diameter") return (p as any).diameterDiameterMm ?? p.diameterAfter ?? null;
    if (condition === "tekanan") return (p as any).diameterTekananMm ?? p.diameterAfter ?? null;
    return null;
  }

  function pipeFlowLps(p: (typeof pipes)[number]): number | null {
    if (condition === "awal") return (p as any).flowAwalLps ?? null;
    if (condition === "diameter") return (p as any).flowDiameterLps ?? null;
    if (condition === "tekanan") return (p as any).flowTekananLps ?? null;
    return null;
  }

  function pipeVelocityMps(p: (typeof pipes)[number]): number | null {
    if (condition === "awal") return (p as any).velocityAwalMps ?? p.velocityBefore ?? null;
    if (condition === "diameter") return (p as any).velocityDiameterMps ?? p.velocityAfter ?? null;
    if (condition === "tekanan") return (p as any).velocityTekananMps ?? p.velocityAfter ?? null;
    return null;
  }

  function pipeUnitHeadlossMkm(p: (typeof pipes)[number]): number | null {
    if (condition === "awal") return (p as any).unitHeadlossAwalMkm ?? p.headlossBefore ?? null;
    if (condition === "diameter") return (p as any).unitHeadlossDiameterMkm ?? p.headlossAfter ?? null;
    if (condition === "tekanan") return (p as any).unitHeadlossTekananMkm ?? p.headlossAfter ?? null;
    return null;
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">

      {/* BLOK 1 — STATUS HEADER */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${badgeClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
            {overallBadge.text}
          </div>
          {onBackToUpload ? (
            <Button variant="ghost" size="sm" onClick={onBackToUpload}>
              Kembali
            </Button>
          ) : null}
        </div>

        <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-expo-black">
          Hasil Analisis
        </h2>
        <p className="mt-1 text-sm text-slate-gray">
          File:{" "}
          <span className="font-mono text-near-black">{result.fileName}</span>
        </p>

        {/* V / HL / P indicator chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
              vStatus === "ok"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-yellow-200 bg-yellow-50 text-yellow-700"
            }`}
          >
            <StatusDot color={vStatus === "ok" ? "bg-green-500" : "bg-yellow-400"} />
            V Kecepatan {vStatus === "ok" ? "OK" : "Ada Masalah"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
              hlStatus === "ok"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-yellow-200 bg-yellow-50 text-yellow-700"
            }`}
          >
            <StatusDot color={hlStatus === "ok" ? "bg-green-500" : "bg-yellow-400"} />
            HL Headloss {hlStatus === "ok" ? "OK" : "Ada Masalah"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
              pStatus === "ok"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-orange-200 bg-orange-50 text-orange-700"
            }`}
          >
            <StatusDot color={pStatus === "ok" ? "bg-green-500" : "bg-orange-400"} />
            P Tekanan {pStatus === "ok" ? "OK" : hasPHighNodes ? "Ada P-HIGH" : "Ada Masalah"}
          </span>
        </div>
      </div>

      {/* BLOK 2 — RINGKASAN JARINGAN & HASIL */}
      <div className="space-y-3">
        {/* Row 1 — Network info (neutral) */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {[
            { label: "Simpul", value: result.summary.nodes, unit: "node" },
            { label: "Pipa", value: result.summary.pipes, unit: "pipa" },
            {
              label: "Total Demand",
              value: networkInfo ? fx(networkInfo.totalDemandLps, 2) : "—",
              unit: "LPS"
            },
            {
              label: "Head Reservoir",
              value: networkInfo ? fx(networkInfo.headReservoirM, 1) : "—",
              unit: "m"
            }
          ].map(({ label, value, unit }) => (
            <div
              key={label}
              className="rounded-2xl border border-border-lavender bg-white p-4 shadow-whisper"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-gray">
                {label}
              </div>
              <div className="mt-2 text-2xl font-bold tracking-[-0.04em] text-expo-black">
                {value}
              </div>
              <div className="mt-0.5 text-[11px] text-silver">{unit}</div>
            </div>
          ))}
        </div>

        {/* Row 2 — Analysis results */}
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-5">
          {[
            { label: "Iterasi", value: result.summary.iterations, unit: "putaran" },
            {
              label: "Durasi",
              value: result.summary.duration !== undefined ? `${result.summary.duration}s` : "—",
              unit: "detik"
            },
            { label: "Masalah Ditemukan", value: result.summary.issuesFound, unit: "awal" },
            { label: "Berhasil Diperbaiki", value: result.summary.issuesFixed, unit: "selesai" },
            {
              label: "Masalah Tersisa",
              value: result.summary.remainingIssues ?? "—",
              unit: "tersisa",
              warn: remainingIssues > 0
            }
          ].map(({ label, value, unit, warn }) => (
            <div
              key={label}
              className={`rounded-2xl border p-4 shadow-whisper ${
                warn
                  ? "border-orange-200 bg-orange-50"
                  : "border-border-lavender bg-white"
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-gray">
                {label}
              </div>
              <div
                className={`mt-2 text-2xl font-bold tracking-[-0.04em] ${
                  warn ? "text-orange-700" : "text-expo-black"
                }`}
              >
                {value}
              </div>
              <div className="mt-0.5 text-[11px] text-silver">{unit}</div>
            </div>
          ))}
        </div>

        {remainingIssues > 0 && (
          <p className="text-xs leading-relaxed text-slate-gray">
            <em>
              {filesFinal
                ? isPressureResolved
                  ? `Fix pressure sudah selesai. Sisa ${remainingIssues} masalah berasal dari evaluasi pipa, bukan tekanan node.`
                  : `Masih ada ${remainingPressureIssues} masalah tekanan yang belum selesai setelah fix pressure. Lihat rekomendasi tindak lanjut di panel PRV.`
                : "Masalah tersisa adalah node dengan tekanan tinggi (P-HIGH). Ini bukan kegagalan optimasi — tekanan tinggi disebabkan perbedaan elevasi dan tidak bisa diselesaikan dengan mengubah diameter. Lihat rekomendasi PRV di bawah."}
            </em>
          </p>
        )}
      </div>

      {/* BLOK 3 — DETAIL (KONDISI + TABS) */}
      {(nodes.length > 0 || pipes.length > 0 || materials.length > 0) && (
        <div className="rounded-2xl border border-border-lavender bg-white shadow-whisper">
          <div className="border-b border-border-lavender px-5 py-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold tracking-[-0.01em] text-expo-black">
                  Detail Hasil
                </div>
                <p className="mt-0.5 text-xs text-slate-gray">
                  Pilih kondisi dan tab untuk melihat tabel.
                </p>
              </div>
              {!pressureOptimizationAvailable && (
                <div className="whitespace-nowrap text-xs text-slate-gray">
                  Jalankan Fix Pressure untuk melihat kondisi ini.
                </div>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap">
              <PillButton active={condition === "awal"} onClick={() => setCondition("awal")}>
                Kondisi Awal
              </PillButton>
              <PillButton
                active={condition === "diameter"}
                onClick={() => setCondition("diameter")}
              >
                Optimasi Diameter
              </PillButton>
              <PillButton
                active={condition === "tekanan"}
                disabled={!pressureOptimizationAvailable}
                onClick={() => setCondition("tekanan")}
              >
                Optimasi Tekanan
              </PillButton>
            </div>

            <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap">
              <PillButton active={activeTab === "nodes"} onClick={() => setActiveTab("nodes")}>
                Node
              </PillButton>
              <PillButton active={activeTab === "links"} onClick={() => setActiveTab("links")}>
                Links
              </PillButton>
              <PillButton
                active={activeTab === "materials"}
                onClick={() => setActiveTab("materials")}
              >
                Materials
              </PillButton>
            </div>
          </div>

          {activeTab === "nodes" ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Node</TableHead>
                    <TableHead>Elevation</TableHead>
                    <TableHead>Base Demand</TableHead>
                    <TableHead>Head</TableHead>
                    <TableHead>Pressure</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-gray">
                        Tidak ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    nodes.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="whitespace-nowrap font-medium text-expo-black">
                          {n.id}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{fx(n.elevation, 2)} m</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {fx((n as any).baseDemandLps, 2)} L/s
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{fx(nodeHeadM(n), 2)} m</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {fx(nodePressureM(n), 2)} m
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : activeTab === "links" ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Links</TableHead>
                    <TableHead>Length</TableHead>
                    <TableHead>Diameter</TableHead>
                    <TableHead>Roughness</TableHead>
                    <TableHead>Flow</TableHead>
                    <TableHead>Velocity</TableHead>
                    <TableHead>Unit Headloss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-gray">
                        Tidak ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pipes.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap font-medium text-expo-black">
                          {p.id}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{fx(p.length, 1)} m</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {fx(pipeDiameterMm(p), 1)} mm
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{fx((p as any).roughnessC, 0)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {fx(pipeFlowLps(p), 3)} L/s
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {fx(pipeVelocityMps(p), 3)} m/s
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {fx(pipeUnitHeadlossMkm(p), 2)} m/km
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div>
              {materials.length === 0 ? (
                <div className="px-5 py-6 text-sm text-slate-gray">Tidak ada data.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pipa</TableHead>
                          <TableHead>D Rekomendasi</TableHead>
                          <TableHead>Material</TableHead>
                          <TableHead>Nilai C</TableHead>
                          <TableHead>Tekanan Kerja</TableHead>
                          <TableHead>Catatan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materials.map((m) => (
                          <TableRow key={m.pipeId}>
                            <TableCell className="whitespace-nowrap font-medium text-expo-black">
                              {m.pipeId}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {fx(m.diameterMm, 1)} mm
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{m.material}</TableCell>
                            <TableCell className="whitespace-nowrap">{m.C}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {fx(m.pressureWorkingM, 2)} m
                            </TableCell>
                            <TableCell className="min-w-[180px]">
                              {m.notes.length > 0 ? (
                                <span className="text-xs leading-snug text-orange-700">
                                  {m.notes[0]}
                                </span>
                              ) : (
                                <span className="text-silver">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Accordion */}
                  <div className="border-t border-border-lavender">
                    <button
                      type="button"
                      onClick={() => setMaterialAccordionOpen((v) => !v)}
                      className="flex w-full items-center justify-between px-5 py-3 text-sm font-semibold text-near-black hover:bg-cloud-gray transition"
                    >
                      <span>Dasar Pemilihan Material</span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`text-slate-gray transition-transform duration-200 ${materialAccordionOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {materialAccordionOpen && (
                      <div className="border-t border-border-lavender bg-cloud-gray/60 px-5 py-4 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-gray">
                          Matriks Keputusan
                        </p>
                        <div className="space-y-1.5 text-sm text-near-black">
                          <div className="flex gap-3">
                            <span className="w-56 shrink-0 text-slate-gray">
                              Tekanan ≤ 100m, D ≤ 110mm
                            </span>
                            <span className="font-medium">
                              PVC AW PN-10{" "}
                              <span className="text-slate-gray font-normal">(C=140)</span>
                            </span>
                          </div>
                          <div className="flex gap-3">
                            <span className="w-56 shrink-0 text-slate-gray">
                              Tekanan ≤ 100m, D &gt; 110mm
                            </span>
                            <span className="font-medium">
                              HDPE PE100 PN-10{" "}
                              <span className="text-slate-gray font-normal">(C=140)</span>
                            </span>
                          </div>
                          <div className="flex gap-3">
                            <span className="w-56 shrink-0 text-slate-gray">Tekanan 100–160m</span>
                            <span className="font-medium">
                              HDPE PE100 PN-16{" "}
                              <span className="text-slate-gray font-normal">(C=140)</span>
                            </span>
                          </div>
                          <div className="flex gap-3">
                            <span className="w-56 shrink-0 text-slate-gray">Tekanan &gt; 160m</span>
                            <span className="font-medium">
                              GIP Heavy / Steel{" "}
                              <span className="text-slate-gray font-normal">(C=120)</span>
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-gray">
                          Referensi: SNI 06-2550-1991 (PVC) · SNI 4829.2:2015 (HDPE) · SNI
                          07-0242.1-2000 (GIP) · EPANET 2.2 Manual Table 3.2
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* BLOK 6 — PANEL PRV (conditional) */}
      {prvNeeded && (
        <div className="rounded-2xl border border-orange-200 bg-white shadow-whisper">
          {/* Sub-blok D — After Fix Pressure */}
          {filesFinal ? (
            <div className="space-y-4 p-5">
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  isPressureResolved
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-yellow-200 bg-yellow-50 text-yellow-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isPressureResolved ? "bg-green-500" : "bg-yellow-500"
                  }`}
                  aria-hidden
                />
                {isPressureResolved ? "Fix Pressure selesai" : "Butuh tindak lanjut"}
              </div>
              <p className="text-sm text-slate-gray">
                {prvRecs.length} PRV berhasil disisipkan.{" "}
                {prvFixedNodes.filter((n) => n.code === "P-OK").length} node tekanan sudah OK.
              </p>
              {isPressureResolved && remainingPipeIssues > 0 && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs leading-relaxed text-green-900">
                  Tekanan node sudah selesai diperbaiki. Sisa masalah berasal dari evaluasi pipa
                  seperti V-LOW atau HL-HIGH, jadi ini bukan kegagalan fix pressure.
                </div>
              )}
              {postFix && postFix.status !== "resolved" && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                  <div className="text-sm font-semibold text-yellow-900">
                    Masih ada tekanan yang perlu tindakan lanjutan
                  </div>
                  <div className="mt-2 space-y-1 text-xs leading-relaxed text-yellow-900">
                    <p>
                      Sisa P-HIGH: {postFix.remainingHighNodes.length} · P-LOW:{" "}
                      {postFix.remainingLowNodes.length} · P-NEG:{" "}
                      {postFix.remainingNegativeNodes.length}
                    </p>
                    {postFix.recommendations.map((item, index) => (
                      <p key={`${index}-${item}`}>• {item}</p>
                    ))}
                  </div>
                </div>
              )}
              {prvFixedNodes.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-border-lavender">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Node</TableHead>
                        <TableHead>Tekanan Akhir</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prvFixedNodes.map((n) => (
                        <TableRow key={n.id}>
                          <TableCell className="font-medium text-expo-black">{n.id}</TableCell>
                          <TableCell>{fx(n.pressureAfter, 2)} m</TableCell>
                          <TableCell>
                            <span className="text-xs font-semibold text-slate-gray">{n.code}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {materials.some((m) => m.notes.some((note) => note.includes("Evaluasi ulang"))) && (
                <p className="text-xs italic text-orange-700">
                  Beberapa pipa di zona PRV perlu evaluasi ulang material setelah tekanan berubah.
                </p>
              )}
              {postFix?.recommendedActions?.some((action) => (action.nodes?.length ?? 0) > 0) && (
                <div className="space-y-2 text-xs text-slate-gray">
                  {postFix.recommendedActions.map((action, index) => (
                    <p key={`${action.type}-${index}`}>
                      <span className="font-medium text-near-black">{action.message}</span>
                      {action.nodes && action.nodes.length > 0 ? ` Node: ${action.nodes.join(", ")}.` : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Sub-blok A + B + C — Before Fix Pressure */
            <div className="space-y-5 p-5">
              {/* Sub-blok A */}
              <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                <div className="text-sm font-semibold text-orange-900">
                  Mengapa tekanan tinggi tidak cukup diatasi dengan diameter?
                </div>
                <p className="mt-2 text-xs leading-relaxed text-orange-800">
                  Tekanan tinggi terjadi karena perbedaan elevasi yang besar antara reservoir dan
                  node. Ini adalah energi potensial yang tersimpan dalam air — bukan hambatan aliran
                  yang bisa dikurangi dengan mengubah diameter.
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-orange-800">
                  Memperbesar diameter justru meningkatkan tekanan di hilir karena headloss
                  berkurang. Memperkecil diameter akan menurunkan tekanan, tetapi juga melanggar
                  batas kecepatan dan headloss.
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-orange-800">
                  Solusi yang tepat adalah{" "}
                  <strong>Pressure Reducing Valve (PRV)</strong> — yang secara mekanis mereduksi
                  tekanan tanpa mengganggu debit aliran.
                </p>
              </div>

              {/* Sub-blok B */}
              {prvRecs.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-slate-gray">
                    Rekomendasi Penempatan PRV
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border-lavender">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No</TableHead>
                          <TableHead>Pipa</TableHead>
                          <TableHead>Setting PRV</TableHead>
                          <TableHead>Node Tercakup</TableHead>
                          <TableHead>Estimasi Tekanan Setelah</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {prvRecs.map((r, i) => (
                          <TableRow key={r.pipeId}>
                            <TableCell className="text-slate-gray">{i + 1}</TableCell>
                            <TableCell className="font-medium text-expo-black">
                              {r.pipeId}
                            </TableCell>
                            <TableCell>{Math.round(r.settingHeadM)} m</TableCell>
                            <TableCell>{r.coveredNodes.join(", ")}</TableCell>
                            <TableCell>
                              <span className="text-xs leading-relaxed">
                                {Object.entries(r.estimatedPressuresM)
                                  .map(([nid, p]) => `${nid}=${Math.round(p)}m`)
                                  .join("  ")}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-2 text-xs italic text-slate-gray">
                    Estimasi berdasarkan kalkulasi statis. Nilai aktual setelah simulasi mungkin
                    sedikit berbeda. Gunakan Fix Pressure untuk hasil presisi.
                  </p>
                </div>
              )}

              {/* Sub-blok C */}
              <div className="space-y-3">
                <div>
                  <Button onClick={onFixPressure} disabled={isFixingPressure}>
                    {isFixingPressure
                      ? "Memproses Fix Pressure…"
                      : `Fix Pressure Otomatis — ${fixCost} Token`}
                  </Button>
                  <p className="mt-1.5 text-xs text-slate-gray">
                    PRV disisipkan ke file .inp dan simulasi dijalankan ulang. Hasil final siap
                    diunduh.
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-gray">
                    Atau{" "}
                    <span className="font-medium text-near-black">
                      pasang PRV manual di EPANET
                    </span>{" "}
                    — panduan langkah demi langkah tersedia di file laporan .pdf.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BLOK 7 — DOWNLOAD */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-base">Unduh Hasil</CardTitle>
            <p className="mt-1 text-xs text-slate-gray">
              Nama file mengikuti nama asli + tanggal analisis + kode analisis + versi (pre/post PRV).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              PDF: {DOWNLOAD_PDF_TOKEN_COST > 0 ? `${DOWNLOAD_PDF_TOKEN_COST} token` : "Gratis"}
            </Badge>
            <Badge variant="outline">INP: {DOWNLOAD_INP_TOKEN_COST} token</Badge>
            <Badge variant="outline">Excel: {DOWNLOAD_EXCEL_TOKEN_COST} token</Badge>
          </div>
        </CardHeader>

        {filesFinal ? (
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border-lavender bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-expo-black">Versi v1</div>
                    <div className="text-xs text-slate-gray">Optimasi diameter (tanpa PRV)</div>
                  </div>
                  <Badge variant="outline">Pre-PRV</Badge>
                </div>
                <div className="space-y-3">
                  <DownloadAction
                    title="File jaringan (.inp)"
                    subtitle="Buka di EPANET untuk melihat model jaringan."
                    tokenCost={DOWNLOAD_INP_TOKEN_COST}
                    onClick={() => downloadExport("inp", "v1")}
                  />
                  <DownloadAction
                    title="Laporan ringkas (.pdf)"
                    subtitle="Ringkasan hasil + poin penting."
                    tokenCost={DOWNLOAD_PDF_TOKEN_COST}
                    onClick={() => downloadExport("pdf", "v1")}
                  />
                  <DownloadAction
                    title="Tabel hasil (Excel)"
                    subtitle="Summary + Nodes + Pipes + Materials."
                    tokenCost={DOWNLOAD_EXCEL_TOKEN_COST}
                    onClick={() => downloadExport("excel", "v1")}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border-lavender bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-expo-black">Versi final</div>
                    <div className="text-xs text-slate-gray">Diameter dioptimasi + PRV disisipkan</div>
                  </div>
                  <Badge>Post-PRV</Badge>
                </div>
                <div className="space-y-3">
                  <DownloadAction
                    title="File jaringan (.inp)"
                    subtitle="Sudah termasuk PRV hasil Fix Pressure."
                    tokenCost={DOWNLOAD_INP_TOKEN_COST}
                    onClick={() => downloadExport("inp", "final")}
                  />
                  <DownloadAction
                    title="Laporan ringkas (.pdf)"
                    subtitle="Ringkasan hasil versi final."
                    tokenCost={DOWNLOAD_PDF_TOKEN_COST}
                    onClick={() => downloadExport("pdf", "final")}
                  />
                  <DownloadAction
                    title="Tabel hasil (Excel)"
                    subtitle="Tabel hasil versi final."
                    tokenCost={DOWNLOAD_EXCEL_TOKEN_COST}
                    onClick={() => downloadExport("excel", "final")}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        ) : prvNeeded ? (
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border-lavender bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-expo-black">Versi v1 tersedia</div>
                  <div className="text-xs text-slate-gray">
                    PRV belum disisipkan. Jalankan Fix Pressure untuk versi final.
                  </div>
                </div>
                <Badge variant="outline">Final terkunci</Badge>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <DownloadAction
                  title="File jaringan (.inp)"
                  subtitle="Buka di EPANET."
                  tokenCost={DOWNLOAD_INP_TOKEN_COST}
                  onClick={() => downloadExport("inp", "v1")}
                />
                <DownloadAction
                  title="Laporan ringkas (.pdf)"
                  subtitle="Ringkasan hasil + poin penting."
                  tokenCost={DOWNLOAD_PDF_TOKEN_COST}
                  onClick={() => downloadExport("pdf", "v1")}
                />
                <DownloadAction
                  title="Tabel hasil (Excel)"
                  subtitle="Ringkasan + tabel hasil."
                  tokenCost={DOWNLOAD_EXCEL_TOKEN_COST}
                  onClick={() => downloadExport("excel", "v1")}
                />
              </div>
            </div>
          </CardContent>
        ) : (
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border-lavender bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-expo-black">Hasil siap diunduh</div>
                  <div className="text-xs text-slate-gray">Semua kriteria terpenuhi.</div>
                </div>
                <Badge className="bg-green-600 text-white">OK</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <DownloadAction
                  title="File jaringan (.inp)"
                  subtitle="Buka di EPANET."
                  tokenCost={DOWNLOAD_INP_TOKEN_COST}
                  onClick={() => downloadExport("inp", "v1")}
                />
                <DownloadAction
                  title="Laporan ringkas (.pdf)"
                  subtitle="Ringkasan hasil + poin penting."
                  tokenCost={DOWNLOAD_PDF_TOKEN_COST}
                  onClick={() => downloadExport("pdf", "v1")}
                />
                <DownloadAction
                  title="Tabel hasil (Excel)"
                  subtitle="Ringkasan + tabel hasil."
                  tokenCost={DOWNLOAD_EXCEL_TOKEN_COST}
                  onClick={() => downloadExport("excel", "v1")}
                />
              </div>
            </div>
          </CardContent>
        )}

        {(exportBusy || exportError) && (
          <CardContent className="pt-0">
            <div className="rounded-xl border border-border-lavender bg-soft-lilac px-3 py-2 text-xs text-expo-black">
              {exportBusy ? "Menyiapkan file untuk diunduh…" : exportError}
            </div>
          </CardContent>
        )}

        <CardContent className="pt-0">
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-border-lavender pt-4">
            <div className="text-xs text-silver">
              Token terpakai: Analisis = {ANALYSIS_TOKEN_COST} token
              {filesFinal ? ` · Fix Pressure = ${fixCost} token` : ""}
              {tokenBalance !== null && tokenBalance !== undefined
                ? ` · Sisa saldo: ${tokenBalance} token`
                : ""}
            </div>
            <Button onClick={onAnalyzeAnother} variant="outline" size="sm" disabled={exportDisabled}>
              Analisis File Baru
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
