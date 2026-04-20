import Link from "next/link";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { adminUpdateTransaction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { transactions, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

const FILTERS = [
  { id: "all",          label: "Semua" },
  { id: "pending",      label: "Pending" },
  { id: "paid",         label: "Paid" },
  { id: "failed",       label: "Failed" },
  { id: "pending_old",  label: "Pending > 1 jam" },
  { id: "paid_today",   label: "Paid hari ini" }
] as const;

type FilterId = typeof FILTERS[number]["id"];

export default async function AdminPaymentsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const q       = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim();
  const rawFilter = (Array.isArray(sp.filter) ? sp.filter[0] : sp.filter) ?? "";
  const filter: FilterId = (FILTERS.some((f) => f.id === rawFilter) ? rawFilter : "all") as FilterId;
  const fromRaw = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  const toRaw   = Array.isArray(sp.to)   ? sp.to[0]   : sp.to;
  const from    = fromRaw ? new Date(fromRaw) : null;
  const to      = toRaw   ? new Date(toRaw)   : null;

  const db = getDb();
  const now     = Date.now();
  const since1h = new Date(now - 60 * 60_000);
  const today   = new Date(new Date().setHours(0, 0, 0, 0));

  /* ── where ──────────────────────────────────────────────────── */
  const conditions = [];

  if (filter === "pending")      conditions.push(eq(transactions.status, "pending"));
  if (filter === "paid")         conditions.push(eq(transactions.status, "paid"));
  if (filter === "failed")       conditions.push(eq(transactions.status, "failed"));
  if (filter === "pending_old")  conditions.push(and(eq(transactions.status, "pending"), lte(transactions.createdAt, since1h))!);
  if (filter === "paid_today")   conditions.push(and(eq(transactions.status, "paid"), gte(transactions.paidAt, today))!);

  if (q) {
    conditions.push(
      sql`lower(${transactions.orderId}) like ${`%${q.toLowerCase()}%`} or lower(coalesce(${users.email}, '')) like ${`%${q.toLowerCase()}%`}`
    );
  }
  if (from && !Number.isNaN(from.getTime())) conditions.push(gte(transactions.createdAt, from));
  if (to   && !Number.isNaN(to.getTime()))   conditions.push(lte(transactions.createdAt, endOfDay(to)));

  const rows = await db
    .select({
      id:            transactions.id,
      orderId:       transactions.orderId,
      status:        transactions.status,
      paymentMethod: transactions.paymentMethod,
      package:       transactions.package,
      amount:        transactions.amount,
      tokens:        transactions.tokens,
      createdAt:     transactions.createdAt,
      paidAt:        transactions.paidAt,
      userId:        transactions.userId,
      userEmail:     users.email
    })
    .from(transactions)
    .leftJoin(users, eq(users.id, transactions.userId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.createdAt))
    .limit(300);

  const pendingOldCount = rows.filter(
    (r) => r.status === "pending" && r.createdAt && Date.now() - +new Date(r.createdAt) > 60 * 60_000
  ).length;

  function chipHref(filterId: string) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (filterId !== "all") p.set("filter", filterId);
    if (fromRaw) p.set("from", fromRaw);
    if (toRaw)   p.set("to", toRaw);
    const s = p.toString();
    return `/admin/payments${s ? `?${s}` : ""}`;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111112]">Payments</h1>
          <p className="mt-0.5 text-xs text-[#6b7280]">
            {rows.length} transaksi
            {pendingOldCount > 0 && (
              <span className="ml-2 font-semibold text-amber-700">· {pendingOldCount} pending &gt; 1 jam</span>
            )}
          </p>
        </div>
        {/* Search + date */}
        <form method="get" action="/admin/payments" className="flex items-center gap-2">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="orderId / email…"
            className="w-48 rounded border border-[#e4e5ea] bg-white px-3 py-1.5 text-sm placeholder:text-[#9ca3af] focus:border-[#111112] focus:outline-none"
          />
          <input
            type="date"
            name="from"
            defaultValue={fromRaw ?? ""}
            className="rounded border border-[#e4e5ea] bg-white px-2 py-1.5 text-sm focus:border-[#111112] focus:outline-none"
          />
          <input
            type="date"
            name="to"
            defaultValue={toRaw ?? ""}
            className="rounded border border-[#e4e5ea] bg-white px-2 py-1.5 text-sm focus:border-[#111112] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded border border-[#e4e5ea] bg-white px-3 py-1.5 text-sm font-medium text-[#1b1c1f] hover:bg-[#f5f5f7]"
          >
            Cari
          </button>
        </form>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e4e5ea] bg-[#f5f5f7] px-4 py-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={chipHref(f.id)}
            className={`rounded border px-2 py-0.5 text-xs font-medium ${
              filter === f.id
                ? "border-[#111112] bg-[#111112] text-white"
                : "border-[#e4e5ea] bg-white text-[#1b1c1f] hover:border-[#6b7280]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="border border-[#e4e5ea] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e4e5ea] bg-[#f5f5f7]">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Order</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">User</th>
                <th className="w-28 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Amount</th>
                <th className="w-28 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Status</th>
                <th className="w-36 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Waktu</th>
                <th className="w-36 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e5ea]">
              {rows.map((row) => {
                const isPendingOld =
                  row.status === "pending" &&
                  row.createdAt &&
                  Date.now() - +new Date(row.createdAt) > 60 * 60_000;

                return (
                  <tr key={row.id} className="hover:bg-[#f5f5f7]/60">
                    {/* Order */}
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-[#111112]">{row.orderId}</div>
                      <div className="text-xs text-[#6b7280]">
                        {row.tokens ?? 0} token · {row.package ?? "—"} · {row.paymentMethod ?? "—"}
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-4 py-2.5">
                      <div className="text-sm text-[#1b1c1f]">{row.userEmail ?? "—"}</div>
                      {row.userId && (
                        <Link
                          href={`/admin/users/${row.userId}`}
                          className="text-xs text-[#6b7280] hover:underline"
                        >
                          Lihat user →
                        </Link>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-2.5 text-right font-semibold text-[#111112]">
                      Rp {(row.amount ?? 0).toLocaleString("id-ID")}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          row.status === "paid"
                            ? "bg-green-50 text-green-700"
                            : row.status === "failed"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                        }`}>{row.status ?? "—"}</span>
                        {isPendingOld && (
                          <span className="text-[11px] font-semibold text-amber-700">lama</span>
                        )}
                      </div>
                    </td>

                    {/* Time */}
                    <td className="px-4 py-2.5 text-xs text-[#6b7280]">
                      <div>dibuat: {fmt(row.createdAt)}</div>
                      {row.paidAt && <div>paid: {fmt(row.paidAt)}</div>}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2.5">
                      {row.status === "pending" ? (
                        <div className="flex gap-1.5">
                          <form action={adminUpdateTransaction}>
                            <input type="hidden" name="transactionId" value={row.id} />
                            <input type="hidden" name="status" value="paid" />
                            <input type="hidden" name="paymentMethod" value={row.paymentMethod ?? "qris_static"} />
                            <button
                              type="submit"
                              onClick={(e) => {
                                if (!confirm(`Set PAID: ${row.orderId}?\nUser: ${row.userEmail ?? row.userId}`)) {
                                  e.preventDefault();
                                }
                              }}
                              className="rounded bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                            >
                              Set Paid
                            </button>
                          </form>
                          <form action={adminUpdateTransaction}>
                            <input type="hidden" name="transactionId" value={row.id} />
                            <input type="hidden" name="status" value="failed" />
                            <input type="hidden" name="paymentMethod" value={row.paymentMethod ?? "qris_static"} />
                            <button
                              type="submit"
                              onClick={(e) => {
                                if (!confirm(`Set FAILED: ${row.orderId}?`)) {
                                  e.preventDefault();
                                }
                              }}
                              className="rounded border border-[#e4e5ea] px-2.5 py-1 text-xs font-medium text-[#6b7280] hover:bg-[#f5f5f7]"
                            >
                              Set Failed
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-[#6b7280]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#6b7280]">
                    Tidak ada transaksi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[#e4e5ea] px-4 py-2 text-xs text-[#6b7280]">
          Menampilkan {rows.length} transaksi
        </div>
      </div>
    </div>
  );
}
