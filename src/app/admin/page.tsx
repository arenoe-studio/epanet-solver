import Link from "next/link";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { analyses, contactMessages, transactions, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

type AlertItem = {
  level: "danger" | "warn" | "info";
  title: string;
  detail: string;
  href: string;
  count: number;
};

export default async function AdminOverviewPage() {
  await requireAdmin();

  const db = getDb();
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60_000);
  const since7d  = new Date(now - 7 * 24 * 60 * 60_000);
  const since30m = new Date(now - 30 * 60_000);
  const since1h  = new Date(now - 60 * 60_000);
  const today    = new Date(new Date().setHours(0, 0, 0, 0));

  const [
    activeUsers7d,
    analyses24h,
    analyses7d,
    failed7d,
    stuckProcessing,
    paid7d,
    pendingOld,
    openReports,
    newUsersToday,
    paidToday
  ] = await Promise.all([
    db.select({ count: sql<number>`count(distinct ${analyses.userId})` })
      .from(analyses).where(gte(analyses.createdAt, since7d)).limit(1),

    db.select({ count: sql<number>`count(*)` })
      .from(analyses).where(gte(analyses.createdAt, since24h)).limit(1),

    db.select({ count: sql<number>`count(*)` })
      .from(analyses).where(gte(analyses.createdAt, since7d)).limit(1),

    db.select({ count: sql<number>`count(*)` })
      .from(analyses)
      .where(and(eq(analyses.status, "failed"), gte(analyses.createdAt, since7d)))
      .limit(1),

    db.select({ count: sql<number>`count(*)` })
      .from(analyses)
      .where(and(
        eq(analyses.status, "processing"),
        gte(analyses.createdAt, since7d),
        sql`${analyses.createdAt} < ${since30m}`
      ))
      .limit(1),

    db.select({
      count:  sql<number>`count(*)`,
      amount: sql<number>`coalesce(sum(${transactions.amount}), 0)`
    })
      .from(transactions)
      .where(and(eq(transactions.status, "paid"), gte(transactions.paidAt, since7d)))
      .limit(1),

    db.select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(eq(transactions.status, "pending"), sql`${transactions.createdAt} < ${since1h}`))
      .limit(1),

    db.select({ count: sql<number>`count(*)` })
      .from(contactMessages).where(eq(contactMessages.status, "open")).limit(1),

    db.select({ count: sql<number>`count(*)` })
      .from(users).where(gte(users.createdAt, today)).limit(1),

    db.select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(eq(transactions.status, "paid"), gte(transactions.paidAt, today)))
      .limit(1)
  ]);

  /* ── recent paid transactions ─────────────────────────────────── */
  const recentPaid = await db
    .select({
      id:            transactions.id,
      orderId:       transactions.orderId,
      tokens:        transactions.tokens,
      amount:        transactions.amount,
      paidAt:        transactions.paidAt,
      userEmail:     users.email
    })
    .from(transactions)
    .leftJoin(users, eq(users.id, transactions.userId))
    .where(and(eq(transactions.status, "paid"), gte(transactions.paidAt, today)))
    .orderBy(desc(transactions.paidAt))
    .limit(5);

  /* ── build alert list ─────────────────────────────────────────── */
  const alerts: AlertItem[] = [];

  const pendingOldCount  = pendingOld[0]?.count  ?? 0;
  const stuckCount       = stuckProcessing[0]?.count ?? 0;
  const openReportCount  = openReports[0]?.count  ?? 0;

  if (pendingOldCount > 0) alerts.push({
    level: "warn",
    title: "Pembayaran pending > 1 jam",
    detail: `${pendingOldCount} transaksi belum dikonfirmasi lebih dari 1 jam.`,
    href: "/admin/payments?filter=pending_old",
    count: pendingOldCount
  });

  if (stuckCount > 0) alerts.push({
    level: "warn",
    title: "Analisis terindikasi macet",
    detail: `${stuckCount} analisis masih berstatus "processing" selama > 30 menit.`,
    href: "/admin/health",
    count: stuckCount
  });

  if (openReportCount > 0) alerts.push({
    level: openReportCount >= 10 ? "warn" : "info",
    title: "Laporan belum ditangani",
    detail: `${openReportCount} laporan berstatus open.`,
    href: "/admin/reports?status=open",
    count: openReportCount
  });

  /* ── metrics ──────────────────────────────────────────────────── */
  const revenue7d    = paid7d[0]?.amount   ?? 0;
  const paidCount7d  = paid7d[0]?.count    ?? 0;
  const newUserCount = newUsersToday[0]?.count ?? 0;
  const paidTodayCount = paidToday[0]?.count ?? 0;

  const dotColor: Record<AlertItem["level"], string> = {
    danger: "bg-red-500",
    warn:   "bg-amber-400",
    info:   "bg-[#6b7280]"
  };
  const textColor: Record<AlertItem["level"], string> = {
    danger: "text-red-700",
    warn:   "text-amber-700",
    info:   "text-[#6b7280]"
  };

  return (
    <div className="space-y-5">
      {/* ── Metrics strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Aktif (7 hari)",     value: activeUsers7d[0]?.count  ?? 0 },
          { label: "Analisis (24 jam)",  value: analyses24h[0]?.count    ?? 0 },
          { label: "Transaksi paid (7h)", value: paidCount7d },
          { label: "Revenue (7 hari)",   value: `Rp ${revenue7d.toLocaleString("id-ID")}` }
        ].map((m) => (
          <div key={m.label} className="border border-[#e4e5ea] bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">{m.label}</div>
            <div className="mt-1 text-xl font-bold text-[#111112]">{m.value}</div>
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="space-y-4">
        <div className="space-y-4">

          {/* Perlu Aksi */}
          <div className="border border-[#e4e5ea] bg-white">
            <div className="border-b border-[#e4e5ea] px-4 py-3">
              <span className="text-sm font-semibold text-[#111112]">Perlu Aksi</span>
            </div>
            <div className="divide-y divide-[#e4e5ea]">
              {alerts.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-4 text-sm text-[#6b7280]">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Tidak ada yang perlu ditangani saat ini.
                </div>
              ) : (
                alerts.map((a) => (
                  <Link
                    key={a.title}
                    href={a.href}
                    className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-[#f5f5f7]"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor[a.level]}`} />
                      <div>
                        <div className={`text-sm font-medium ${textColor[a.level]}`}>{a.title}</div>
                        <div className="mt-0.5 text-xs text-[#6b7280]">{a.detail}</div>
                      </div>
                    </div>
                    <div className="shrink-0 rounded bg-[#f5f5f7] px-2 py-0.5 text-xs font-semibold text-[#1b1c1f]">
                      {a.count} →
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Hari ini */}
          <div className="border border-[#e4e5ea] bg-white">
            <div className="border-b border-[#e4e5ea] px-4 py-3 text-sm font-semibold text-[#111112]">
              Hari ini
            </div>
            <div className="divide-y divide-[#e4e5ea]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#1b1c1f]">User baru</span>
                <span className="text-sm font-semibold text-[#111112]">{newUserCount}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#1b1c1f]">Analyses (24 jam)</span>
                <span className="text-sm font-semibold text-[#111112]">{analyses24h[0]?.count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#1b1c1f]">Transaksi paid hari ini</span>
                <span className="text-sm font-semibold text-[#111112]">{paidTodayCount}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#1b1c1f]">Failed 7 hari</span>
                <span className={`text-sm font-semibold ${(failed7d[0]?.count ?? 0) > 0 ? "text-amber-700" : "text-[#111112]"}`}>
                  {failed7d[0]?.count ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Paid hari ini */}
          {recentPaid.length > 0 && (
            <div className="border border-[#e4e5ea] bg-white">
              <div className="flex items-center justify-between border-b border-[#e4e5ea] px-4 py-3">
                <span className="text-sm font-semibold text-[#111112]">Pembayaran paid hari ini</span>
                <Link href="/admin/payments?filter=paid_today" className="text-xs text-[#6b7280] hover:text-[#111112]">
                  Lihat semua →
                </Link>
              </div>
              <div className="divide-y divide-[#e4e5ea]">
                {recentPaid.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[#1b1c1f]">{t.userEmail ?? "—"}</div>
                      <div className="text-xs text-[#6b7280]">{t.orderId} · {t.tokens ?? 0} token · {fmt(t.paidAt)}</div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-[#111112]">
                      Rp {(t.amount ?? 0).toLocaleString("id-ID")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer timestamp */}
      <div className="text-[11px] text-[#6b7280]">
        Render: {fmt(new Date())}
      </div>
    </div>
  );
}
