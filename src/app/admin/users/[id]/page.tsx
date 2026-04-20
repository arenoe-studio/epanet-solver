import Link from "next/link";
import { notFound } from "next/navigation";

import { and, desc, eq } from "drizzle-orm";

import {
  adminAdjustTokens,
  adminUpdateTransaction,
  adminUpdateUser
} from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { analyses, contactMessages, tokenBalances, transactions, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

const inputCls =
  "w-full rounded border border-[#e4e5ea] bg-white px-3 py-2 text-sm text-[#1b1c1f] focus:border-[#111112] focus:outline-none";

const labelCls = "block text-[11px] font-semibold uppercase tracking-widest text-[#6b7280] mb-1";

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

  const [balanceRows, recentAnalyses, recentTx, recentReports] = await Promise.all([
    db.select({
      balance: tokenBalances.balance,
      totalBought: tokenBalances.totalBought,
      totalUsed: tokenBalances.totalUsed,
      updatedAt: tokenBalances.updatedAt
    })
      .from(tokenBalances)
      .where(eq(tokenBalances.userId, id))
      .limit(1),

    db.select({
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
      .limit(20),

    db.select({
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
      .limit(20),

    db.select({
      id: contactMessages.id,
      topic: contactMessages.topic,
      status: contactMessages.status,
      createdAt: contactMessages.createdAt
    })
      .from(contactMessages)
      .where(eq(contactMessages.userId, id))
      .orderBy(desc(contactMessages.createdAt))
      .limit(10)
  ]);

  const bal = balanceRows[0] ?? null;
  const balance = bal?.balance ?? 0;
  const isLocked = !!(user.loginLockedUntil && user.loginLockedUntil > new Date());

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/users" className="text-xs text-[#6b7280] hover:text-[#111112]">
            ← Kembali ke Users
          </Link>
          <h1 className="mt-1 text-xl font-bold text-[#111112]">{user.email}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            {user.emailVerified ? (
              <span className="rounded bg-green-50 px-1.5 py-0.5 font-medium text-green-700">verified</span>
            ) : (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">unverified</span>
            )}
            {user.mfaEnabled && (
              <span className="rounded bg-[#f5f5f7] px-1.5 py-0.5 font-medium text-[#6b7280]">mfa</span>
            )}
            {isLocked && (
              <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700">locked</span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-[#6b7280]">
          ID: <code className="font-mono text-[#1b1c1f]">{user.id}</code>
        </div>
      </div>

      {/* Two-column top section */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile */}
        <div className="border border-[#e4e5ea] bg-white lg:col-span-2">
          <div className="border-b border-[#e4e5ea] px-4 py-3 text-sm font-semibold text-[#111112]">Profil</div>
          <div className="px-4 py-4 space-y-4">
            {/* Info grid */}
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <div className={labelCls}>Email</div>
                <div className="text-sm font-medium text-[#111112]">{user.email}</div>
              </div>
              <div>
                <div className={labelCls}>Dibuat</div>
                <div className="text-sm text-[#1b1c1f]">{fmt(user.createdAt)}</div>
              </div>
              <div>
                <div className={labelCls}>Email verified</div>
                <div className="text-sm text-[#1b1c1f]">{user.emailVerified ? fmt(user.emailVerified) : "Belum"}</div>
              </div>
              <div>
                <div className={labelCls}>Login fail · lock</div>
                <div className="text-sm text-[#1b1c1f]">
                  {user.loginFailedCount} kali{user.loginLockedUntil ? ` · locked s/d ${fmt(user.loginLockedUntil)}` : ""}
                </div>
              </div>
            </div>

            {/* Edit form */}
            <form action={adminUpdateUser} className="grid gap-3 border-t border-[#e4e5ea] pt-4 sm:grid-cols-3">
              <input type="hidden" name="userId" value={user.id} />
              <div className="sm:col-span-2">
                <label className={labelCls}>Nama</label>
                <input name="name" defaultValue={user.name ?? ""} placeholder="Nama user…" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Verified</label>
                <select name="verified" defaultValue={user.emailVerified ? "yes" : "no"} className={inputCls}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="sm:col-span-3 flex justify-end">
                <button type="submit" className="rounded border border-[#e4e5ea] px-4 py-2 text-sm font-medium text-[#1b1c1f] hover:bg-[#f5f5f7]">
                  Simpan Profil
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Token */}
        <div className="border border-[#e4e5ea] bg-white">
          <div className="border-b border-[#e4e5ea] px-4 py-3 text-sm font-semibold text-[#111112]">Token</div>
          <div className="px-4 py-4 space-y-4">
            <div>
              <div className={labelCls}>Balance</div>
              <div className={`text-3xl font-bold ${balance <= 2 ? "text-red-600" : "text-[#111112]"}`}>{balance}</div>
              <div className="mt-1 text-xs text-[#6b7280]">
                dibeli {bal?.totalBought ?? 0} · dipakai {bal?.totalUsed ?? 0}
                {bal?.updatedAt ? ` · ${fmt(bal.updatedAt)}` : ""}
              </div>
            </div>

            <form action={adminAdjustTokens} className="space-y-2 border-t border-[#e4e5ea] pt-4">
              <input type="hidden" name="userId" value={user.id} />
              <div className="flex gap-2">
                <select name="kind" defaultValue="grant" className={inputCls}>
                  <option value="grant">Tambah (grant)</option>
                  <option value="refund">Refund</option>
                  <option value="revoke">Kurangi (revoke)</option>
                </select>
                <input name="amount" type="number" min={1} step={1} placeholder="N" required className="w-20 shrink-0 rounded border border-[#e4e5ea] bg-white px-3 py-2 text-sm focus:border-[#111112] focus:outline-none" />
              </div>
              <input name="note" placeholder="Catatan opsional…" className={inputCls} />
              <button type="submit" className="w-full rounded bg-[#111112] px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
                Jalankan
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Analyses */}
      <div className="mt-4 border border-[#e4e5ea] bg-white">
        <div className="flex items-center justify-between border-b border-[#e4e5ea] px-4 py-3">
          <span className="text-sm font-semibold text-[#111112]">Analisis ({recentAnalyses.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#e4e5ea] bg-[#f5f5f7]">
                <th className="px-4 py-2 text-left font-semibold uppercase tracking-widest text-[#6b7280]">ID</th>
                <th className="px-4 py-2 text-left font-semibold uppercase tracking-widest text-[#6b7280]">Kind</th>
                <th className="px-4 py-2 text-left font-semibold uppercase tracking-widest text-[#6b7280]">Status</th>
                <th className="px-4 py-2 text-right font-semibold uppercase tracking-widest text-[#6b7280]">Token</th>
                <th className="px-4 py-2 text-left font-semibold uppercase tracking-widest text-[#6b7280]">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e5ea]">
              {recentAnalyses.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 font-mono text-[11px] text-[#6b7280]">{String(a.id)}</td>
                  <td className="px-4 py-2 text-[#1b1c1f]">{a.kind ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      a.status === "completed" ? "bg-green-50 text-green-700"
                        : a.status === "failed" ? "bg-red-50 text-red-700"
                          : "bg-[#f5f5f7] text-[#6b7280]"
                    }`}>{a.status ?? "—"}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-[#1b1c1f]">{a.tokensUsed ?? 0}</td>
                  <td className="px-4 py-2 text-[#6b7280]">{fmt(a.createdAt)}</td>
                </tr>
              ))}
              {recentAnalyses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#6b7280]">Belum ada analisis.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions */}
      <div className="mt-4 border border-[#e4e5ea] bg-white">
        <div className="flex items-center justify-between border-b border-[#e4e5ea] px-4 py-3">
          <span className="text-sm font-semibold text-[#111112]">Transaksi ({recentTx.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#e4e5ea] bg-[#f5f5f7]">
                <th className="px-4 py-2 text-left font-semibold uppercase tracking-widest text-[#6b7280]">Order</th>
                <th className="px-4 py-2 text-left font-semibold uppercase tracking-widest text-[#6b7280]">Status</th>
                <th className="px-4 py-2 text-right font-semibold uppercase tracking-widest text-[#6b7280]">Token</th>
                <th className="px-4 py-2 text-right font-semibold uppercase tracking-widest text-[#6b7280]">Amount</th>
                <th className="px-4 py-2 text-left font-semibold uppercase tracking-widest text-[#6b7280]">Paid</th>
                <th className="px-4 py-2 text-left font-semibold uppercase tracking-widest text-[#6b7280]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e5ea]">
              {recentTx.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-[#1b1c1f]">{t.orderId}</div>
                    <div className="text-[11px] text-[#6b7280]">{t.package ?? "—"} · {t.paymentMethod ?? "—"}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      t.status === "paid" ? "bg-green-50 text-green-700"
                        : t.status === "failed" ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                    }`}>{t.status ?? "—"}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-[#1b1c1f]">{t.tokens ?? 0}</td>
                  <td className="px-4 py-2 text-right text-[#1b1c1f]">{(t.amount ?? 0).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-2 text-[#6b7280]">{fmt(t.paidAt)}</td>
                  <td className="px-4 py-2">
                    {t.status === "pending" ? (
                      <div className="flex gap-1.5">
                        <form action={adminUpdateTransaction}>
                          <input type="hidden" name="transactionId" value={t.id} />
                          <input type="hidden" name="status" value="paid" />
                          <input type="hidden" name="paymentMethod" value={t.paymentMethod ?? "qris_static"} />
                          <button type="submit" className="rounded bg-green-600 px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90">Set Paid</button>
                        </form>
                        <form action={adminUpdateTransaction}>
                          <input type="hidden" name="transactionId" value={t.id} />
                          <input type="hidden" name="status" value="failed" />
                          <input type="hidden" name="paymentMethod" value={t.paymentMethod ?? "qris_static"} />
                          <button type="submit" className="rounded border border-[#e4e5ea] px-2 py-1 text-[11px] font-medium text-[#6b7280] hover:bg-[#f5f5f7]">Set Failed</button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-[#6b7280]">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {recentTx.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#6b7280]">Belum ada transaksi.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reports */}
      {recentReports.length > 0 && (
        <div className="mt-4 border border-[#e4e5ea] bg-white">
          <div className="flex items-center justify-between border-b border-[#e4e5ea] px-4 py-3">
            <span className="text-sm font-semibold text-[#111112]">Laporan ({recentReports.length})</span>
            <Link href="/admin/reports" className="text-xs text-[#6b7280] hover:text-[#111112]">Lihat semua →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#e4e5ea] bg-[#f5f5f7]">
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-widest text-[#6b7280]">Topik</th>
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-widest text-[#6b7280]">Status</th>
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-widest text-[#6b7280]">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e5ea]">
                {recentReports.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      <Link href={`/admin/reports/${r.id}`} className="font-medium text-[#1b1c1f] hover:underline">
                        {r.topic}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        r.status === "resolved" ? "bg-green-50 text-green-700"
                          : r.status === "spam" ? "bg-[#f5f5f7] text-[#6b7280]"
                            : "bg-amber-50 text-amber-700"
                      }`}>{r.status ?? "open"}</span>
                    </td>
                    <td className="px-4 py-2 text-[#6b7280]">{fmt(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
