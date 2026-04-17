"use client";

import { Button } from "@/components/ui/button";
import type { InpPreviewCounts } from "@/hooks/useFilePreview";
import { ANALYSIS_TOKEN_COST } from "@/lib/token-constants";
import { openBuyTokenModal } from "@/lib/ui-events";

type FileSelectedCardProps = {
  file: File | null;
  previewCounts: InpPreviewCounts | null;
  previewLoading: boolean;
  previewError: string | null;
  tokenBalance: number | null;
  isAnalyzing: boolean;
  onChangeFile: () => void;
  onRunAnalysis: () => void;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function FileSelectedCard({
  file,
  previewCounts,
  previewLoading,
  previewError,
  tokenBalance,
  isAnalyzing,
  onChangeFile,
  onRunAnalysis
}: FileSelectedCardProps) {
  const canRun = tokenBalance === null ? true : tokenBalance >= ANALYSIS_TOKEN_COST;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-border-lavender bg-white p-5 shadow-whisper">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-gray">
              File dipilih
            </div>
            <div className="mt-1.5 font-semibold tracking-[-0.02em] text-expo-black">
              {file?.name ?? "—"}
            </div>
            <div className="mt-0.5 text-sm text-slate-gray">
              {formatBytes(file?.size ?? 0)}
            </div>
          </div>

          {(previewCounts && !previewLoading && !previewError) && (
            <div className="shrink-0 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl bg-cloud-gray/60 px-4 py-3 text-sm">
              <div className="text-slate-gray">Junction</div>
              <div className="text-right font-medium text-near-black">
                {previewCounts.junctions}
              </div>
              <div className="text-slate-gray">Pipe</div>
              <div className="text-right font-medium text-near-black">
                {previewCounts.pipes}
              </div>
              <div className="text-slate-gray">Reservoir</div>
              <div className="text-right font-medium text-near-black">
                {previewCounts.reservoirs}
              </div>
              <div className="text-slate-gray">Tank</div>
              <div className="text-right font-medium text-near-black">
                {previewCounts.tanks}
              </div>
            </div>
          )}

          {previewLoading && (
            <div className="text-sm text-slate-gray">Membaca file…</div>
          )}
        </div>
      </div>

      {!canRun && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Token tidak cukup. Sisa:{" "}
          <span className="font-semibold">{tokenBalance ?? 0}</span> — butuh 6.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {canRun ? (
          <Button onClick={onRunAnalysis} size="lg" disabled={isAnalyzing}>
            {isAnalyzing ? "Memproses..." : "Jalankan Analisis"}
          </Button>
        ) : (
          <Button onClick={() => openBuyTokenModal()} size="lg">
            Beli Token
          </Button>
        )}
        <Button onClick={onChangeFile} variant="outline">
          Ganti File
        </Button>
        <span className="ml-auto text-sm text-slate-gray">
          Biaya:{" "}
          <span className="font-semibold text-expo-black">
            {ANALYSIS_TOKEN_COST} token
          </span>
        </span>
      </div>
    </div>
  );
}
