"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

import { FileSelectedCard } from "@/components/sections/FileSelectedCard";
import { ProcessingState } from "@/components/sections/ProcessingState";
import { RecentAnalysesList } from "@/components/sections/RecentAnalysesList";
import { ResultsPanel } from "@/components/results/ResultsPanel";
import { UploadZone } from "@/components/sections/UploadZone";
import { useFilePreview } from "@/hooks/useFilePreview";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useToast } from "@/components/providers/ToastProvider";
import {
  ANALYSIS_TOKEN_COST,
  INITIAL_FREE_TOKENS,
  PRESSURE_ANALYSIS_TOKEN_COST
} from "@/lib/token-constants";
import { openBuyTokenModal } from "@/lib/ui-events";
import type { AnalysisResult, AppState } from "@/types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function getNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function getBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
  const v = obj[key];
  return typeof v === "boolean" ? v : undefined;
}

export default function UploadPage() {
  const [state, setState] = useState<AppState>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixingPressure, setIsFixingPressure] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [viewingHistoryId, setViewingHistoryId] = useState<number | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);

  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  const { preview, isLoading: previewLoading, error: previewError } =
    useFilePreview(selectedFile);
  const { balance: tokenBalance, refresh: refreshBalance } =
    useTokenBalance(isLoggedIn);
  const { push } = useToast();

  const canRunDiameter = useMemo(() => {
    return tokenBalance === null ? true : tokenBalance >= ANALYSIS_TOKEN_COST;
  }, [tokenBalance]);
  const canRunPressure = useMemo(() => {
    return tokenBalance === null ? true : tokenBalance >= PRESSURE_ANALYSIS_TOKEN_COST;
  }, [tokenBalance]);
  const canRunAnyAnalysis = canRunDiameter || canRunPressure;

  const isProcessing =
    state === "processing-diameter" ||
    state === "processing-pressure" ||
    state === "processing-add-prv";

  useEffect(() => {
    if (!isLoggedIn) {
      setSelectedFile(null);
      setResult(null);
      setErrorMessage(null);
      setState("upload");
      setIsAnalyzing(false);
      setIsFixingPressure(false);
      setIsLoadingHistory(false);
      setViewingHistoryId(null);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (status !== "authenticated") return;
    try {
      const key = "epanet-solver:welcomed";
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      push({
        title: "Selamat datang!",
        description: `Jika user baru, ${INITIAL_FREE_TOKENS} token gratis otomatis ditambahkan.`,
        variant: "success"
      });
    } catch {
      // ignore storage errors
    }
  }, [push, status]);

  function base64ToFile(base64: string, filename: string) {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "text/plain" });
    return new File([blob], filename, { type: "text/plain" });
  }

  async function urlToFile(url: string, filename: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Gagal mengambil file dari riwayat.");
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: "text/plain" });
    return new File([blob], filename, { type: "text/plain" });
  }

  async function waitForBackendJob(jobId: string, analysisId: number) {
    const aborter = pollAbortRef.current;
    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => resolve(), ms);
        aborter?.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(t);
            reject(new Error("aborted"));
          },
          { once: true }
        );
      });

    while (true) {
      if (aborter?.signal.aborted) throw new Error("aborted");

      const statusRes = await fetch(`/api/simulations/${jobId}?analysisId=${analysisId}`, {
        signal: aborter?.signal
      });
      const statusJson: unknown = await statusRes.json();
      const statusObj = isRecord(statusJson) ? statusJson : {};

      if (!statusRes.ok) {
        throw new Error(getString(statusObj, "error") ?? "System error");
      }

      if (getString(statusObj, "status") === "failed") {
        const err = getString(statusObj, "error") === "MAINTENANCE"
          ? "Solver sedang maintenance. Silakan coba lagi beberapa saat."
          : getString(statusObj, "error") ?? "System error";
        throw new Error(err);
      }

      if (getString(statusObj, "status") === "succeeded") {
        const res = await fetch(`/api/simulations/${jobId}/result?analysisId=${analysisId}`, {
          signal: aborter?.signal
        });
        const json: unknown = await res.json();
        const obj = isRecord(json) ? json : {};
        if (!res.ok || getBoolean(obj, "success") !== true) {
          const traceId = getString(obj, "traceId") ?? res.headers.get("x-trace-id");
          const errorCode = obj["errorCode"];
          const msg = getString(obj, "error") ?? "Terjadi kesalahan sistem.";
          const suffixParts = [
            errorCode ? `Code: ${String(errorCode)}` : null,
            traceId ? `Trace: ${String(traceId)}` : null
          ].filter(Boolean);
          throw new Error(suffixParts.length ? `${msg} (${suffixParts.join(", ")})` : msg);
        }
        return obj;
      }

      await sleep(1500);
    }
  }

  async function runAnalysis(kind: "diameter" | "pressure") {
    if (!selectedFile) return;
    if (isAnalyzing) return;
    if (isFixingPressure) return;
    const canRun = kind === "diameter" ? canRunDiameter : canRunPressure;
    if (!canRun) {
      openBuyTokenModal();
      push({ title: "Saldo token tidak cukup", variant: "error" });
      return;
    }

    setErrorMessage(null);
    setIsAnalyzing(true);
    setState(kind === "diameter" ? "processing-diameter" : "processing-pressure");

    const fd = new FormData();
    fd.set("file", selectedFile);

    try {
      const endpoint =
        kind === "diameter" ? "/api/analyze/diameter" : "/api/analyze/pressure";
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json: unknown = await res.json();
      const obj = isRecord(json) ? json : {};

      if (res.status === 402) {
        setIsAnalyzing(false);
        setState("file-selected");
        void refreshBalance();
        openBuyTokenModal();
        push({ title: "Saldo token tidak cukup", variant: "error" });
        return;
      }

      if (!res.ok || getBoolean(obj, "success") !== true) {
        const msg = getString(obj, "error") ?? "Terjadi kesalahan sistem.";
        setErrorMessage(msg);
        setIsAnalyzing(false);
        setState("error");
        push({
          title: "Analisis gagal",
          description:
            res.status === 422
              ? "File tidak dapat dibaca. Pastikan file .inp valid dari EPANET."
              : msg,
          variant: "error"
        });
        return;
      }

      const jobId = getString(obj, "jobId") ?? "";
      const analysisId = getNumber(obj, "analysisId") ?? NaN;
      if (!jobId || !Number.isFinite(analysisId)) {
        throw new Error("System error");
      }

      pollAbortRef.current?.abort();
      pollAbortRef.current = new AbortController();

      const done = await waitForBackendJob(jobId, analysisId);
      const doneSummary = isRecord(done["summary"]) ? (done["summary"] as AnalysisResult["summary"]) : null;
      const doneFiles = isRecord(done["files"]) ? (done["files"] as AnalysisResult["files"]) : null;
      if (!doneSummary || !doneFiles) throw new Error("System error");
      const nextResult: AnalysisResult = {
        analysisId,
        fileName: selectedFile.name,
        kind,
        engineUsed: typeof done["engineUsed"] === "string" ? done["engineUsed"] : undefined,
        remainingErrors: (done["remainingErrors"] as AnalysisResult["remainingErrors"]) ?? [],
        diameterChanges: (done["diameterChanges"] as AnalysisResult["diameterChanges"]) ?? [],
        prvRecommendation: (done["prvRecommendation"] as AnalysisResult["prvRecommendation"]) ?? undefined,
        summary: doneSummary,
        prv: (done["prv"] as AnalysisResult["prv"]) ?? undefined,
        files: doneFiles,
        filesV1: (done["filesV1"] as AnalysisResult["filesV1"]) ?? undefined,
        filesFinal: (done["filesFinal"] as AnalysisResult["filesFinal"]) ?? null,
        nodes: Array.isArray(done["nodes"]) ? (done["nodes"] as AnalysisResult["nodes"]) : [],
        pipes: Array.isArray(done["pipes"]) ? (done["pipes"] as AnalysisResult["pipes"]) : [],
        materials: Array.isArray(done["materials"]) ? (done["materials"] as AnalysisResult["materials"]) : [],
        warnings: Array.isArray(done["warnings"]) ? (done["warnings"] as AnalysisResult["warnings"]) : [],
        networkInfo: (done["networkInfo"] as AnalysisResult["networkInfo"]) ?? undefined
      };

      setResult(nextResult);
      setIsAnalyzing(false);
      void refreshBalance();
      setState("results");
      push({ title: "Analisis selesai", variant: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Terjadi kesalahan sistem.";
      setErrorMessage(msg);
      setIsAnalyzing(false);
      void refreshBalance();
      setState("error");
      push({ title: "Analisis gagal", description: msg, variant: "error" });
    }
  }

  async function openHistoryAnalysis(analysisId: number) {
    if (isAnalyzing) return;
    if (isFixingPressure) return;
    if (isLoadingHistory) return;

    setErrorMessage(null);
    setIsLoadingHistory(true);
    setViewingHistoryId(analysisId);

    try {
      const res = await fetch(`/api/analyses/${analysisId}`);
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error ?? "Riwayat tidak ditemukan.";
        setErrorMessage(msg);
        setState("error");
        push({ title: "Gagal membuka riwayat", description: msg, variant: "error" });
        return;
      }

      setSelectedFile(null);
      const history = json as AnalysisResult;
      if (history.sourceFileBase64 && history.sourceFileName) {
        try {
          setSelectedFile(base64ToFile(history.sourceFileBase64, history.sourceFileName));
        } catch {
          setSelectedFile(null);
        }
      } else if (history.sourceFileUrl && history.sourceFileName) {
        try {
          setSelectedFile(await urlToFile(history.sourceFileUrl, history.sourceFileName));
        } catch {
          setSelectedFile(null);
        }
      } else {
        setSelectedFile(null);
      }
      setResult(history);
      setState("results");
      push({ title: "Riwayat analisis dibuka", variant: "success" });
    } catch {
      setErrorMessage("Riwayat tidak ditemukan atau sudah kedaluwarsa (maksimal 3 hari).");
      setState("error");
      push({ title: "Gagal membuka riwayat", variant: "error" });
    } finally {
      setIsLoadingHistory(false);
      setViewingHistoryId(null);
    }
  }

  async function runAddPrv() {
    if (!selectedFile) {
      push({
        title: "Upload file terlebih dahulu",
        description:
          "Fix Pressure membutuhkan file .inp. Jika membuka dari riwayat, pastikan riwayat masih dalam 3 hari.",
        variant: "error"
      });
      return;
    }
    if (!result?.analysisId) return;
    if (isAnalyzing) return;
    if (isFixingPressure) return;

    if (!canRunAnyAnalysis) {
      openBuyTokenModal();
      push({ title: "Saldo token tidak cukup", variant: "error" });
      return;
    }

    setErrorMessage(null);
    setIsFixingPressure(true);
    setState("processing-add-prv");

    const fd = new FormData();
    fd.set("file", selectedFile);
    fd.set("parentAnalysisId", String(result.analysisId));
    fd.set(
      "prvRecommendations",
      JSON.stringify(result.prvRecommendation?.recommendations ?? [])
    );

    try {
      const res = await fetch("/api/analyze/add-prv", { method: "POST", body: fd });
      const json: unknown = await res.json();
      const obj = isRecord(json) ? json : {};

      if (res.status === 402) {
        setIsFixingPressure(false);
        setState("results");
        void refreshBalance();
        openBuyTokenModal();
        push({ title: "Saldo token tidak cukup", variant: "error" });
        return;
      }

      if (!res.ok || getBoolean(obj, "success") !== true) {
        const msg = getString(obj, "error") ?? "Terjadi kesalahan sistem.";
        setErrorMessage(msg);
        setIsFixingPressure(false);
        setState("results");
        push({
          title: "Fix pressure gagal",
          description: res.status === 422 ? "File tidak dapat diproses." : msg,
          variant: "error"
        });
        return;
      }

      const jobId = getString(obj, "jobId") ?? "";
      const analysisId = getNumber(obj, "analysisId") ?? NaN;
      if (!jobId || !Number.isFinite(analysisId)) {
        throw new Error("System error");
      }

      pollAbortRef.current?.abort();
      pollAbortRef.current = new AbortController();

      const done = await waitForBackendJob(jobId, analysisId);
      const doneSummary = isRecord(done["summary"]) ? (done["summary"] as AnalysisResult["summary"]) : null;
      const doneFiles = isRecord(done["files"]) ? (done["files"] as AnalysisResult["files"]) : null;
      if (!doneSummary || !doneFiles) throw new Error("System error");
      const updated: AnalysisResult = {
        analysisId,
        fileName: selectedFile.name,
        kind: "add_prv",
        engineUsed: typeof done["engineUsed"] === "string" ? done["engineUsed"] : undefined,
        summary: doneSummary,
        prv: (done["prv"] as AnalysisResult["prv"]) ?? undefined,
        files: doneFiles,
        filesV1: (done["filesV1"] as AnalysisResult["filesV1"]) ?? undefined,
        filesFinal: (done["filesFinal"] as AnalysisResult["filesFinal"]) ?? null,
        nodes: Array.isArray(done["nodes"]) ? (done["nodes"] as AnalysisResult["nodes"]) : [],
        pipes: Array.isArray(done["pipes"]) ? (done["pipes"] as AnalysisResult["pipes"]) : [],
        materials: Array.isArray(done["materials"]) ? (done["materials"] as AnalysisResult["materials"]) : [],
        warnings: Array.isArray(done["warnings"]) ? (done["warnings"] as AnalysisResult["warnings"]) : [],
        networkInfo: (done["networkInfo"] as AnalysisResult["networkInfo"]) ?? undefined
      };

      setResult(updated);
      setIsFixingPressure(false);
      void refreshBalance();
      setState("results");
      push({ title: "Fix pressure selesai", variant: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Terjadi kesalahan sistem.";
      setErrorMessage(msg);
      setIsFixingPressure(false);
      void refreshBalance();
      setState("results");
      push({ title: "Fix pressure gagal", variant: "error" });
    }
  }

  if (!isLoggedIn) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16">
        <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-expo-black">
            Upload & Analisis
          </h1>
          <p className="mt-2 text-sm text-slate-gray">
            Untuk mengupload file dan menjalankan analisis, silakan masuk terlebih dahulu.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              className="inline-flex h-11 items-center rounded-full bg-expo-black px-7 text-base font-semibold text-white transition hover:opacity-80 active:scale-[0.98]"
              href="/login?callbackUrl=%2Fupload"
            >
              Masuk
            </Link>
            <Link
              href="/#pricing"
              className="inline-flex h-11 items-center rounded-full border border-border-lavender bg-white px-7 text-base font-semibold text-near-black transition hover:bg-cloud-gray active:scale-[0.98]"
            >
              Lihat Paket Token
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
      {state === "upload" ? (
        <div className="flex flex-col items-center">
          <div className="w-full max-w-2xl space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-[-0.035em] text-expo-black">
              Upload file <span className="font-mono">.inp</span>
            </h1>
            <p className="mt-2 text-sm text-slate-gray">
              Drag & drop atau pilih file EPANET untuk dianalisis.
            </p>
          </div>
          <UploadZone
            onFileSelected={(file) => {
              setSelectedFile(file);
              setState("file-selected");
            }}
          />
          <RecentAnalysesList
            onView={openHistoryAnalysis}
            viewingId={viewingHistoryId}
          />
          </div>
        </div>
      ) : null}

      {state === "file-selected" ? (
        <div className="space-y-10">
          <FileSelectedCard
            file={selectedFile}
            preview={preview}
            previewLoading={previewLoading}
            previewError={previewError}
            tokenBalance={tokenBalance}
            isAnalyzing={isAnalyzing}
            onChangeFile={() => {
              setSelectedFile(null);
              setState("upload");
            }}
            onRunDiameter={() => runAnalysis("diameter")}
            onRunPressure={() => runAnalysis("pressure")}
          />
        </div>
      ) : null}

      {isProcessing ? (
        <ProcessingState
          isDone={!isAnalyzing && !isFixingPressure}
          isError={false}
          kind={
            state === "processing-diameter"
              ? "diameter"
              : state === "processing-pressure"
                ? "pressure"
                : state === "processing-add-prv"
                  ? "add_prv"
                  : undefined
          }
          onCancel={() => {
            pollAbortRef.current?.abort();
            setIsAnalyzing(false);
            setIsFixingPressure(false);
            setState(selectedFile ? "file-selected" : "upload");
          }}
        />
      ) : null}

      {state === "results" ? (
        result ? (
          <ResultsPanel
            result={result}
            onBackToUpload={() => {
              setSelectedFile(null);
              setResult(null);
              setErrorMessage(null);
              setState("upload");
            }}
            onAnalyzeAnother={() => {
              setSelectedFile(null);
              setResult(null);
              setState("upload");
            }}
            onAddPrv={runAddPrv}
            isAddingPrv={isFixingPressure}
            tokenBalance={tokenBalance}
          />
        ) : null
      ) : null}

      {state === "error" ? (
        <div className="mx-auto max-w-xl space-y-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
              Analisis gagal
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-expo-black">
              Terjadi kesalahan
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-gray">
              {errorMessage ??
                "Terjadi error saat memproses file. Coba ulangi atau gunakan file yang lebih kecil."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              className="inline-flex h-11 items-center rounded-full bg-expo-black px-7 text-base font-semibold text-white transition hover:opacity-80 active:scale-[0.98]"
              onClick={() => setState("upload")}
              type="button"
            >
              Upload File Baru
            </button>
            <button
              className="inline-flex h-9 items-center rounded-full border border-border-lavender bg-white px-5 text-sm font-semibold text-near-black transition hover:bg-cloud-gray active:scale-[0.98]"
              onClick={() => setState("file-selected")}
              type="button"
            >
              Kembali ke File
            </button>
            {!canRunAnyAnalysis ? (
              <button
                className="inline-flex h-9 items-center rounded-full border border-border-lavender bg-white px-5 text-sm font-semibold text-near-black transition hover:bg-cloud-gray active:scale-[0.98]"
                onClick={() => openBuyTokenModal()}
                type="button"
              >
                Beli Token
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
