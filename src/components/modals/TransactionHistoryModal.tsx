"use client";

import useSWR from "swr";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { formatIdr } from "@/lib/utils";
import { getTokenPackage } from "@/lib/token-packages";
import type { TransactionRow } from "@/types/transactions";

type TransactionHistoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

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

function statusLabel(status: string | null) {
  switch (status) {
    case "paid":
      return "✅ Lunas";
    case "pending":
      return "⏳ Menunggu Pembayaran";
    case "failed":
      return "❌ Gagal";
    default:
      return "—";
  }
}

export function TransactionHistoryModal({
  open,
  onOpenChange
}: TransactionHistoryModalProps) {
  const { data, isLoading } = useSWR(open ? "/api/transactions" : null, fetcher, {
    revalidateOnFocus: false
  });

  const items: TransactionRow[] = data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Riwayat Transaksi</DialogTitle>
        </DialogHeader>
        <p className="mt-2 text-sm text-slate-gray">
          Menampilkan transaksi terbaru kamu.
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-border-lavender">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Paket</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Harga</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}>Memuat...</TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>Belum ada data.</TableCell>
                </TableRow>
              ) : (
                items.slice(0, 5).map((r) => {
                  const pkg = getTokenPackage(r.package ?? null);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                      <TableCell className="font-medium text-expo-black">
                        {pkg?.name ?? r.package ?? "—"}
                      </TableCell>
                      <TableCell>{r.tokens ?? "—"}</TableCell>
                      <TableCell>
                        {typeof r.amount === "number" ? formatIdr(r.amount) : "—"}
                      </TableCell>
                      <TableCell>{r.paymentMethod ?? "—"}</TableCell>
                      <TableCell>{statusLabel(r.status)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {items.length > 5 ? (
          <div className="mt-3 text-xs text-slate-gray">
            Tampilkan semua riwayat di halaman checkout untuk detail invoice dan aksi lanjutan.
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
