"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { formatIdr } from "@/lib/utils";
import { getTokenPackage } from "@/lib/token-packages";
import type { TransactionRow } from "@/types/transactions";

type InvoiceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionRow | null;
  accountName: string;
  accountEmail: string;
};

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function InvoiceModal({
  open,
  onOpenChange,
  transaction,
  accountName,
  accountEmail
}: InvoiceModalProps) {
  const pkg = getTokenPackage(transaction?.package ?? null);
  const packageName = pkg?.name ?? transaction?.package ?? "—";
  const amountLabel = transaction?.amount ? formatIdr(transaction.amount) : "Rp 0";
  const statusLabel = "✅ Lunas";
  const pdfStatusLabel = "Lunas";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>EPANET Solver - Bukti Pembayaran</DialogTitle>
        </DialogHeader>

        <div className="mt-5 space-y-4 text-sm text-near-black">
          <div className="rounded-2xl border border-border-lavender bg-cloud-gray/40 p-4">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-gray">
                  No. Order
                </div>
                <div className="mt-1 font-mono text-sm text-expo-black">
                  {transaction?.orderId ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-gray">
                  Tanggal
                </div>
                <div className="mt-1 text-sm text-expo-black">
                  {formatDateTime(transaction?.paidAt ?? transaction?.createdAt)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-gray">
                  Nama
                </div>
                <div className="mt-1 text-sm text-expo-black">{accountName}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-gray">
                  Email
                </div>
                <div className="mt-1 text-sm text-expo-black">{accountEmail}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border-lavender bg-white p-4 shadow-whisper">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-gray">Paket</span>
              <span className="font-semibold text-expo-black">{packageName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-gray">Token</span>
              <span className="font-semibold text-expo-black">
                {transaction?.tokens ?? 0} token
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-gray">Harga</span>
              <span className="font-semibold text-expo-black">{amountLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-gray">Metode</span>
              <span className="font-semibold text-expo-black">
                {transaction?.paymentMethod ?? "Midtrans"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-gray">Status</span>
              <span className="font-semibold text-green-700">{statusLabel}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-cloud-gray/40 p-4 text-sm text-slate-gray">
            Token sebanyak {transaction?.tokens ?? 0} telah ditambahkan ke akun Anda.
          </div>

          <div className="text-xs leading-relaxed text-slate-gray">
            Dokumen ini merupakan bukti pembayaran resmi layanan EPANET Solver.
            Diproses melalui Midtrans Payment Gateway.
          </div>

          <div className="flex flex-wrap justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!transaction) return;
                downloadInvoicePdf({
                  orderId: transaction.orderId,
                  issuedAt: formatDateTime(transaction.paidAt ?? transaction.createdAt),
                  name: accountName,
                  email: accountEmail,
                  packageName,
                  tokens: transaction.tokens ?? 0,
                  amountLabel,
                  paymentMethod: transaction.paymentMethod ?? "Midtrans",
                  statusLabel: pdfStatusLabel,
                  closingLine: `Token sebanyak ${transaction.tokens ?? 0} telah ditambahkan ke akun Anda.`
                });
              }}
              disabled={!transaction}
            >
              Unduh PDF
            </Button>
            <Button onClick={() => onOpenChange(false)}>Tutup</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
