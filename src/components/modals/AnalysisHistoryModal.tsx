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

type AnalysisHistoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type AnalysisRow = {
  id: number;
  fileName: string | null;
  kind: string | null;
  parentAnalysisId: number | null;
  status: string | null;
  issuesFound: number | null;
  issuesFixed: number | null;
  createdAt: string | Date | null;
};

async function fetcher(url: string) {
  const res = await fetch(url);
  return res.json();
}

export function AnalysisHistoryModal({
  open,
  onOpenChange
}: AnalysisHistoryModalProps) {
  const { data, isLoading } = useSWR(
    open ? "/api/analyses" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const items: AnalysisRow[] = data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Riwayat Analisis</DialogTitle>
        </DialogHeader>
        <p className="mt-2 text-sm text-slate-gray">
          Menampilkan 20 analisis terakhir.
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-border-lavender">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issues</TableHead>
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
                      {r.fileName ?? "—"}
                    </TableCell>
                    <TableCell>
                      {r.createdAt
                        ? new Date(r.createdAt).toISOString().slice(0, 10)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {r.kind === "fix_pressure"
                        ? r.parentAnalysisId
                          ? `Final/PRV (#${r.parentAnalysisId})`
                          : "Final/PRV"
                        : "V1"}
                    </TableCell>
                    <TableCell>{r.status ?? "—"}</TableCell>
                    <TableCell>
                      {typeof r.issuesFound === "number" &&
                      typeof r.issuesFixed === "number"
                        ? `${r.issuesFound} → ${r.issuesFound - r.issuesFixed}`
                        : "—"}
                    </TableCell>
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
