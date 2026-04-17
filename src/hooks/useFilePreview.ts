"use client";

import { useEffect, useState } from "react";

export type InpPreviewCounts = {
  junctions: number;
  pipes: number;
  reservoirs: number;
  tanks: number;
};

export function parseInpPreview(text: string): InpPreviewCounts {
  const sectionMap: Record<string, keyof InpPreviewCounts> = {
    "[JUNCTIONS]": "junctions",
    "[PIPES]": "pipes",
    "[RESERVOIRS]": "reservoirs",
    "[TANKS]": "tanks"
  };

  const counts: InpPreviewCounts = {
    junctions: 0,
    pipes: 0,
    reservoirs: 0,
    tanks: 0
  };

  let section = "";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    if (!upper) continue;
    if (upper.startsWith("[")) {
      section = upper.split(/\s/)[0] ?? "";
      continue;
    }
    if (trimmed.startsWith(";")) continue;

    const key = sectionMap[section];
    if (key) counts[key] += 1;
  }

  return counts;
}

export function useFilePreview(file: File | null) {
  const [counts, setCounts] = useState<InpPreviewCounts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!file) {
      setCounts(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    file
      .text()
      .then((text) => {
        if (cancelled) return;
        setCounts(parseInpPreview(text));
      })
      .catch(() => {
        if (cancelled) return;
        setError("Gagal membaca file untuk preview.");
        setCounts(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  return { counts, isLoading, error };
}

