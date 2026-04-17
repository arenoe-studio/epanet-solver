"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { TokenPackageCard } from "@/components/checkout/TokenPackageCard";
import { InvoiceModal } from "@/components/modals/InvoiceModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/providers/ToastProvider";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { formatIdr } from "@/lib/utils";
import {
  TOKEN_PACKAGES_LIST,
  getTokenPackage,
  resolveTokenPackageKey,
  type TokenPackageKey
} from "@/lib/token-packages";
import type { TransactionRow } from "@/types/transactions";

type TransactionResponse = {
  items?: TransactionRow[];
  error?: string;
};

async function fetcher(url: string): Promise<TransactionResponse> {
  const res = await fetch(url);
  return res.json();
}

function formatDateTime(value: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function packageLabel(value: string | null) {
  if (!value) return "—";
  return getTokenPackage(value)?.name ?? value;
}

function statusMeta(status: string | null) {
  switch (status) {
    case "paid":
      return {
        label: "✅ Lunas",
        className: "border-green-200 bg-green-50 text-green-700"
      };
    case "pending":
      return {
        label: "⏳ Menunggu Pembayaran",
        className: "border-amber-200 bg-amber-50 text-amber-700"
      };
    case "failed":
      return {
        label: "❌ Gagal",
        className: "border-slate-200 bg-slate-100 text-slate-600"
      };
    default:
      return {
        label: "—",
        className: "border-border-lavender bg-white text-slate-gray"
      };
  }
}

function canReuseSnapToken(tx: TransactionRow) {
  if (tx.status !== "pending") return false;
  if (!tx.snapToken || !tx.snapTokenExpiresAt) return false;
  const expiresAt = new Date(tx.snapTokenExpiresAt);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
}

export function CheckoutClient() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const searchParams = useSearchParams();
  const { push } = useToast();
  const { balance, isLoading: balanceLoading, refresh: refreshBalance } =
    useTokenBalance(isAuthenticated);

  const [selectedPackage, setSelectedPackage] = useState<TokenPackageKey | null>(null);
  const [busyPackage, setBusyPackage] = useState<TokenPackageKey | null>(null);
  const [expandedHistory, setExpandedHistory] = useState(false);
  const [invoiceTransaction, setInvoiceTransaction] = useState<TransactionRow | null>(null);

  const selectedFromQuery = useMemo(() => {
    return resolveTokenPackageKey(searchParams.get("package"));
  }, [searchParams]);

  useEffect(() => {
    if (selectedFromQuery) {
      setSelectedPackage(selectedFromQuery);
    }
  }, [selectedFromQuery]);

  const {
    data,
    isLoading: transactionsLoading,
    mutate: mutateTransactions
  } = useSWR<TransactionResponse>(isAuthenticated ? "/api/transactions" : null, fetcher, {
    revalidateOnFocus: false
  });

  const transactions = data?.items ?? [];
  const visibleTransactions = expandedHistory ? transactions : transactions.slice(0, 5);
  const hasMoreTransactions = transactions.length > 5;

  const activeBalance = balance ?? 0;

  async function openSnapPayment(snapToken: string) {
    const snap = (window as Window & {
      snap?: {
        pay: (
          token: string,
          options: {
            onSuccess?: () => void;
            onPending?: () => void;
            onError?: () => void;
            onClose?: () => void;
          }
        ) => void;
      };
    }).snap;

    if (!snap?.pay) {
      throw new Error("Snap.js belum siap");
    }

    snap.pay(snapToken, {
      onSuccess: () => {
        void refreshBalance();
        void mutateTransactions();
        push({
          title: "Pembayaran berhasil",
          description: "Token kamu sudah diperbarui.",
          variant: "success"
        });
        setBusyPackage(null);
      },
      onPending: () => {
        void mutateTransactions();
        push({
          title: "Menunggu pembayaran",
          description: "Selesaikan pembayaran di popup Midtrans.",
          variant: "info"
        });
        setBusyPackage(null);
      },
      onError: () => {
        push({
          title: "Pembayaran gagal",
          description: "Sesi Midtrans gagal diproses.",
          variant: "error"
        });
        setBusyPackage(null);
      },
      onClose: () => {
        setBusyPackage(null);
      }
    });
  }

  async function startCheckout(pkgKey: TokenPackageKey) {
    setSelectedPackage(pkgKey);

    if (!isAuthenticated) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(
        `/checkout?package=${pkgKey}`
      )}`;
      return;
    }

    setBusyPackage(pkgKey);

    try {
      const res = await fetch("/api/token/create-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: pkgKey })
      });
      const json = (await res.json()) as {
        snapToken?: string;
        orderId?: string;
        error?: string;
      };

      if (!res.ok || !json.snapToken) {
        push({
          title: "Gagal memulai pembayaran",
          description: json.error ?? "Coba lagi dalam beberapa saat.",
          variant: "error"
        });
        setBusyPackage(null);
        return;
      }

      await openSnapPayment(json.snapToken);
    } catch {
      push({
        title: "Gagal memulai pembayaran",
        description: "Coba lagi dalam beberapa saat.",
        variant: "error"
      });
      setBusyPackage(null);
    }
  }

  async function continuePayment(tx: TransactionRow) {
    const pkgKey = resolveTokenPackageKey(tx.package);
    if (!pkgKey) {
      push({
        title: "Paket tidak dikenali",
        description: "Silakan buat transaksi baru dari bagian atas.",
        variant: "error"
      });
      return;
    }

    if (canReuseSnapToken(tx)) {
      setBusyPackage(pkgKey);
      try {
        await openSnapPayment(tx.snapToken ?? "");
      } catch {
        push({
          title: "Snap.js belum siap",
          description: "Muat ulang halaman lalu coba lagi.",
          variant: "error"
        });
        setBusyPackage(null);
      }
      return;
    }

    push({
      title: "Sesi pembayaran kedaluwarsa",
      description: "Membuat sesi baru dengan paket yang sama.",
      variant: "info"
    });
    await startCheckout(pkgKey);
  }

  const accountName = session?.user?.name ?? "User";
  const accountEmail = session?.user?.email ?? "";

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-[2rem] border border-border-lavender bg-white px-6 py-8 shadow-whisper md:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(0,112,243,0.08),transparent_40%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_35%)]" />

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Beli Token
            </div>
            <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em] text-expo-black md:text-5xl">
              Pilih paket yang paling pas
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-gray md:text-base">
              1 analisis = 5 token · Fix Pressure = 3 token · Token tidak pernah kedaluwarsa
            </p>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-cloud-gray/70 px-4 py-3 text-sm text-near-black">
            <div className="text-xs uppercase tracking-[0.08em] text-slate-gray">
              Saldo kamu saat ini
            </div>
            <div className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
              {balanceLoading ? "..." : `${activeBalance} token`}
            </div>
            {!isAuthenticated ? (
              <div className="mt-1 text-xs text-slate-gray">
                Masuk untuk melihat saldo aktif.
              </div>
            ) : activeBalance === 0 ? (
              <div className="mt-1 text-xs text-slate-gray">
                belum ada token aktif
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Paket
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-expo-black">
              Pilih paket token
            </h2>
          </div>
          <div className="hidden text-sm text-slate-gray md:block">
            Semua angka di bawah akurat dan siap dipakai.
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {TOKEN_PACKAGES_LIST.map((pkg) => (
            <TokenPackageCard
              key={pkg.key}
              pkg={pkg}
              selected={selectedPackage === pkg.key}
              onSelect={() => void startCheckout(pkg.key)}
              disabled={busyPackage !== null}
              ctaLabel={
                busyPackage === pkg.key
                  ? "Memproses..."
                  : isAuthenticated
                    ? "Beli Sekarang"
                    : "Masuk untuk Beli"
              }
            />
          ))}
        </div>

        <div className="text-center text-xs leading-relaxed text-slate-gray">
          Semua analisis akurat 100% - token digunakan untuk akses ke output, bukan untuk
          akurasi perhitungan.
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Riwayat Pembelian
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-expo-black">
              Transaksi terbaru
            </h2>
          </div>
          {isAuthenticated ? (
            <div className="text-sm text-slate-gray">
              {transactions.length > 0
                ? `${transactions.length} transaksi`
                : "Belum ada transaksi"}
            </div>
          ) : null}
        </div>

        <Card className="overflow-hidden">
          {!isAuthenticated ? (
            <div className="p-6 text-sm text-slate-gray">
              Masuk untuk melihat riwayat pembelian dan membuka invoice.
            </div>
          ) : transactionsLoading ? (
            <div className="p-6 text-sm text-slate-gray">Memuat riwayat pembelian...</div>
          ) : transactions.length === 0 ? (
            <div className="space-y-3 p-6 text-sm text-slate-gray">
              <div className="text-3xl">🧾</div>
              <div className="text-base font-semibold text-expo-black">
                Belum ada riwayat pembelian.
              </div>
              <div>
                {activeBalance > 0
                  ? "Token pertama kamu sudah ditambahkan saat login — coba analisis dulu!"
                  : "Riwayat transaksi akan muncul di sini setelah pembelian pertama."}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-cloud-gray/60 text-xs uppercase tracking-[0.08em] text-slate-gray">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Paket</th>
                    <th className="px-4 py-3 font-semibold">Token</th>
                    <th className="px-4 py-3 font-semibold">Harga</th>
                    <th className="px-4 py-3 font-semibold">Metode</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((tx) => {
                    const meta = statusMeta(tx.status);
                    return (
                      <tr key={tx.id} className="border-b border-border-lavender last:border-b-0">
                        <td className="px-4 py-3 text-slate-gray">
                          {formatDateTime(tx.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-medium text-expo-black">
                          {packageLabel(tx.package)}
                        </td>
                        <td className="px-4 py-3 text-slate-gray">
                          {tx.tokens ?? "—"} token
                        </td>
                        <td className="px-4 py-3 text-slate-gray">
                          {tx.amount ? formatIdr(tx.amount) : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-gray">
                          {tx.paymentMethod ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {tx.status === "paid" ? (
                            <Button size="sm" variant="outline" onClick={() => setInvoiceTransaction(tx)}>
                              Lihat Invoice
                            </Button>
                          ) : tx.status === "pending" ? (
                            <Button size="sm" onClick={() => void continuePayment(tx)}>
                              Lanjutkan Pembayaran
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const pkgKey = resolveTokenPackageKey(tx.package);
                                if (!pkgKey) return;
                                setSelectedPackage(pkgKey);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                            >
                              Beli Lagi
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {isAuthenticated && hasMoreTransactions ? (
            <div className="border-t border-border-lavender px-4 py-3">
              <button
                className="text-sm font-semibold text-link-cobalt hover:underline"
                onClick={() => setExpandedHistory((prev) => !prev)}
                type="button"
              >
                {expandedHistory
                  ? "Tampilkan 5 transaksi terbaru"
                  : `Tampilkan semua riwayat (${transactions.length} transaksi)`}
              </button>
            </div>
          ) : null}
        </Card>
      </section>

      <section className="rounded-[1.75rem] border border-border-lavender bg-white px-6 py-5 text-center text-sm text-slate-gray shadow-whisper">
        Semua analisis menggunakan solver EPANET yang sama dengan versi desktop. Hasil
        selalu akurat - token digunakan untuk akses ke output, bukan untuk akurasi.
      </section>

      <div className="flex justify-center gap-3">
        <Link href="/upload" className="text-sm font-semibold text-link-cobalt hover:underline">
          Kembali ke Upload
        </Link>
        <span className="text-sm text-slate-gray">•</span>
        <Link href="/contact" className="text-sm font-semibold text-link-cobalt hover:underline">
          Kontak Bantuan
        </Link>
      </div>

      <InvoiceModal
        open={Boolean(invoiceTransaction)}
        onOpenChange={(open) => {
          if (!open) setInvoiceTransaction(null);
        }}
        transaction={invoiceTransaction}
        accountName={accountName}
        accountEmail={accountEmail}
      />
    </div>
  );
}
