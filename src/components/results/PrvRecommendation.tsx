"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AnalysisResult } from "@/types";

export function PrvRecommendation({
  prvRecommendation,
  onAddPrv,
  isAddingPrv,
  tokenBalance
}: {
  prvRecommendation: AnalysisResult["prvRecommendation"];
  onAddPrv: () => void;
  isAddingPrv: boolean;
  tokenBalance?: number | null;
}) {
  if (!prvRecommendation || prvRecommendation.needed !== true) {
    return (
      <div className="rounded-2xl border border-border-lavender bg-white p-4 text-sm text-slate-gray shadow-whisper">
        ✅ Tidak ada tekanan berlebih. PRV tidak diperlukan.
      </div>
    );
  }

  const tokenCost = 3;
  const notEnough = tokenBalance !== null && tokenBalance !== undefined && tokenBalance < tokenCost;

  return (
    <div className="space-y-3 rounded-2xl border border-border-lavender bg-white p-5 shadow-whisper">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-expo-black">Rekomendasi PRV</div>
        <Badge variant="outline">{prvRecommendation.recommendations.length} item</Badge>
      </div>

      <div className="overflow-auto rounded-xl border border-border-lavender">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pipa</TableHead>
              <TableHead>Node upstream</TableHead>
              <TableHead>Node downstream</TableHead>
              <TableHead>Setting PRV (m)</TableHead>
              <TableHead>Node yang tercakup</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prvRecommendation.recommendations.map((r) => (
              <TableRow key={`${r.pipeId}:${r.upstreamNode}:${r.downstreamNode}`}>
                <TableCell className="whitespace-nowrap font-medium text-expo-black">{r.pipeId}</TableCell>
                <TableCell className="whitespace-nowrap">{r.upstreamNode}</TableCell>
                <TableCell className="whitespace-nowrap">{r.downstreamNode}</TableCell>
                <TableCell className="whitespace-nowrap">{r.settingM.toFixed(2)}</TableCell>
                <TableCell className="min-w-[220px] text-xs text-slate-gray">
                  {r.coveredNodes.join(", ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {prvRecommendation.unresolvedNodes.length > 0 ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-xs text-yellow-900">
          ⚠ Node berikut tidak dapat diselesaikan dengan PRV:{" "}
          {prvRecommendation.unresolvedNodes.join(", ")}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={onAddPrv} disabled={isAddingPrv || notEnough}>
          {isAddingPrv ? "Memproses…" : `Add PRV Otomatis — ${tokenCost} Token`}
        </Button>
        {tokenBalance !== null && tokenBalance !== undefined ? (
          <div className="text-xs text-silver">Sisa saldo: {tokenBalance} token</div>
        ) : null}
      </div>
    </div>
  );
}

