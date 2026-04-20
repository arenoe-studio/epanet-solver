"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatIdr } from "@/lib/utils";

export type QrisStaticPaymentData = {
  orderId: string;
  amount: number;
  label: string;
  qrImageUrl: string;
};

type QrisStaticPaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: QrisStaticPaymentData | null;
};

export function QrisStaticPaymentModal({
  open,
  onOpenChange,
  data
}: QrisStaticPaymentModalProps) {
  const orderId = data?.orderId ?? "";

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
                {formatIdr(data.amount)}
              </div>
              <div className="mt-3 text-xs text-slate-gray">
                Order ID: <span className="font-mono text-[11px] text-near-black">{orderId}</span>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="w-full max-w-[320px] rounded-2xl border border-border-lavender bg-white p-4">
                <img
                  src={data.qrImageUrl}
                  alt={`QRIS ${data.label}`}
                  className="h-auto w-full rounded-xl"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-gray">
              <p className="font-semibold text-expo-black">Cara bayar</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Buka aplikasi e-wallet / m-banking yang mendukung QRIS.</li>
                <li>Scan QR di atas, pastikan nominal sesuai.</li>
                <li>Setelah pembayaran berhasil, tunggu admin memverifikasi.</li>
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
              <Button type="button" onClick={() => onOpenChange(false)}>
                Saya sudah bayar
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

