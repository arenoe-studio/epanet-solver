import Link from "next/link";

import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "low_token", label: "Token ≤ 2" },
  { id: "unverified", label: "Unverified" },
  { id: "pending_payment", label: "Pending payment" },
  { id: "open_report", label: "Ada laporan" },
  { id: "active_7d", label: "Aktif 7 hari" }
] as const;

const SORTS = [
  { id: "created", label: "Terbaru" },
  { id: "last_analysis", label: "Analisis" },
  { id: "balance", label: "Balance" }
] as const;

export function FilterBar({
  q,
  filter,
  sort,
  dir
}: {
  q: string;
  filter: string;
  sort: string;
  dir: string;
}) {
  function chipHref(filterId: string) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (filterId && filterId !== filter) p.set("filter", filterId);
    if (sort) p.set("sort", sort);
    if (dir) p.set("dir", dir);
    const s = p.toString();
    return `/admin/users${s ? `?${s}` : ""}`;
  }

  function sortHref(sortId: string) {
    const nextDir = sort === sortId && dir === "asc" ? "desc" : "asc";
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (filter) p.set("filter", filter);
    p.set("sort", sortId);
    p.set("dir", nextDir);
    return `/admin/users?${p.toString()}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#e4e5ea] bg-[#f5f5f7] px-4 py-2">
      {/* Filter chips */}
      <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Filter:</span>
      {FILTERS.map((f) => (
        <Link
          key={f.id}
          href={chipHref(f.id)}
          className={cn(
            "rounded border px-2 py-0.5 text-xs font-medium",
            filter === f.id
              ? "border-[#111112] bg-[#111112] text-white"
              : "border-[#e4e5ea] bg-white text-[#1b1c1f] hover:border-[#6b7280]"
          )}
        >
          {f.label}
        </Link>
      ))}

      <div className="mx-1 h-4 w-px bg-[#e4e5ea]" />

      {/* Sort chips */}
      <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Sort:</span>
      {SORTS.map((s) => {
        const active = sort === s.id;
        const arrow = active ? (dir === "asc" ? " ↑" : " ↓") : "";
        return (
          <Link
            key={s.id}
            href={sortHref(s.id)}
            className={cn(
              "rounded border px-2 py-0.5 text-xs font-medium",
              active
                ? "border-[#111112] bg-[#111112] text-white"
                : "border-[#e4e5ea] bg-white text-[#1b1c1f] hover:border-[#6b7280]"
            )}
          >
            {s.label}{arrow}
          </Link>
        );
      })}
    </div>
  );
}
