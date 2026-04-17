"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type ProcessingStateProps = {
  isDone: boolean;
  isError: boolean;
  onCancel: () => void;
};

const PROCESSING_STEPS: Array<{ label: string; durationMs: number | null }> = [
  { label: "File berhasil dibaca", durationMs: 1500 },
  { label: "Simulasi hidrolik dijalankan", durationMs: 3000 },
  { label: "Pelanggaran kriteria terdeteksi", durationMs: 2000 },
  { label: "Iterasi diameter pipa…", durationMs: null },
  { label: "Validasi hasil akhir", durationMs: 1000 }
];

export function ProcessingState({ isDone, isError, onCancel }: ProcessingStateProps) {
  const [progress, setProgress] = useState(2);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (isError) return;

    const started = Date.now();
    let stepTimeout: number | null = null;
    let raf: number | null = null;

    const tickProgress = () => {
      const elapsed = Date.now() - started;
      const assumedTotal = 30000;
      const next = Math.min(97, Math.round((elapsed / assumedTotal) * 100));
      setProgress(next);
      raf = window.requestAnimationFrame(tickProgress);
    };

    const advance = (idx: number) => {
      setActiveIdx(idx);
      const duration = PROCESSING_STEPS[idx]?.durationMs;
      if (duration === null) return;
      stepTimeout = window.setTimeout(() => {
        advance(Math.min(PROCESSING_STEPS.length - 1, idx + 1));
      }, duration);
    };

    advance(0);
    raf = window.requestAnimationFrame(tickProgress);

    return () => {
      if (stepTimeout) window.clearTimeout(stepTimeout);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [isError]);

  useEffect(() => {
    if (!isDone) return;
    setActiveIdx(PROCESSING_STEPS.length - 1);
    setProgress(100);
  }, [isDone]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-[-0.03em] text-expo-black">
          Memproses file…
        </h2>
        <p className="mt-1 text-sm text-slate-gray">
          Proses berjalan. Ini bisa memakan waktu beberapa detik.
        </p>
      </div>

      <Progress value={isDone ? 100 : progress} />

      <div className="space-y-1.5">
        {PROCESSING_STEPS.map((step, idx) => {
          const done = idx < activeIdx;
          const active = idx === activeIdx;
          return (
            <div
              key={step.label}
              className={[
                "flex items-center gap-3 rounded-xl px-4 py-3 transition-all",
                done
                  ? "opacity-40"
                  : active
                    ? "border border-border-lavender bg-white shadow-whisper"
                    : ""
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                  done
                    ? "bg-expo-black text-white"
                    : active
                      ? "border-2 border-expo-black bg-white text-expo-black"
                      : "border border-border-lavender bg-white text-silver"
                ].join(" ")}
                aria-hidden
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M8 2.5L4 7.5L2 5.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  idx + 1
                )}
              </span>
              <span
                className={[
                  "text-sm",
                  done
                    ? "line-through text-slate-gray"
                    : active
                      ? "font-medium text-expo-black"
                      : "text-slate-gray"
                ].join(" ")}
              >
                {step.label}
              </span>
              {active && (
                <span className="ml-auto text-xs animate-pulse text-slate-gray">
                  berjalan…
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <Button onClick={onCancel} variant="ghost" size="sm">
          Batalkan
        </Button>
      </div>
    </div>
  );
}
