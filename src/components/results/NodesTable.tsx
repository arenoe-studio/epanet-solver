"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type NodeRow = {
  id: string;
  pressureM: number;
  pressureStatus: "OK" | "P-HIGH" | "P-LOW" | "P-NEG" | (string & {});
};

export function NodesTable({ nodes }: { nodes: NodeRow[] }) {
  const [filter, setFilter] = useState<"all" | "bad">("all");

  const rows = useMemo(() => {
    if (filter === "bad") return nodes.filter((n) => n.pressureStatus !== "OK");
    return nodes;
  }, [nodes, filter]);

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
              <TableHead>ID Node</TableHead>
              <TableHead>Tekanan (m)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-slate-gray">
                  Tidak ada data.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="whitespace-nowrap font-medium text-expo-black">{n.id}</TableCell>
                  <TableCell className="whitespace-nowrap">{n.pressureM.toFixed(2)}</TableCell>
                  <TableCell>{pressureBadge(n.pressureStatus)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function pressureBadge(status: NodeRow["pressureStatus"]) {
  if (status === "OK") return <Badge className="bg-green-600 text-white">OK</Badge>;
  if (status === "P-HIGH") return <Badge className="bg-red-600 text-white">Terlalu Tinggi</Badge>;
  if (status === "P-LOW") return <Badge className="bg-yellow-500 text-white">Terlalu Rendah</Badge>;
  if (status === "P-NEG") return <Badge className="bg-rose-900 text-white">Negatif</Badge>;
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

