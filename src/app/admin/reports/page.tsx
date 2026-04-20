import Link from "next/link";

import { and, desc, eq, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { contactMessages } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

const STATUS_FILTERS = [
  { id: "open",     label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "spam",     label: "Spam" },
  { id: "all",      label: "Semua" }
] as const;

export default async function AdminReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const rawStatus = (Array.isArray(sp.status) ? sp.status[0] : sp.status) ?? "open";
  const status = STATUS_FILTERS.some((f) => f.id === rawStatus) ? rawStatus : "open";
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim();

  const db = getDb();

  const conditions = [];
  if (status !== "all") conditions.push(eq(contactMessages.status, status));
  if (q) {
    conditions.push(
      sql`lower(${contactMessages.email}) like ${`%${q.toLowerCase()}%`} or lower(${contactMessages.topic}) like ${`%${q.toLowerCase()}%`}`
    );
  }

  const rows = await db
    .select({
      id:        contactMessages.id,
      name:      contactMessages.name,
      email:     contactMessages.email,
      topic:     contactMessages.topic,
      status:    contactMessages.status,
      message:   contactMessages.message,
      createdAt: contactMessages.createdAt
    })
    .from(contactMessages)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contactMessages.createdAt))
    .limit(250);

  function chipHref(filterId: string) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (filterId !== "open") p.set("status", filterId);
    const s = p.toString();
    return `/admin/reports${s ? `?${s}` : ""}`;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111112]">Laporan</h1>
          <p className="mt-0.5 text-xs text-[#6b7280]">{rows.length} laporan</p>
        </div>
        <form method="get" action="/admin/reports" className="flex items-center gap-2">
          {status !== "open" && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Cari email / topik…"
            className="w-52 rounded border border-[#e4e5ea] bg-white px-3 py-1.5 text-sm placeholder:text-[#9ca3af] focus:border-[#111112] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded border border-[#e4e5ea] bg-white px-3 py-1.5 text-sm font-medium text-[#1b1c1f] hover:bg-[#f5f5f7]"
          >
            Cari
          </button>
        </form>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e4e5ea] bg-[#f5f5f7] px-4 py-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.id}
            href={chipHref(f.id)}
            className={`rounded border px-2 py-0.5 text-xs font-medium ${
              status === f.id
                ? "border-[#111112] bg-[#111112] text-white"
                : "border-[#e4e5ea] bg-white text-[#1b1c1f] hover:border-[#6b7280]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* List */}
      <div className="border border-[#e4e5ea] bg-white">
        <div className="divide-y divide-[#e4e5ea]">
          {rows.map((r) => {
            const excerpt = (r.message ?? "").trim().slice(0, 120) +
              ((r.message ?? "").trim().length > 120 ? "…" : "");

            return (
              <Link
                key={r.id}
                href={`/admin/reports/${r.id}`}
                className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-[#f5f5f7]"
              >
                {/* Left: sender + excerpt */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#111112]">{r.topic}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      r.status === "resolved" ? "bg-green-50 text-green-700"
                        : r.status === "spam" ? "bg-[#f5f5f7] text-[#6b7280]"
                          : "bg-amber-50 text-amber-700"
                    }`}>{r.status ?? "open"}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-[#6b7280]">
                    {r.name} · {r.email}
                  </div>
                  {excerpt && (
                    <div className="mt-1 truncate text-xs text-[#6b7280]">{excerpt}</div>
                  )}
                </div>

                {/* Right: time */}
                <div className="shrink-0 text-xs text-[#6b7280]">{fmt(r.createdAt)}</div>
              </Link>
            );
          })}

          {rows.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-[#6b7280]">
              Tidak ada laporan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
