"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PipeRow = {
  id: string;
  diameterMm: number;
  velocityMs: number;
  headlossPerKm: number;
  velocityStatus: "OK" | "V-HIGH" | "V-LOW" | (string & {});
  headlossStatus: "OK" | "HL-HIGH" | "HL-SMALL" | (string & {});
};

export function PipesTable({ pipes }: { pipes: PipeRow[] }) {
  const [filter, setFilter] = useState<"all" | "bad">("all");

  const rows = useMemo(() => {
    if (filter === "bad") {
      return pipes.filter((p) => p.velocityStatus !== "OK" || p.headlossStatus !== "OK");
    }
    return pipes;
  }, [pipes, filter]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap">
        <Pill active={filter === "all"} onClick={() => setFilter("all")}>
          Semua
        </Pill>
        <Pill active={filter === "bad"} onClick={() => setFilter("bad")}>
          Bermasalah
        </Pill>
      </div>

      <div className="max-h-[520px] overflow-auto rounded-xl border border-border-lavender">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID Pipa</TableHead>
              <TableHead>Diameter (mm)</TableHead>
              <TableHead>Kecepatan (m/s)</TableHead>
              <TableHead>Headloss (m/km)</TableHead>
              <TableHead>Status Kecepatan</TableHead>
              <TableHead>Status Headloss</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-gray">
                  Tidak ada data.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap font-medium text-expo-black">{p.id}</TableCell>
                  <TableCell className="whitespace-nowrap">{p.diameterMm.toFixed(0)}</TableCell>
                  <TableCell className="whitespace-nowrap">{p.velocityMs.toFixed(2)}</TableCell>
                  <TableCell className="whitespace-nowrap">{p.headlossPerKm.toFixed(2)}</TableCell>
                  <TableCell>{velocityBadge(p.velocityStatus)}</TableCell>
                  <TableCell>{headlossBadge(p.headlossStatus)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function velocityBadge(status: PipeRow["velocityStatus"]) {
  if (status === "OK") return <Badge className="bg-green-600 text-white">OK</Badge>;
  if (status === "V-HIGH") return <Badge className="bg-red-600 text-white">Terlalu Cepat</Badge>;
  if (status === "V-LOW") return <Badge className="bg-yellow-500 text-white">Terlalu Lambat</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function headlossBadge(status: PipeRow["headlossStatus"]) {
  if (status === "OK") return <Badge className="bg-green-600 text-white">OK</Badge>;
  if (status === "HL-HIGH") return <Badge className="bg-red-600 text-white">Terlalu Tinggi</Badge>;
  if (status === "HL-SMALL") return <Badge className="bg-yellow-500 text-white">Terlalu Kecil</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function Pill({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active
          ? "border-expo-black bg-expo-black text-white"
          : "border-border-lavender bg-white text-slate-gray hover:bg-cloud-gray"
      }`}
    >
      {children}
    </button>
  );
}

