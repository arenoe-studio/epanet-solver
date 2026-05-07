"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AnalysisKind, AnalysisResult, MaterialResult, NodeResult, PipeResult } from "@/types";
import { SummaryCard } from "@/components/results/SummaryCard";
import { PipesTable } from "@/components/results/PipesTable";
import { NodesTable } from "@/components/results/NodesTable";
import { RemainingErrors } from "@/components/results/RemainingErrors";
import { DiameterChanges } from "@/components/results/DiameterChanges";
import { PrvRecommendation } from "@/components/results/PrvRecommendation";
import { DownloadActions } from "@/components/results/DownloadActions";

export function ResultsPanel({
  result,
  onBackToUpload,
  onAnalyzeAnother,
  onAddPrv,
  isAddingPrv,
  tokenBalance
}: {
  result: AnalysisResult;
  onBackToUpload?: () => void;
  onAnalyzeAnother: () => void;
  onAddPrv: () => void;
  isAddingPrv: boolean;
  tokenBalance?: number | null;
}) {
  type Tab = "pipes" | "nodes" | "materials";
  const kind: AnalysisKind = result.kind ?? "diameter";
  const [activeTab, setActiveTab] = useState<Tab>("pipes");
  const nodes = result.nodes ?? [];
  const pipes = result.pipes ?? [];
  console.log("[debug] pipes[0]:", JSON.stringify(pipes[0]));
  const materials = result.materials ?? [];
  const nodeRows = useMemo(() => nodes.flatMap((n) => {
    const pressure = n.pressureAfter ?? (n as any).pressureTekananM ?? (n as any).pressureDiameterM;
    if (typeof pressure !== "number") return [];
    return [{ id: n.id, pressureM: pressure, pressureStatus: n.code === "P-OK" ? "OK" : n.code }];
  }), [nodes]);
  const pipeRows = useMemo(() => pipes.flatMap((p: any) => {
    const diam = p.diameterMm ?? p.diameterAfter ?? p.diameterBefore;
    const vel = p.velocityMs ?? p.velocityAfter ?? p.velocityTekananMps;
    const hl = p.headlossPerKm ?? p.headlossAfter ?? p.unitHeadlossTekananMkm;
    if (typeof diam !== "number" || typeof vel !== "number" || typeof hl !== "number") return [];
    const vStatus = p.velocityStatus ?? (p.code === "V-HIGH" || p.code === "V-LOW" ? p.code : "OK");
    const hlStatus = p.headlossStatus ?? (p.code === "HL-HIGH" || p.code === "HL-SMALL" ? p.code : "OK");
    return [{ id: p.id, diameterMm: diam, velocityMs: vel, headlossPerKm: hl,
      velocityStatus: vStatus, headlossStatus: hlStatus }];
  }), [pipes]);
  const diameterChanges = useMemo(() => pipes.flatMap((p) => (typeof p.diameterBefore === "number" && typeof p.diameterAfter === "number" && p.diameterBefore !== p.diameterAfter ? [{ pipeId: p.id, oldDiameterMm: p.diameterBefore, newDiameterMm: p.diameterAfter, reason: p.code }] : [])), [pipes]);
  const remainingErrors = useMemo(() => {
    const raw: any[] = result.remainingErrors?.length
      ? result.remainingErrors
      : buildRemainingErrors(nodes, pipes, kind);
    // For diameter analysis, exclude pressure-node errors (P-LOW / P-HIGH / P-NEG)
    // — those belong to pressure analysis only.
    if (kind === "diameter") {
      return raw.filter((e: any) => !["P-LOW", "P-HIGH", "P-NEG"].includes(e.type));
    }
    return raw;
  }, [result.remainingErrors, nodes, pipes, kind]);
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">{onBackToUpload ? <Button variant="ghost" size="sm" onClick={onBackToUpload}>← Kembali</Button> : null}<Button variant="outline" size="sm" onClick={onAnalyzeAnother}>Analisis File Baru</Button></div>
        <Badge variant="outline" className="font-mono">ID: {result.analysisId}</Badge>
      </div>
      <SummaryCard summary={result.summary} kind={kind} engineUsed={result.engineUsed} convergenceStatus={undefined} remainingCount={remainingErrors.length} />
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Detail Hasil</CardTitle><div className="text-xs text-slate-gray">File: <span className="font-mono text-near-black">{result.fileName}</span></div></div>
          <Tabs value={activeTab} onValueChange={(v) => (isTab(v) ? setActiveTab(v) : null)}><TabsList className="w-full justify-start gap-1 rounded-full border border-border-lavender bg-cloud-gray/40 p-1"><TabsTrigger value="pipes" className="rounded-full px-3 py-1 pb-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:after:hidden">Pipa</TabsTrigger><TabsTrigger value="nodes" className="rounded-full px-3 py-1 pb-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:after:hidden">Node</TabsTrigger><TabsTrigger value="materials" className="rounded-full px-3 py-1 pb-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:after:hidden">Material</TabsTrigger></TabsList></Tabs>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => (isTab(v) ? setActiveTab(v) : null)}><TabsContent value="pipes"><PipesTable pipes={pipeRows} /></TabsContent><TabsContent value="nodes"><NodesTable nodes={nodeRows} /></TabsContent><TabsContent value="materials"><MaterialsTable materials={materials} /></TabsContent></Tabs>
        </CardContent>
      </Card>
      {kind === "diameter" && diameterChanges.length > 0 ? <div className="space-y-2"><div className="text-sm font-semibold text-expo-black">Perubahan Diameter</div><DiameterChanges changes={diameterChanges} /></div> : null}
      <div className="space-y-2"><div className="text-sm font-semibold text-expo-black">Remaining Errors</div><RemainingErrors errors={remainingErrors} /></div>
      {kind === "pressure" ? <PrvRecommendation prvRecommendation={result.prvRecommendation ?? null} onAddPrv={onAddPrv} isAddingPrv={isAddingPrv} tokenBalance={tokenBalance} /> : null}
      <DownloadActions analysisId={result.analysisId} kind={kind} tokenBalance={tokenBalance} />
    </section>
  );
}

function isTab(v: string): v is "pipes" | "nodes" | "materials" {
  return v === "pipes" || v === "nodes" || v === "materials";
}

function MaterialsTable({ materials }: { materials: MaterialResult[] }) {
  return (
    <div className="max-h-[520px] overflow-auto rounded-xl border border-border-lavender">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Material</TableHead>
            <TableHead>Roughness</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-slate-gray">
                Tidak ada data.
              </TableCell>
            </TableRow>
          ) : (
            materials.map((m) => (
              <TableRow key={m.pipeId}>
                <TableCell className="whitespace-nowrap font-medium text-expo-black">{m.pipeId}</TableCell>
                <TableCell className="whitespace-nowrap">{m.material || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{m.C}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function buildRemainingErrors(nodes: NodeResult[], pipes: PipeResult[], kind: AnalysisKind = "diameter") {
  const out: Array<{
    type: string;
    elementId: string;
    value: number;
    unit: string;
    explanation: string;
    suggestion: string;
  }> = [];

  if (kind === "pressure" || kind === "add_prv") {
    for (const n of nodes) {
      if (n.code === "P-OK") continue;
      const v = typeof n.pressureAfter === "number" ? n.pressureAfter : 0;
      out.push({
        type: n.code,
        elementId: n.id,
        value: Number(v.toFixed(2)),
        unit: "m",
        explanation: "Tekanan node masih di luar batas aman.",
        suggestion: "Pertimbangkan PRV, ubah elevasi, atau atur demand untuk memperbaiki tekanan."
      });
    }
  }

  for (const p of pipes) {
    // New-format pipes always have code="OK"; real status is in velocityStatus/headlossStatus.
    const vSt = (p as any).velocityStatus;
    const hlSt = (p as any).headlossStatus;
    const effectiveCode =
      p.code !== "OK" ? p.code
      : vSt === "V-HIGH" || vSt === "V-LOW" ? vSt
      : hlSt === "HL-HIGH" || hlSt === "HL-SMALL" ? hlSt
      : "OK";
    if (effectiveCode === "OK") continue;
    const value =
      effectiveCode === "V-HIGH" || effectiveCode === "V-LOW"
        ? typeof (p as any).velocityMs === "number"
          ? (p as any).velocityMs
          : typeof p.velocityAfter === "number"
            ? p.velocityAfter
            : 0
        : typeof (p as any).headlossPerKm === "number"
          ? (p as any).headlossPerKm
          : typeof p.headlossAfter === "number"
            ? p.headlossAfter
            : 0;
    const unit = effectiveCode === "V-HIGH" || effectiveCode === "V-LOW" ? "m/s" : "m/km";
    out.push({
      type: effectiveCode,
      elementId: p.id,
      value: Number(value.toFixed(2)),
      unit,
      explanation: "Parameter pipa masih di luar batas yang direkomendasikan.",
      suggestion: "Pertimbangkan perubahan diameter/konfigurasi jaringan untuk menormalkan velocity/headloss."
    });
  }

  return out;
}
