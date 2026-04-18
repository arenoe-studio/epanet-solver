import Link from "next/link";
import { notFound } from "next/navigation";

import { and, desc, eq } from "drizzle-orm";

import { adminAdjustTokens, adminSetTokens, adminUpdateUser } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default async function AdminUserDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const db = getDb();
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      emailVerified: users.emailVerified,
      mfaEnabled: users.mfaEnabled,
      loginFailedCount: users.loginFailedCount,
      loginLockedUntil: users.loginLockedUntil
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  const user = userRows[0];
  if (!user) notFound();

  const balanceRows = await db
    .select({
      balance: tokenBalances.balance,
      totalBought: tokenBalances.totalBought,
      totalUsed: tokenBalances.totalUsed,
      updatedAt: tokenBalances.updatedAt
    })
    .from(tokenBalances)
    .where(eq(tokenBalances.userId, id))
    .limit(1);

  const bal = balanceRows[0] ?? null;

  const recentAnalyses = await db
    .select({
      id: analyses.id,
      kind: analyses.kind,
      status: analyses.status,
      tokensUsed: analyses.tokensUsed,
      createdAt: analyses.createdAt,
      fileName: analyses.fileName
    })
    .from(analyses)
    .where(eq(analyses.userId, id))
    .orderBy(desc(analyses.createdAt))
    .limit(10);

  const recentTx = await db
    .select({
      id: transactions.id,
      orderId: transactions.orderId,
      status: transactions.status,
      package: transactions.package,
      tokens: transactions.tokens,
      amount: transactions.amount,
      paymentMethod: transactions.paymentMethod,
      createdAt: transactions.createdAt,
      paidAt: transactions.paidAt
    })
    .from(transactions)
    .where(eq(transactions.userId, id))
    .orderBy(desc(transactions.createdAt))
    .limit(10);

  const recentReports = await db
    .select({
      id: contactMessages.id,
      topic: contactMessages.topic,
      status: contactMessages.status,
      createdAt: contactMessages.createdAt
    })
    .from(contactMessages)
    .where(eq(contactMessages.userId, id))
    .orderBy(desc(contactMessages.createdAt))
    .limit(8);

  const balance = bal?.balance ?? 0;
  const isLocked = !!(user.loginLockedUntil && user.loginLockedUntil > new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="text-sm font-semibold text-slate-gray hover:text-expo-black"
          >
            ← Kembali
          </Link>
          <Badge variant="outline">user</Badge>
          {user.emailVerified ? (
            <Badge variant="outline">verified</Badge>
          ) : (
            <Badge className="bg-slate-gray text-white">unverified</Badge>
          )}
          {user.mfaEnabled ? <Badge variant="outline">mfa</Badge> : null}
          {isLocked ? <Badge className="bg-red-600 text-white">locked</Badge> : null}
        </div>
        <div className="text-xs text-slate-gray">
          ID: <span className="font-mono text-[11px] text-near-black">{user.id}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  Email
                </div>
                <div className="mt-1 text-sm font-semibold text-expo-black">{user.email}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  Dibuat
                </div>
                <div className="mt-1 text-sm text-near-black">{fmt(user.createdAt)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  Verified
                </div>
                <div className="mt-1 text-sm text-near-black">{user.emailVerified ? fmt(user.emailVerified) : "—"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  Login Fail
                </div>
                <div className="mt-1 text-sm text-near-black">
                  {user.loginFailedCount} {user.loginLockedUntil ? `· locked until ${fmt(user.loginLockedUntil)}` : ""}
                </div>
              </div>
            </div>

            <form action={adminUpdateUser} className="grid gap-3 rounded-2xl border border-border-lavender bg-cloud-gray/30 p-4 sm:grid-cols-3">
              <input type="hidden" name="userId" value={user.id} />
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  Nama
                </label>
                <input
                  name="name"
                  defaultValue={user.name ?? ""}
                  placeholder="Nama user…"
                  className="mt-1.5 w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  Verified
                </label>
                <select
                  name="verified"
                  defaultValue={user.emailVerified ? "yes" : "no"}
                  className="mt-1.5 w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="sm:col-span-3 flex justify-end">
                <Button type="submit" variant="outline">Simpan Profil</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">Balance</div>
                <div className={`mt-1 text-3xl font-bold tracking-[-0.04em] ${balance <= 2 ? "text-red-600" : "text-expo-black"}`}>
                  {balance}
                </div>
                <div className="mt-1 text-xs text-slate-gray">
                  bought {bal?.totalBought ?? 0} · used {bal?.totalUsed ?? 0}
                  {bal?.updatedAt ? ` · updated ${fmt(bal.updatedAt)}` : ""}
                </div>
              </div>
            </div>

            <form action={adminAdjustTokens} className="space-y-3 rounded-2xl border border-border-lavender bg-cloud-gray/30 p-4">
              <input type="hidden" name="userId" value={user.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                    Aksi
                  </label>
                  <select
                    name="kind"
                    defaultValue="grant"
                    className="mt-1.5 w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                  >
                    <option value="grant">Tambah (grant)</option>
                    <option value="refund">Refund (kembalikan)</option>
                    <option value="revoke">Kurangi (revoke)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                    Jumlah
                  </label>
                  <input
                    name="amount"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="mis. 10"
                    className="mt-1.5 w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  Catatan (opsional)
                </label>
                <input
                  name="note"
                  placeholder="contoh: goodwill refund, kompensasi bug…"
                  className="mt-1.5 w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                />
              </div>
              <Button type="submit" className="w-full">Jalankan</Button>
            </form>

            <form action={adminSetTokens} className="space-y-3 rounded-2xl border border-border-lavender bg-white p-4">
              <input type="hidden" name="userId" value={user.id} />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  Set balance
                </label>
                <input
                  name="newBalance"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="mis. 0"
                  className="mt-1.5 w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  Catatan (opsional)
                </label>
                <input
                  name="note"
                  placeholder="contoh: reset karena abuse…"
                  className="mt-1.5 w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                />
              </div>
              <Button type="submit" variant="outline" className="w-full">Set</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Analisis Terbaru</CardTitle>
            <Badge variant="outline">{recentAnalyses.length}</Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Waktu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAnalyses.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs text-near-black">{a.id}</TableCell>
                    <TableCell className="text-xs text-near-black">{a.kind}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline">{a.status ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-near-black">{a.tokensUsed ?? 0}</TableCell>
                    <TableCell className="text-xs">{fmt(a.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {recentAnalyses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-gray">
                      Belum ada analisis.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Transaksi Terbaru</CardTitle>
            <Badge variant="outline">{recentTx.length}</Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[780px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTx.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-near-black">
                      <div className="font-semibold">{t.orderId}</div>
                      <div className="mt-0.5 text-[11px] text-slate-gray">
                        {t.package ?? "—"} · {t.paymentMethod ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline">{t.status ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-near-black">{t.tokens ?? 0}</TableCell>
                    <TableCell className="text-xs text-near-black">{t.amount ?? 0}</TableCell>
                    <TableCell className="text-xs">{fmt(t.paidAt)}</TableCell>
                  </TableRow>
                ))}
                {recentTx.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-gray">
                      Belum ada transaksi.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Laporan dari user ini</CardTitle>
          <Link
            href="/admin/reports"
            className="text-sm font-semibold text-slate-gray hover:text-expo-black"
          >
            Lihat semua →
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Topik</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentReports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-near-black">{r.id}</TableCell>
                  <TableCell className="text-sm text-near-black">
                    <Link href={`/admin/reports/${r.id}`} className="font-semibold hover:underline">
                      {r.topic}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline">{r.status ?? "open"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{fmt(r.createdAt)}</TableCell>
                </TableRow>
              ))}
              {recentReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-gray">
                    Belum ada laporan yang terhubung ke user ini.
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

