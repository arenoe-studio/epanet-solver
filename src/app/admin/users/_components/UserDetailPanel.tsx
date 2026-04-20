"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { adminAdjustTokens, adminUpdateTransaction } from "@/app/admin/actions";

function fmt(dt: Date | string | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export type PanelUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: Date | null;
  mfaEnabled: boolean | null;
  loginLockedUntil: Date | null;
  balance: number;
  totalBought: number;
  totalUsed: number;
  recentAnalyses: {
    id: number;
    kind: string | null;
    status: string | null;
    tokensUsed: number | null;
    createdAt: Date | null;
  }[];
  recentTransactions: {
    id: number;
    orderId: string;
    status: string | null;
    tokens: number | null;
    amount: number | null;
    paymentMethod: string | null;
    createdAt: Date | null;
    paidAt: Date | null;
  }[];
};

export function UserDetailPanel({
  user,
  closeHref
}: {
  user: PanelUser;
  closeHref: string;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const isLocked = !!(user.loginLockedUntil && new Date(user.loginLockedUntil) > new Date());

  /* close on Esc */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, closeHref]);

  /* trap focus */
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <>
      {/* Backdrop (desktop: subtle, mobile: full) */}
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Tutup detail"
        className="fixed inset-0 z-30 bg-black/10 lg:bg-transparent"
      />

      {/* Panel — right drawer desktop, bottom sheet mobile */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="
          fixed z-40 bg-white outline-none
          border-t border-l border-[#e4e5ea]
          bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto
          lg:bottom-auto lg:top-0 lg:left-auto lg:right-0 lg:h-full lg:w-[400px] lg:max-h-none
        "
        role="complementary"
        aria-label={`Detail user ${user.email}`}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pb-1 pt-2 lg:hidden">
          <div className="h-1 w-10 rounded-full bg-[#e4e5ea]" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#e4e5ea] px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[#111112]">{user.email}</div>
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {user.emailVerified ? (
                <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">verified</span>
              ) : (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">unverified</span>
              )}
              {user.mfaEnabled && (
                <span className="rounded bg-[#f5f5f7] px-1.5 py-0.5 text-[11px] font-medium text-[#6b7280]">mfa</span>
              )}
              {isLocked && (
                <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">locked</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/admin/users/${user.id}`}
              className="rounded border border-[#e4e5ea] px-2 py-1 text-xs font-medium text-[#6b7280] hover:bg-[#f5f5f7]"
            >
              Detail →
            </Link>
            <Link
              href={closeHref}
              scroll={false}
              aria-label="Tutup"
              className="rounded border border-[#e4e5ea] px-2 py-1 text-xs font-medium text-[#6b7280] hover:bg-[#f5f5f7]"
            >
              ✕
            </Link>
          </div>
        </div>

        {/* Token balance */}
        <div className="border-b border-[#e4e5ea] px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#6b7280]">Token</span>
            <span className={`text-lg font-bold ${user.balance <= 2 ? "text-red-600" : "text-[#111112]"}`}>
              {user.balance}
            </span>
          </div>
          <div className="mb-3 text-[11px] text-[#6b7280]">
            Dibeli: {user.totalBought} · Dipakai: {user.totalUsed}
          </div>

          {/* Token adjust form */}
          <form action={adminAdjustTokens} className="space-y-2">
            <input type="hidden" name="userId" value={user.id} />
            <div className="flex gap-2">
              <select
                name="kind"
                defaultValue="grant"
                className="flex-1 rounded border border-[#e4e5ea] bg-white px-2 py-1.5 text-xs text-[#1b1c1f] focus:border-[#111112] focus:outline-none"
              >
                <option value="grant">Tambah</option>
                <option value="refund">Refund</option>
                <option value="revoke">Kurangi</option>
              </select>
              <input
                name="amount"
                type="number"
                min={1}
                step={1}
                placeholder="Jumlah"
                required
                className="w-20 rounded border border-[#e4e5ea] bg-white px-2 py-1.5 text-xs text-[#1b1c1f] focus:border-[#111112] focus:outline-none"
              />
            </div>
            <input
              name="note"
              placeholder="Catatan (opsional)"
              className="w-full rounded border border-[#e4e5ea] bg-white px-2 py-1.5 text-xs text-[#1b1c1f] focus:border-[#111112] focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded bg-[#111112] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Jalankan
            </button>
          </form>
        </div>

        {/* Recent analyses */}
        <div className="border-b border-[#e4e5ea] px-4 py-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#6b7280]">
            Analisis (5 terbaru)
          </div>
          {user.recentAnalyses.length === 0 ? (
            <div className="text-xs text-[#6b7280]">Belum ada analisis.</div>
          ) : (
            <div className="divide-y divide-[#e4e5ea]">
              {user.recentAnalyses.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] text-[#6b7280]">{a.kind ?? "—"}</div>
                    <div className="text-[11px] text-[#6b7280]">{fmt(a.createdAt)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-[#6b7280]">{a.tokensUsed ?? 0} tk</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      a.status === "completed"
                        ? "bg-green-50 text-green-700"
                        : a.status === "failed"
                          ? "bg-red-50 text-red-700"
                          : "bg-[#f5f5f7] text-[#6b7280]"
                    }`}>{a.status ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="px-4 py-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#6b7280]">
            Transaksi (5 terbaru)
          </div>
          {user.recentTransactions.length === 0 ? (
            <div className="text-xs text-[#6b7280]">Belum ada transaksi.</div>
          ) : (
            <div className="divide-y divide-[#e4e5ea]">
              {user.recentTransactions.map((t) => (
                <div key={t.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-[#1b1c1f]">{t.orderId}</div>
                      <div className="text-[11px] text-[#6b7280]">
                        {t.tokens ?? 0} token · Rp{(t.amount ?? 0).toLocaleString("id-ID")} · {fmt(t.createdAt)}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      t.status === "paid"
                        ? "bg-green-50 text-green-700"
                        : t.status === "failed"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                    }`}>{t.status ?? "—"}</span>
                  </div>
                  {t.status === "pending" && (
                    <div className="mt-1.5 flex gap-2">
                      <form action={adminUpdateTransaction}>
                        <input type="hidden" name="transactionId" value={t.id} />
                        <input type="hidden" name="status" value="paid" />
                        <input type="hidden" name="paymentMethod" value={t.paymentMethod ?? "qris_static"} />
                        <button
                          type="submit"
                          className="rounded bg-green-600 px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                        >
                          Set Paid
                        </button>
                      </form>
                      <form action={adminUpdateTransaction}>
                        <input type="hidden" name="transactionId" value={t.id} />
                        <input type="hidden" name="status" value="failed" />
                        <input type="hidden" name="paymentMethod" value={t.paymentMethod ?? "qris_static"} />
                        <button
                          type="submit"
                          className="rounded border border-[#e4e5ea] px-2 py-1 text-[11px] font-medium text-[#6b7280] hover:bg-[#f5f5f7]"
                        >
                          Set Failed
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
