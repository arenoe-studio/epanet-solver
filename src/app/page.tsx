"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { FileSelectedCard } from "@/components/sections/FileSelectedCard";
import { HeroSection } from "@/components/sections/HeroSection";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { PricingSection } from "@/components/sections/PricingSection";
import { ProcessingState } from "@/components/sections/ProcessingState";
import { ResultsPanel } from "@/components/sections/ResultsPanel";
import { UploadZone } from "@/components/sections/UploadZone";
import { useFilePreview } from "@/hooks/useFilePreview";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useToast } from "@/components/providers/ToastProvider";
import { openBuyTokenModal } from "@/lib/ui-events";
import type { AnalysisResult, AppState } from "@/types";

export default function HomePage() {
  const [state, setState] = useState<AppState>("hero");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { status } = useSession();
  const isLoggedIn = status === "authenticated";
  const { counts, isLoading: previewLoading, error: previewError } =
    useFilePreview(selectedFile);
  const { balance: tokenBalance, refresh: refreshBalance } =
    useTokenBalance(isLoggedIn);
  const { push } = useToast();

  const canRunAnalysis = tokenBalance === null ? true : tokenBalance >= 6;

  useEffect(() => {
    if (!isLoggedIn) {
      setSelectedFile(null);
      setResult(null);
      setErrorMessage(null);
      setState("hero");
      setIsAnalyzing(false);
      return;
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (status === "authenticated") {
      push({
        title: "Selamat datang!",
        description: "Jika user baru, 6 token gratis otomatis ditambahkan.",
        variant: "success"
      });
      setState((s) => (s === "hero" ? "upload" : s));
    }
  }, [push, status]);

  async function runAnalysis() {
    if (!selectedFile) return;
    if (!canRunAnalysis) {
      openBuyTokenModal();
      push({ title: "Saldo token tidak cukup", variant: "error" });
      return;
    }

    setErrorMessage(null);
    setIsAnalyzing(true);
    setState("processing");

    const fd = new FormData();
    fd.set("file", selectedFile);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const json = (await res.json()) as any;

      if (res.status === 402) {
        setIsAnalyzing(false);
        setState("file-selected");
        openBuyTokenModal();
        push({ title: "Saldo token tidak cukup", variant: "error" });
        return;
      }

      if (!res.ok || !json?.success) {
        const msg = json?.error ?? "Terjadi kesalahan sistem.";
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

      const nextResult: AnalysisResult = {
        fileName: json.summary?.fileName ?? selectedFile.name,
        summary: json.summary,
        files: json.files
      };

      setResult(nextResult);
      setIsAnalyzing(false);
      void refreshBalance();
      setState("results");
      push({ title: "Analisis selesai", variant: "success" });
    } catch {
      setErrorMessage("Terjadi kesalahan sistem.");
      setIsAnalyzing(false);
      setState("error");
      push({ title: "Analisis gagal", variant: "error" });
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
        {state === "hero" ? (
          <div className="space-y-20">
            <HeroSection
              isLoggedIn={isLoggedIn}
              onPrimaryAction={() =>
                isLoggedIn ? setState("upload") : signIn("google")
              }
            />
            <HowItWorks />
            <PricingSection />
          </div>
        ) : null}

        {state === "upload" ? (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold tracking-[-0.035em] text-expo-black">
                Upload file <span className="font-mono">.inp</span>
              </h2>
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
          </div>
        ) : null}

        {state === "file-selected" ? (
          <div className="space-y-10">
            <FileSelectedCard
              file={selectedFile}
              previewCounts={counts}
              previewLoading={previewLoading}
              previewError={previewError}
              tokenBalance={tokenBalance}
              onChangeFile={() => {
                setSelectedFile(null);
                setState("upload");
              }}
              onRunAnalysis={runAnalysis}
            />
          </div>
        ) : null}

        {state === "processing" ? (
          <ProcessingState
            isDone={!isAnalyzing}
            isError={false}
            onCancel={() => {
              setIsAnalyzing(false);
              setState("file-selected");
            }}
          />
        ) : null}

        {state === "results" ? (
          result ? (
            <ResultsPanel
              result={result}
              onAnalyzeAnother={() => {
                setSelectedFile(null);
                setResult(null);
                setState("upload");
              }}
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
              {!canRunAnalysis ? (
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

      <Footer />
    </div>
  );
}
