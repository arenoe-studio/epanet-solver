"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { openBuyTokenModal } from "@/lib/ui-events";
import type { AnalysisKind } from "@/types";

export function DownloadActions({
  analysisId,
  kind,
  tokenBalance
}: {
  analysisId: number;
  kind: AnalysisKind;
  tokenBalance?: number | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pdfTokenCost = 0;
  const inpTokenCost = 2;

  async function downloadExport(format: "inp" | "pdf") {
    const key = format;
    setBusy(key);
    setError(null);

    try {
      const qs = new URLSearchParams({ format });
      const res = await fetch(`/api/analyses/${analysisId}/export?${qs.toString()}`, {
        method: "POST"
      });

      if (!res.ok) {
        let msg = "Gagal mengunduh file.";
        try {
          const json: unknown = await res.json();
          if (json && typeof json === "object" && "error" in json) {
            const maybeError = (json as { error?: unknown }).error;
            if (typeof maybeError === "string") msg = maybeError;
          }
        } catch {
          // ignore
        }
        if (res.status === 402) openBuyTokenModal();
        setError(msg);
        return;
      }

      const filename =
        parseFilenameFromContentDisposition(res.headers.get("content-disposition")) ??
        `epanet-export.${format}`;
      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = filename;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
    } catch {
      setError("System error saat mengunduh file.");
    } finally {
      setBusy(null);
    }
  }

  const canDownloadInp = kind === "diameter" || kind === "add_prv";
  const notEnoughForInp =
    tokenBalance !== null && tokenBalance !== undefined ? tokenBalance < inpTokenCost : false;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="text-base">Unduh Hasil</CardTitle>
          <p className="mt-1 text-xs text-slate-gray">File disiapkan oleh server dan akan terunduh otomatis.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">PDF: Gratis</Badge>
          {canDownloadInp ? <Badge variant="outline">INP: {inpTokenCost} token</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <DownloadButton
            title="Download Laporan PDF"
            tokenCost={pdfTokenCost}
            busy={busy === "pdf"}
            onClick={() => downloadExport("pdf")}
          />
          {canDownloadInp ? (
            <DownloadButton
              title={kind === "add_prv" ? "Download File .INP dengan PRV" : "Download File .INP Hasil"}
              tokenCost={inpTokenCost}
              busy={busy === "inp"}
              disabled={notEnoughForInp}
              onClick={() => downloadExport("inp")}
              buyToken={notEnoughForInp ? () => openBuyTokenModal() : undefined}
            />
          ) : (
            <div className="rounded-2xl border border-border-lavender bg-white p-4 text-xs text-slate-gray">
              Untuk analisis pressure, tidak ada file <span className="font-mono">.inp</span> yang diunduh karena tidak memodifikasi file.
            </div>
          )}
        </div>

        {error ? (
          <div className="rounded-xl border border-border-lavender bg-soft-lilac px-3 py-2 text-xs text-expo-black">
            {error}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DownloadButton({
  title,
  tokenCost,
  busy,
  disabled,
  onClick,
  buyToken
}: {
  title: string;
  tokenCost: number;
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  buyToken?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border-lavender bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-expo-black">{title}</div>
        <Badge variant="outline">{tokenCost <= 0 ? "Gratis" : `${tokenCost} token`}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={disabled || busy} onClick={onClick}>
          {busy ? "Menyiapkan…" : "Download"}
        </Button>
        {disabled && buyToken ? (
          <button type="button" onClick={buyToken} className="text-xs font-semibold text-expo-black underline">
            Beli Token
          </button>
        ) : null}
      </div>
    </div>
  );
}

function parseFilenameFromContentDisposition(headerValue: string | null) {
  if (!headerValue) return null;
  const m = /filename\\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i.exec(headerValue);
  const raw = decodeURIComponent((m?.[1] ?? m?.[2] ?? "").trim());
  return raw || null;
}
