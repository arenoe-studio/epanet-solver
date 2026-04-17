"use client";

import { Button } from "@/components/ui/button";
import { ANALYSIS_TOKEN_COST, FIX_PRESSURE_TOKEN_COST } from "@/lib/token-constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { AnalysisResult } from "@/types";

type ResultsPanelProps = {
  result: AnalysisResult;
  onAnalyzeAnother: () => void;
  onFixPressure: () => void;
  isFixingPressure: boolean;
};

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

export function ResultsPanel({
  result,
  onAnalyzeAnother,
  onFixPressure,
  isFixingPressure
}: ResultsPanelProps) {
  const filesV1 = result.filesV1 ?? result.files;
  const filesFinal = result.filesFinal ?? null;
  const prvNeeded = result.prv?.needed ?? false;
  const prvRecs = result.prv?.recommendations ?? [];
  const fixCost = result.prv?.tokenCost ?? FIX_PRESSURE_TOKEN_COST;

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
          Analisis selesai
        </div>
        <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-expo-black">
          Hasil Analisis
        </h2>
        <p className="mt-1 text-sm text-slate-gray">
          File:{" "}
          <span className="font-mono text-near-black">{result.fileName}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {[
          { label: "Simpul", value: result.summary.nodes },
          { label: "Pipa", value: result.summary.pipes },
          { label: "Masalah Ditemukan", value: result.summary.issuesFound },
          { label: "Masalah Diperbaiki", value: result.summary.issuesFixed }
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl border border-border-lavender bg-white p-4 shadow-whisper"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-gray">
              {label}
            </div>
            <div className="mt-2 text-3xl font-bold tracking-[-0.04em] text-expo-black">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border-lavender bg-white p-5 shadow-whisper">
        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-gray">
              Iterasi
            </div>
            <div className="mt-1 font-semibold text-expo-black">
              {result.summary.iterations}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-gray">
              Durasi
            </div>
            <div className="mt-1 font-semibold text-expo-black">
              {result.summary.duration}s
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-gray">
              Masalah Tersisa
            </div>
            <div className="mt-1 font-semibold text-expo-black">
              {result.summary.remainingIssues}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border-lavender bg-white p-5 shadow-whisper">
        <div className="text-sm font-semibold tracking-[-0.01em] text-expo-black">
          Unduh Hasil
        </div>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Button
            onClick={() => downloadBase64File(filesV1.inp, "optimized_network_v1.inp")}
            variant="outline"
          >
            Unduh File .inp (v1)
          </Button>
          <Button
            onClick={() => downloadBase64File(filesV1.md, "analysis_report_v1.md")}
            variant="outline"
          >
            Unduh Laporan .md (v1)
          </Button>
          {filesFinal ? (
            <>
              <Button
                onClick={() =>
                  downloadBase64File(filesFinal.inp, "optimized_network_final.inp")
                }
                variant="outline"
              >
                Unduh File .inp (final)
              </Button>
              <Button
                onClick={() =>
                  downloadBase64File(filesFinal.md, "analysis_report_final.md")
                }
                variant="outline"
              >
                Unduh Laporan .md (final)
              </Button>
            </>
          ) : null}
        </div>
        <div className="mt-3 text-xs text-silver">
          Token terpakai (analisis): {ANALYSIS_TOKEN_COST}
          {filesFinal ? ` • Fix Pressure: ${fixCost}` : ""}
        </div>
      </div>

      {prvNeeded && !filesFinal ? (
        <div className="rounded-2xl border border-border-lavender bg-white p-5 shadow-whisper space-y-4">
          <div>
            <div className="text-sm font-semibold tracking-[-0.01em] text-expo-black">
              Rekomendasi PRV (Pressure Reducing Valve)
            </div>
            <p className="mt-1 text-xs text-slate-gray">
              Tekanan tinggi tidak diselesaikan dengan diameter. Gunakan Fix Pressure untuk
              menyisipkan PRV otomatis.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-border-lavender">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pipe</TableHead>
                  <TableHead>Setting (m)</TableHead>
                  <TableHead>Covered Nodes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prvRecs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>Tidak ada data.</TableCell>
                  </TableRow>
                ) : (
                  prvRecs.map((r) => (
                    <TableRow key={r.pipeId}>
                      <TableCell className="font-medium text-expo-black">
                        {r.pipeId}
                      </TableCell>
                      <TableCell>{Math.round(r.settingHeadM)}</TableCell>
                      <TableCell>{r.coveredNodes.join(", ")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button onClick={onFixPressure} disabled={isFixingPressure}>
              {isFixingPressure
                ? "Memproses Fix Pressure…"
                : `FIX PRESSURE (${fixCost} token)`}
            </Button>
          </div>
        </div>
      ) : null}

      <div>
        <Button onClick={onAnalyzeAnother}>Analisis File Baru</Button>
      </div>
    </section>
  );
}
