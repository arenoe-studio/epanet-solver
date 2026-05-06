"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PreviewResult } from "@/types";

type PreviewStatus = "idle" | "loading" | "success" | "error";

export function useFilePreview(file: File | null) {
  const abortRef = useRef<AbortController | null>(null);

  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setPreview(null);
    setError(null);
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (!file) {
      reset();
      return;
    }

    const aborter = new AbortController();
    abortRef.current = aborter;

    setStatus("loading");
    setPreview(null);
    setError(null);

    const fd = new FormData();
    fd.set("file", file);

    fetch("/api/analyze/preview", {
      method: "POST",
      body: fd,
      signal: aborter.signal
    })
      .then(async (res) => {
        if (aborter.signal.aborted) return;

        if (res.status === 422) {
          let msg: string | null = null;
          try {
            const json = (await res.json()) as any;
            msg = typeof json?.error === "string" ? json.error : null;
          } catch {
            // ignore
          }
          setStatus("error");
          setError(msg ?? "Gagal membaca file");
          return;
        }

        if (!res.ok) {
          setStatus("error");
          setError("Gagal membaca file");
          return;
        }

        const data = (await res.json()) as PreviewResult;
        setPreview(data);
        setStatus("success");
      })
      .catch((e) => {
        if (aborter.signal.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setStatus("error");
        setError("Gagal membaca file");
      });

    return () => {
      aborter.abort();
    };
  }, [file, reset]);

  return { preview, isLoading: status === "loading", error, reset };
}
