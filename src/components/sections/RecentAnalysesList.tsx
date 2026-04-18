"use client";

import useSWR from "swr";

import { Button } from "@/components/ui/button";

type RecentAnalysesListProps = {
  onView: (analysisId: number) => void;
  viewingId?: number | null;
};

type RecentRow = {
  rootId: number;
  viewId: number;
  fileName: string | null;
  status: string | null;
  issuesFound: number | null;
  issuesFixed: number | null;
  createdAt: string | Date | null;
  hasFinal: boolean;
};

async function fetcher(url: string) {
  const res = await fetch(url);
  return res.json();
}

function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

export function RecentAnalysesList({ onView, viewingId }: RecentAnalysesListProps) {
  const { data, isLoading } = useSWR("/api/analyses/recent", fetcher, {
    revalidateOnFocus: false
  });

  const items: RecentRow[] = data?.items ?? [];

  return (
    <div className="rounded-2xl border border-border-lavender bg-white p-5 shadow-whisper">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold tracking-[-0.01em] text-expo-black">
          Riwayat (3 hari terakhir)
        </div>
        <div className="text-xs text-slate-gray">
          Maksimal tersimpan 3 hari.
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border-lavender">
        {isLoading ? (
          <div className="px-4 py-3 text-sm text-slate-gray">Memuat…</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-3 text-sm text-slate-gray">
            Belum ada hasil analisis.
          </div>
        ) : (
          <ul className="divide-y divide-border-lavender">
            {items.map((r) => {
              const kindLabel = r.hasFinal ? "Final/PRV" : "V1";
              const issuesLabel =
                typeof r.issuesFound === "number" && typeof r.issuesFixed === "number"
                  ? `${r.issuesFound} → ${r.issuesFound - r.issuesFixed}`
                  : "—";

              return (
                <li
                  key={r.rootId}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-[220px]">
                    <div className="truncate text-sm font-semibold text-expo-black">
                      {r.fileName ?? "—"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-gray">
                      {r.createdAt ? formatDate(r.createdAt) : "—"} · {kindLabel} · Issues {issuesLabel}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onView(r.viewId)}
                    disabled={viewingId === r.viewId}
                  >
                    {viewingId === r.viewId ? "Membuka…" : "Lihat Analisis"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
