"use client";

import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { TokenPackageCard } from "@/components/checkout/TokenPackageCard";
import { InvoiceModal } from "@/components/modals/InvoiceModal";
import {
  QrisStaticPaymentModal,
  type QrisStaticPaymentData
} from "@/components/modals/QrisStaticPaymentModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/providers/ToastProvider";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { formatIdr, normalizeQrisQrImageUrl } from "@/lib/utils";
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
        label: "Lunas",
        dot: "bg-green-500",
        className: "border-green-200 bg-green-50 text-green-700"
      };
    case "pending":
      return {
        label: "Menunggu Pembayaran",
        dot: "bg-amber-400",
        className: "border-amber-200 bg-amber-50 text-amber-700"
      };
    case "failed":
      return {
        label: "Gagal",
        dot: "bg-slate-400",
        className: "border-slate-200 bg-slate-100 text-slate-600"
      };
    default:
      return {
        label: "—",
        dot: "",
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

function isQrisStatic(tx: TransactionRow) {
  return (tx.paymentMethod ?? "").toLowerCase().startsWith("qris");
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
  const [qrisPayment, setQrisPayment] = useState<QrisStaticPaymentData | null>(null);

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
       const json = (await res.json()) as
         | {
             provider?: "midtrans";
             snapToken?: string;
             orderId?: string;
             error?: string;
           }
         | {
             provider?: "qris_static";
             orderId?: string;
             qris?: { qrImageUrl: string; label: string };
             baseAmount?: number;
             uniqueCode?: number;
             amount?: number;
             tokens?: number;
             package?: string;
             error?: string;
           };

      if (!res.ok || !json || (json as { error?: string }).error) {
        push({
          title: "Gagal memulai pembayaran",
          description: (json as { error?: string })?.error ?? "Coba lagi dalam beberapa saat.",
          variant: "error"
        });
        setBusyPackage(null);
        return;
      }

      const provider = (json as { provider?: string }).provider;
      if (provider === "midtrans") {
        const snapToken = (json as { snapToken?: string }).snapToken;
        if (!snapToken) {
          push({
            title: "Gagal memulai pembayaran",
            description: "Token Midtrans tidak tersedia.",
            variant: "error"
          });
          setBusyPackage(null);
          return;
        }
        await openSnapPayment(snapToken);
        return;
      }

      const orderId = (json as { orderId?: string }).orderId;
      const qris = (json as { qris?: { qrImageUrl: string; label: string } }).qris;
      const baseAmount = (json as { baseAmount?: number }).baseAmount;
      const uniqueCode = (json as { uniqueCode?: number }).uniqueCode;
      const amount = (json as { amount?: number }).amount;
      const tokens = (json as { tokens?: number }).tokens;
      const pkg = (json as { package?: string }).package;
      if (!orderId || !qris?.qrImageUrl || !baseAmount || !uniqueCode || !amount || !pkg) {
        push({
          title: "Gagal memulai pembayaran",
          description: "Data QRIS tidak lengkap.",
          variant: "error"
        });
        setBusyPackage(null);
        return;
      }

      setQrisPayment({
        orderId,
        package: pkg,
        tokens: tokens ?? 0,
        baseAmount,
        uniqueCode,
        totalAmount: amount,
        requiresConfirmation: true,
        label: qris.label ?? "QRIS",
        qrImageUrl: normalizeQrisQrImageUrl(qris.qrImageUrl)
      });
      push({
        title: "Scan QRIS untuk bayar",
        description: "Setelah bayar, klik Konfirmasi agar pembayaran tercatat.",
        variant: "info"
      });
      setBusyPackage(null);
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

    if (isQrisStatic(tx)) {
      const qrImageUrl = normalizeQrisQrImageUrl(
        process.env.NEXT_PUBLIC_QRIS_STATIC_QR_IMAGE_URL ?? ""
      );
      const label = process.env.NEXT_PUBLIC_QRIS_STATIC_LABEL ?? "QRIS";
      if (!qrImageUrl) {
        push({
          title: "QRIS belum tersedia",
          description: "QRIS static belum dikonfigurasi.",
          variant: "error"
        });
        return;
      }
      if (!tx.amount || !tx.orderId) {
        push({
          title: "Data transaksi tidak lengkap",
          description: "Silakan buat transaksi baru dari bagian atas.",
          variant: "error"
        });
        return;
      }
      setQrisPayment({
        orderId: tx.orderId,
        package: tx.package ?? pkgKey,
        tokens: tx.tokens ?? 0,
        baseAmount: tx.baseAmount ?? (tx.amount ?? 0) - (tx.uniqueCode ?? 0),
        uniqueCode: tx.uniqueCode ?? 0,
        totalAmount: tx.amount,
        requiresConfirmation: false,
        label,
        qrImageUrl
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

        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
            Beli Token
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.04em] text-expo-black md:text-3xl">
            Pilih paket yang paling pas
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-gray">
            1 analisis = 5 token · Fix Pressure = 3 token · Token tidak pernah kedaluwarsa
          </p>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Paket
            </div>
            <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-expo-black">
              Pilih paket token
            </h2>
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

      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Riwayat Pembelian
            </div>
            <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-expo-black">
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
            <div className="flex flex-col gap-2 p-6">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-gray" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <div className="text-sm font-semibold text-expo-black">
                Belum ada riwayat pembelian.
              </div>
              <div className="text-sm text-slate-gray">
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
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                          >
                            {meta.dot ? <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden /> : null}
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
                              {isQrisStatic(tx) ? "Lihat QRIS" : "Lanjutkan Pembayaran"}
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

      <InvoiceModal
        open={Boolean(invoiceTransaction)}
        onOpenChange={(open) => {
          if (!open) setInvoiceTransaction(null);
        }}
        transaction={invoiceTransaction}
        accountName={accountName}
        accountEmail={accountEmail}
      />

      <QrisStaticPaymentModal
        open={Boolean(qrisPayment)}
        onOpenChange={(open) => {
          if (!open) setQrisPayment(null);
        }}
        data={qrisPayment}
        onConfirm={async (data) => {
          try {
            const res = await fetch("/api/token/confirm-qris", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: data.orderId,
                package: data.package,
                uniqueCode: data.uniqueCode
              })
            });
            const json = (await res.json()) as { ok?: boolean; error?: string };
            if (!res.ok || json?.error) {
              push({
                title: "Gagal konfirmasi pembayaran",
                description: json?.error ?? "Coba lagi dalam beberapa saat.",
                variant: "error"
              });
              return;
            }

            push({
              title: "Pembayaran tercatat",
              description: "Menunggu verifikasi admin.",
              variant: "success"
            });
            setQrisPayment(null);
            void mutateTransactions();
          } catch {
            push({
              title: "Gagal konfirmasi pembayaran",
              description: "Coba lagi dalam beberapa saat.",
              variant: "error"
            });
          }
        }}
      />
    </div>
  );
}
