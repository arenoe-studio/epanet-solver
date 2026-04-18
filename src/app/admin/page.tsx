import Link from "next/link";

import { desc, eq, gte, sql } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { analyses, contactMessages, tokenBalances, transactions, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const qRaw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = qRaw?.trim() ? qRaw.trim() : "";

  const db = getDb();

  const lastAnalysis = db
    .select({
      userId: analyses.userId,
      lastAnalysisAt: sql<Date | null>`max(${analyses.createdAt})`.as("lastAnalysisAt")
    })
    .from(analyses)
    .groupBy(analyses.userId)
    .as("last_analysis");

  const lastPaid = db
    .select({
      userId: transactions.userId,
      lastPaidAt: sql<Date | null>`max(${transactions.paidAt})`.as("lastPaidAt")
    })
    .from(transactions)
    .where(eq(transactions.status, "paid"))
    .groupBy(transactions.userId)
    .as("last_paid");

  const where =
    q.length > 0
      ? sql`lower(${users.email}) like ${`%${q.toLowerCase()}%`} or lower(coalesce(${users.name}, '')) like ${`%${q.toLowerCase()}%`}`
      : undefined;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      mfaEnabled: users.mfaEnabled,
      balance: tokenBalances.balance,
      totalBought: tokenBalances.totalBought,
      totalUsed: tokenBalances.totalUsed,
      lastAnalysisAt: lastAnalysis.lastAnalysisAt,
      lastPaidAt: lastPaid.lastPaidAt
    })
    .from(users)
    .leftJoin(tokenBalances, eq(tokenBalances.userId, users.id))
    .leftJoin(lastAnalysis, eq(lastAnalysis.userId, users.id))
    .leftJoin(lastPaid, eq(lastPaid.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(250);

  const verifiedCount = rows.filter((r) => !!r.emailVerified).length;
  const lowTokenCount = rows.filter((r) => (r.balance ?? 0) <= 2).length;

  const openReports = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(contactMessages)
    .where(eq(contactMessages.status, "open"))
    .limit(1);

  const activeSince = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const active7d = await db
    .select({ count: sql<number>`count(distinct ${analyses.userId})`.as("count") })
    .from(analyses)
    .where(gte(analyses.createdAt, activeSince))
    .limit(1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Aktif (7 hari)
            </div>
            <div className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
              {active7d[0]?.count ?? 0}
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Laporan Open
            </div>
            <div className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
              {openReports[0]?.count ?? 0}
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Token Rendah (≤ 2)
            </div>
            <div className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
              {lowTokenCount}
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Users</CardTitle>
            <div className="mt-1 text-sm text-slate-gray">
              Total: <span className="font-semibold text-near-black">{rows.length}</span> · Verified:{" "}
              <span className="font-semibold text-near-black">{verifiedCount}</span>
            </div>
          </div>
          <form className="w-full max-w-sm">
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari email / nama…"
              className="w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
            />
          </form>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Aktivitas</TableHead>
                <TableHead>Masuk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const balance = row.balance ?? 0;
                const low = balance <= 2;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-near-black">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <Link
                            href={`/admin/users/${row.id}`}
                            className="block truncate font-semibold text-expo-black hover:underline"
                          >
                            {row.email}
                          </Link>
                          <div className="mt-0.5 truncate text-xs text-slate-gray">
                            {row.name ?? "—"} · dibuat {fmt(row.createdAt)}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {row.emailVerified ? (
                            <Badge variant="outline">verified</Badge>
                          ) : (
                            <Badge className="bg-slate-gray text-white">unverified</Badge>
                          )}
                          {row.mfaEnabled ? <Badge variant="outline">mfa</Badge> : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${low ? "text-red-600" : "text-near-black"}`}>
                          {balance}
                        </span>
                        <span className="text-xs text-slate-gray">
                          (bought {row.totalBought ?? 0} · used {row.totalUsed ?? 0})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-slate-gray">
                        Analisis terakhir: <span className="text-near-black">{fmt(row.lastAnalysisAt)}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-gray">
                        Pembayaran terakhir: <span className="text-near-black">{fmt(row.lastPaidAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <code className="rounded bg-cloud-gray px-2 py-1 text-[11px] text-slate-gray">
                        {row.id}
                      </code>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-gray">
                    Tidak ada user.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
