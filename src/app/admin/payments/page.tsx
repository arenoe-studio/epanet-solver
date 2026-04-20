import Link from "next/link";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

function statusBadge(status: string | null | undefined) {
  if (status === "paid") return <Badge variant="outline">paid</Badge>;
  if (status === "failed") return <Badge className="bg-red-600 text-white">failed</Badge>;
  return <Badge className="bg-amber-500 text-white">pending</Badge>;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default async function AdminPaymentsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const qRaw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = qRaw?.trim() ? qRaw.trim() : "";
  const statusRaw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const status =
    statusRaw === "pending" || statusRaw === "paid" || statusRaw === "failed"
      ? statusRaw
      : "all";

  const fromRaw = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  const toRaw = Array.isArray(sp.to) ? sp.to[0] : sp.to;
  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(toRaw) : null;

  const db = getDb();

  const whereParts = [];
  if (status !== "all") whereParts.push(eq(transactions.status, status));
  if (q.length > 0) {
    whereParts.push(
      sql`lower(${transactions.orderId}) like ${`%${q.toLowerCase()}%`} or lower(coalesce(${users.email}, '')) like ${`%${q.toLowerCase()}%`}`
    );
  }
  if (from && !Number.isNaN(from.getTime())) {
    whereParts.push(gte(transactions.createdAt, from));
  }
  if (to && !Number.isNaN(to.getTime())) {
    whereParts.push(lte(transactions.createdAt, endOfDay(to)));
  }

  const where = whereParts.length > 0 ? and(...whereParts) : undefined;

  const rows = await db
    .select({
      id: transactions.id,
      orderId: transactions.orderId,
      status: transactions.status,
      paymentMethod: transactions.paymentMethod,
      amount: transactions.amount,
      tokens: transactions.tokens,
      createdAt: transactions.createdAt,
      paidAt: transactions.paidAt,
      userId: transactions.userId,
      userEmail: users.email
    })
    .from(transactions)
    .leftJoin(users, eq(users.id, transactions.userId))
    .where(where)
    .orderBy(desc(transactions.createdAt))
    .limit(250);

  const pendingOld = rows.filter((r) => r.status === "pending" && r.createdAt && Date.now() - +new Date(r.createdAt) > 60 * 60_000)
    .length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-gray">
            Admin
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
            Payments
          </h1>
          <div className="mt-1 text-xs text-slate-gray">
            Total: <span className="font-semibold text-near-black">{rows.length}</span>
            {pendingOld > 0 ? (
              <>
                {" "}· <span className="font-semibold text-amber-700">{pendingOld} pending &gt; 1 jam</span>
              </>
            ) : null}
          </div>
        </div>
        <Link
          href="/admin"
          className="hidden rounded-xl border border-border-lavender bg-white px-3 py-2 text-sm font-semibold text-near-black transition hover:bg-cloud-gray active:scale-[0.98] sm:inline-flex"
        >
          Overview
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <div className="mt-1 text-sm text-slate-gray">
              Filter cepat untuk pending/paid/failed + pencarian orderId/email.
            </div>
          </div>
          <form className="grid w-full gap-2 sm:w-auto sm:grid-cols-4 sm:items-end">
            <div className="sm:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                Search
              </div>
              <input
                name="q"
                defaultValue={q}
                placeholder="orderId / email…"
                className="mt-1 w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
              />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                Status
              </div>
              <select
                name="status"
                defaultValue={status}
                className="mt-1 w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
              >
                <option value="all">all</option>
                <option value="pending">pending</option>
                <option value="paid">paid</option>
                <option value="failed">failed</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  From
                </div>
                <input
                  type="date"
                  name="from"
                  defaultValue={fromRaw ?? ""}
                  className="mt-1 w-full rounded-xl border border-input-border bg-white px-3 py-2.5 text-sm text-expo-black outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  To
                </div>
                <input
                  type="date"
                  name="to"
                  defaultValue={toRaw ?? ""}
                  className="mt-1 w-full rounded-xl border border-input-border bg-white px-3 py-2.5 text-sm text-expo-black outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                />
              </div>
            </div>
          </form>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const createdAt = row.createdAt ? new Date(row.createdAt) : null;
                const isPendingOld =
                  row.status === "pending" &&
                  createdAt &&
                  Date.now() - +createdAt > 60 * 60_000;

                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-near-black">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-expo-black">
                          {row.orderId}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-gray">
                          tokens {row.tokens ?? 0} · method {row.paymentMethod ?? "—"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="truncate text-near-black">
                        {row.userEmail ?? "—"}
                      </div>
                      {row.userId ? (
                        <Link
                          href={`/admin/users/${row.userId}`}
                          className="mt-0.5 inline-block truncate text-xs text-link-cobalt hover:underline"
                        >
                          {row.userId}
                        </Link>
                      ) : (
                        <div className="mt-0.5 text-xs text-slate-gray">—</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-near-black">
                        Rp {(row.amount ?? 0).toLocaleString("id-ID")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusBadge(row.status)}
                        {isPendingOld ? (
                          <span className="text-xs font-semibold text-amber-700">
                            pending lama
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-gray">
                      <div>
                        dibuat: <span className="text-near-black">{fmt(row.createdAt)}</span>
                      </div>
                      <div className="mt-0.5">
                        paid: <span className="text-near-black">{fmt(row.paidAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <form action={adminUpdateTransaction} className="flex items-center gap-2">
                        <input type="hidden" name="transactionId" value={row.id} />
                        <select
                          name="status"
                          defaultValue={(row.status as any) ?? "pending"}
                          className="rounded-xl border border-input-border bg-white px-2.5 py-2 text-sm text-expo-black outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                        >
                          <option value="pending">pending</option>
                          <option value="paid">paid</option>
                          <option value="failed">failed</option>
                        </select>
                        <input
                          name="paymentMethod"
                          defaultValue={row.paymentMethod ?? ""}
                          placeholder="method…"
                          className="w-40 rounded-xl border border-input-border bg-white px-3 py-2 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-expo-black px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                        >
                          Save
                        </button>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}

              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-gray">
                    Tidak ada transaksi.
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

