"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatIdr } from "@/lib/utils";
import { useState } from "react";

export type QrisStaticPaymentData = {
  orderId: string;
  package: string;
  tokens: number;
  baseAmount: number;
  uniqueCode: number;
  totalAmount: number;
  label: string;
  qrImageUrl: string;
};

type QrisStaticPaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: QrisStaticPaymentData | null;
  onConfirm?: (data: QrisStaticPaymentData) => Promise<void> | void;
};

export function QrisStaticPaymentModal({
  open,
  onOpenChange,
  data,
  onConfirm
}: QrisStaticPaymentModalProps) {
  const orderId = data?.orderId ?? "";
  const [confirming, setConfirming] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bayar via {data?.label ?? "QRIS"}</DialogTitle>
        </DialogHeader>

        {data ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border-lavender bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                Total
              </div>
              <div className="mt-1 text-2xl font-extrabold text-expo-black">
                {formatIdr(data.totalAmount)}
              </div>
              <div className="mt-2 grid gap-1 text-xs text-slate-gray">
                <div className="flex items-center justify-between gap-2">
                  <span>Nominal paket</span>
                  <span className="font-semibold text-near-black">{formatIdr(data.baseAmount)}</span>
                </div>
                {data.uniqueCode > 0 ? (
                  <div className="flex items-center justify-between gap-2">
                    <span>Kode unik</span>
                    <span className="font-mono text-[11px] font-semibold text-near-black">
                      +{String(data.uniqueCode).padStart(3, "0")}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 text-xs text-slate-gray">
                Order ID: <span className="font-mono text-[11px] text-near-black">{orderId}</span>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="w-full max-w-[320px] rounded-2xl border border-border-lavender bg-white p-4">
                {imgError ? (
                  <div className="rounded-xl border border-border-lavender bg-cloud-gray/40 p-4 text-sm text-slate-gray">
                    Gambar QRIS gagal dimuat. Pastikan URL QRIS valid dan dapat diakses.
                  </div>
                ) : (
                  <img
                    src={data.qrImageUrl}
                    alt={`QRIS ${data.label}`}
                    className="h-auto w-full rounded-xl"
                    loading="lazy"
                    onError={() => setImgError(true)}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-gray">
              <p className="font-semibold text-expo-black">Cara bayar</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Buka aplikasi e-wallet / m-banking yang mendukung QRIS.</li>
                <li>Scan QR di atas, lalu masukkan <span className="font-semibold">Total</span> persis (termasuk kode unik).</li>
                <li>Setelah bayar, klik tombol <span className="font-semibold">Konfirmasi</span> agar pembayaran tercatat.</li>
                <li>Admin akan memverifikasi pembayaran secara manual.</li>
              </ol>
              <p className="text-xs">
                Jika token belum masuk, kirim bukti pembayaran beserta <span className="font-semibold">Order ID</span> ke admin.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (!orderId) return;
                  try {
                    await navigator.clipboard.writeText(orderId);
                  } catch {
                    // ignore clipboard failures
                  }
                }}
              >
                Salin Order ID
              </Button>
              <Button
                type="button"
                disabled={confirming || !onConfirm}
                onClick={async () => {
                  if (!data || !onConfirm) return;
                  setConfirming(true);
                  try {
                    await onConfirm(data);
                  } finally {
                    setConfirming(false);
                  }
                }}
              >
                {confirming ? "Mencatat..." : "Konfirmasi Pembayaran"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-gray">Data pembayaran tidak tersedia.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
