import Link from "next/link";
import { redirect } from "next/navigation";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { analyses, contactMessages, transactions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

type AlertLevel = "ok" | "warn" | "down";

export default async function AdminOverviewPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = searchParams ? await searchParams : null;
  const qRaw = sp ? (Array.isArray(sp.q) ? sp.q[0] : sp.q) : undefined;
  const q = qRaw?.trim() ? qRaw.trim() : "";
  if (q) {
    redirect(`/admin/users?q=${encodeURIComponent(q)}`);
  }

  const db = getDb();

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60_000);
  const since7d = new Date(now - 7 * 24 * 60 * 60_000);
  const since30m = new Date(now - 30 * 60_000);
  const since1h = new Date(now - 60 * 60_000);

  const active7d = await db
    .select({ count: sql<number>`count(distinct ${analyses.userId})`.as("count") })
    .from(analyses)
    .where(gte(analyses.createdAt, since7d))
    .limit(1);

  const analyses24h = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(analyses)
    .where(gte(analyses.createdAt, since24h))
    .limit(1);

  const analyses7d = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(analyses)
    .where(gte(analyses.createdAt, since7d))
    .limit(1);

  const failed7d = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(analyses)
    .where(and(eq(analyses.status, "failed"), gte(analyses.createdAt, since7d)))
    .limit(1);

  const stuckProcessing = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(analyses)
    .where(and(eq(analyses.status, "processing"), gte(analyses.createdAt, since7d), sql`${analyses.createdAt} < ${since30m}`))
    .limit(1);

  const paid7d = await db
    .select({
      count: sql<number>`count(*)`.as("count"),
      amount: sql<number | null>`coalesce(sum(${transactions.amount}), 0)`.as("amount")
    })
    .from(transactions)
    .where(and(eq(transactions.status, "paid"), gte(transactions.paidAt, since7d)))
    .limit(1);

  const pendingOld = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(transactions)
    .where(and(eq(transactions.status, "pending"), sql`${transactions.createdAt} < ${since1h}`))
    .limit(1);

  const openReports = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(contactMessages)
    .where(eq(contactMessages.status, "open"))
    .limit(1);

  const alerts: Array<{
    level: AlertLevel;
    title: string;
    detail: string;
    href: string;
  }> = [];

  const pendingOldCount = pendingOld[0]?.count ?? 0;
  if (pendingOldCount > 0) {
    alerts.push({
      level: "warn",
      title: "Pembayaran pending lama",
      detail: `${pendingOldCount} transaksi pending > 1 jam.`,
      href: "/admin/payments?status=pending"
    });
  }

  const stuckCount = stuckProcessing[0]?.count ?? 0;
  if (stuckCount > 0) {
    alerts.push({
      level: "warn",
      title: "Analisis terindikasi macet",
      detail: `${stuckCount} analysis status processing > 30 menit.`,
      href: "/admin/health"
    });
  }

  const openReportCount = openReports[0]?.count ?? 0;
  if (openReportCount >= 10) {
    alerts.push({
      level: "warn",
      title: "Banyak laporan belum ditangani",
      detail: `${openReportCount} laporan masih open.`,
      href: "/admin/reports"
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      level: "ok",
      title: "Semuanya terlihat normal",
      detail: `Terakhir dicek: ${fmt(new Date())}`,
      href: "/admin/health"
    });
  }

  function levelBadge(level: AlertLevel) {
    if (level === "ok") return <Badge variant="outline">ok</Badge>;
    if (level === "down") return <Badge className="bg-red-600 text-white">down</Badge>;
    return <Badge className="bg-amber-500 text-white">warn</Badge>;
  }

  const revenue7d = paid7d[0]?.amount ?? 0;
  const paidCount7d = paid7d[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-gray">
            Admin
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
            Overview
          </h1>
          <div className="mt-1 text-xs text-slate-gray">
            Ringkasan cepat untuk operasional aplikasi.
          </div>
        </div>
        <Link
          href="/admin/health"
          className="rounded-xl border border-border-lavender bg-white px-3 py-2 text-sm font-semibold text-near-black transition hover:bg-cloud-gray active:scale-[0.98]"
        >
          Refresh status
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Active Users (7d)
            </div>
            <div className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
              {active7d[0]?.count ?? 0}
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Analyses (24h / 7d)
            </div>
            <div className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
              {analyses24h[0]?.count ?? 0} / {analyses7d[0]?.count ?? 0}
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Failed (7d)
            </div>
            <div className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
              {failed7d[0]?.count ?? 0}
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Revenue (7d)
            </div>
            <div className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
              Rp {revenue7d.toLocaleString("id-ID")}
            </div>
            <div className="mt-1 text-xs text-slate-gray">
              {paidCount7d} transaksi paid
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-expo-black">Alerts</div>
              <Link href="/admin/health" className="text-sm text-link-cobalt hover:underline">
                Health
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a) => (
              <Link
                key={`${a.title}-${a.href}`}
                href={a.href}
                className="block rounded-2xl border border-border-lavender bg-white px-4 py-3 transition hover:bg-cloud-gray"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-expo-black">
                      {a.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-gray">{a.detail}</div>
                  </div>
                  <div className="shrink-0">{levelBadge(a.level)}</div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold text-expo-black">Quick Links</div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {[
              { href: "/admin/users", label: "Users" },
              { href: "/admin/payments", label: "Payments" },
              { href: "/admin/reports", label: "Laporan" },
              { href: "/admin/ledger", label: "Token Log" }
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-2xl border border-border-lavender bg-white px-4 py-3 text-sm font-semibold text-near-black transition hover:bg-cloud-gray"
              >
                {l.label}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-slate-gray">
        Terakhir render: <span className="text-near-black">{fmt(new Date())}</span>
      </div>
    </div>
  );
}
