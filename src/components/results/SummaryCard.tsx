"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisKind, AnalysisResult } from "@/types";

export function SummaryCard({
  summary,
  kind,
  engineUsed,
  convergenceStatus
}: {
  summary: AnalysisResult["summary"];
  kind: AnalysisKind;
  engineUsed?: string;
  convergenceStatus?: string;
}) {
  const kindMeta: Record<AnalysisKind, { label: string; className: string }> = {
    diameter: { label: "Analisis Diameter", className: "bg-blue-600 text-white" },
    pressure: { label: "Analisis Pressure", className: "bg-green-600 text-white" },
    add_prv: { label: "Add PRV Otomatis", className: "bg-purple-600 text-white" }
  };

  const convMeta: Record<string, { label: string; className: string }> = {
    CONVERGED: { label: "Konvergen", className: "bg-green-600 text-white" },
    STUCK: { label: "Stuck", className: "bg-yellow-500 text-white" },
    STAGNANT: { label: "Stagnant", className: "bg-orange-600 text-white" }
  };

  const engine = engineUsed?.toLowerCase();
  const durationSeconds = (summary as any).durationSeconds ?? summary.duration ?? undefined;
  const remainingIssues =
    summary.remainingIssues ?? Math.max(0, summary.issuesFound - summary.issuesFixed);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Ringkasan</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={kindMeta[kind].className}>{kindMeta[kind].label}</Badge>
            {convergenceStatus && convMeta[convergenceStatus] ? (
              <Badge className={convMeta[convergenceStatus].className}>
                {convMeta[convergenceStatus].label}
              </Badge>
            ) : null}
          </div>
        </div>

        {engineUsed ? (
          <Badge variant="outline" className="whitespace-nowrap">
            Engine: {engineUsed}
          </Badge>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {engine === "wntr" ? (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
            ⚠ Menggunakan WNTR sebagai engine simulasi. Hasil mungkin sedikit berbeda dari EPANET.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Issues ditemukan" value={summary.issuesFound} />
          <Stat label="Issues diperbaiki" value={summary.issuesFixed} />
          <Stat label="Sisa issues" value={remainingIssues} warn={remainingIssues > 0} />
          <Stat
            label="Durasi"
            value={durationSeconds !== undefined ? durationSeconds : "—"}
            suffix={durationSeconds !== undefined ? "detik" : undefined}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  suffix,
  warn
}: {
  label: string;
  value: number | string;
  suffix?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-whisper ${
        warn ? "border-orange-200 bg-orange-50" : "border-border-lavender bg-white"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-gray">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold tracking-[-0.04em] ${warn ? "text-orange-700" : "text-expo-black"}`}>
        {value}
      </div>
      {suffix ? <div className="mt-0.5 text-[11px] text-silver">{suffix}</div> : null}
    </div>
  );
}
