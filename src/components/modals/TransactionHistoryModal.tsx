"use client";

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
import useSWR from "swr";

type TransactionHistoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type TxRow = {
  id: number;
  orderId: string;
  package: string | null;
  tokens: number | null;
  amount: number | null;
  status: string | null;
  paymentMethod: string | null;
  createdAt: string | Date | null;
};

async function fetcher(url: string) {
  const res = await fetch(url);
  return res.json();
}

export function TransactionHistoryModal({
  open,
  onOpenChange
}: TransactionHistoryModalProps) {
  const { data, isLoading } = useSWR(
    open ? "/api/transactions" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const items: TxRow[] = data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Riwayat Transaksi</DialogTitle>
        </DialogHeader>
        <p className="mt-2 text-sm text-slate-gray">
          Menampilkan 20 transaksi terakhir.
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-border-lavender">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Paket</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>Loading…</TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>Belum ada data.</TableCell>
                </TableRow>
              ) : (
                items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-expo-black">
                      {r.orderId}
                    </TableCell>
                    <TableCell>
                      {r.createdAt
                        ? new Date(r.createdAt).toISOString().slice(0, 10)
                        : "—"}
                    </TableCell>
                    <TableCell>{r.package ?? "—"}</TableCell>
                    <TableCell>
                      {typeof r.amount === "number" ? `Rp ${r.amount}` : "—"}
                    </TableCell>
                    <TableCell>{r.status ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
