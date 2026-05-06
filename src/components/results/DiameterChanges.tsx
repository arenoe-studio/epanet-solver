"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DiameterChange = {
  pipeId: string;
  oldDiameterMm: number;
  newDiameterMm: number;
  reason: "V-HIGH" | "V-LOW" | "HL-HIGH" | "HL-SMALL" | (string & {});
};

export function DiameterChanges({ changes }: { changes: DiameterChange[] }) {
  if (changes.length === 0) {
    return (
      <div className="rounded-2xl border border-border-lavender bg-white p-4 text-sm text-slate-gray shadow-whisper">
        Tidak ada perubahan diameter.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-2xl border border-border-lavender bg-white shadow-whisper">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID Pipa</TableHead>
            <TableHead>Diameter Lama (mm)</TableHead>
            <TableHead>Diameter Baru (mm)</TableHead>
            <TableHead>Alasan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changes.map((c) => (
            <TableRow key={`${c.pipeId}:${c.oldDiameterMm}:${c.newDiameterMm}`}>
              <TableCell className="whitespace-nowrap font-medium text-expo-black">{c.pipeId}</TableCell>
              <TableCell className="whitespace-nowrap">{c.oldDiameterMm.toFixed(0)}</TableCell>
              <TableCell className="whitespace-nowrap">{c.newDiameterMm.toFixed(0)}</TableCell>
              <TableCell>{reasonBadge(c.reason)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function reasonBadge(reason: DiameterChange["reason"]) {
  const map: Record<string, string> = {
    "V-HIGH": "Velocity Terlalu Tinggi",
    "V-LOW": "Velocity Terlalu Rendah",
    "HL-HIGH": "Headloss Terlalu Tinggi",
    "HL-SMALL": "Headloss Terlalu Kecil"
  };
  return <Badge variant="outline">{map[reason] ?? reason}</Badge>;
}

