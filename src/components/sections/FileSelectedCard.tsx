"use client";

import { Button } from "@/components/ui/button";
import type { PreviewResult } from "@/types";
import { ANALYSIS_TOKEN_COST, PRESSURE_ANALYSIS_TOKEN_COST } from "@/lib/token-constants";
import { openBuyTokenModal } from "@/lib/ui-events";

type FileSelectedCardProps = {
  file: File | null;
  preview: PreviewResult | null;
  previewLoading: boolean;
  previewError: string | null;
  tokenBalance: number | null;
  isAnalyzing: boolean;
  onChangeFile: () => void;
  onRunDiameter: () => void;
  onRunPressure: () => void;
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
  preview,
  previewLoading,
  previewError,
  tokenBalance,
  isAnalyzing,
  onChangeFile,
  onRunDiameter,
  onRunPressure
}: FileSelectedCardProps) {
  const diameterMinToken = 4;
  const pressureMinToken = 1;
  const canRunDiameter = tokenBalance === null ? true : tokenBalance >= diameterMinToken;
  const canRunPressure = tokenBalance === null ? true : tokenBalance >= pressureMinToken;

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

          {preview && !previewLoading && !previewError ? (
            <div className="shrink-0 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl bg-cloud-gray/60 px-4 py-3 text-sm">
              <div className="text-slate-gray">Junction</div>
              <div className="text-right font-medium text-near-black">
                {preview.networkInfo.junctionCount}
              </div>
              <div className="text-slate-gray">Pipe</div>
              <div className="text-right font-medium text-near-black">
                {preview.networkInfo.pipeCount}
              </div>
              <div className="text-slate-gray">Reservoir</div>
              <div className="text-right font-medium text-near-black">
                {preview.networkInfo.reservoirCount}
              </div>
              <div className="text-slate-gray">Tank</div>
              <div className="text-right font-medium text-near-black">
                {preview.networkInfo.tankCount}
              </div>
            </div>
          ) : null}

          {previewLoading ? <div className="text-sm text-slate-gray">Membaca file...</div> : null}
        </div>
      </div>

      {previewError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {previewError}
        </div>
      ) : null}

      {preview?.warnings?.length ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          <div className="font-semibold">Peringatan</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={onRunDiameter}
            size="lg"
            disabled={isAnalyzing || !canRunDiameter}
          >
            Run Analysis — Diameter ({ANALYSIS_TOKEN_COST} token)
          </Button>
          <Button
            onClick={onRunPressure}
            size="lg"
            disabled={isAnalyzing || !canRunPressure}
          >
            Run Analysis — Pressure ({PRESSURE_ANALYSIS_TOKEN_COST} token)
          </Button>
          <Button onClick={onChangeFile} variant="outline">
            Ganti File
          </Button>
        </div>

        {!isAnalyzing && tokenBalance !== null && !canRunDiameter ? (
          <button
            type="button"
            onClick={() => openBuyTokenModal()}
            className="text-sm font-medium text-slate-gray underline underline-offset-2 hover:text-near-black"
          >
            Beli Token (untuk Diameter)
          </button>
        ) : null}

        {!isAnalyzing && tokenBalance !== null && !canRunPressure ? (
          <button
            type="button"
            onClick={() => openBuyTokenModal()}
            className="text-sm font-medium text-slate-gray underline underline-offset-2 hover:text-near-black"
          >
            Beli Token (untuk Pressure)
          </button>
        ) : null}
      </div>
    </div>
  );
}
