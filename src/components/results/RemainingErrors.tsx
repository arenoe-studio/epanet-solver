"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type RemainingError = {
  type: string;
  elementId: string;
  value: number;
  unit: string;
  explanation: string;
  suggestion: string;
};

export function RemainingErrors({ errors }: { errors: RemainingError[] }) {
  if (errors.length === 0) {
    return (
      <div className="rounded-2xl border border-border-lavender bg-white p-4 text-sm text-slate-gray shadow-whisper">
        ✅ Tidak ada masalah yang tersisa.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errors.map((e) => (
        <Card key={`${e.type}:${e.elementId}`}>
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {typeBadge(e.type)}
                <span className="font-mono text-sm font-semibold text-expo-black">{e.elementId}</span>
              </div>
              <div className="text-sm font-semibold text-expo-black">
                {e.value} {e.unit}
              </div>
            </div>
            <div className="text-xs text-slate-gray">{e.explanation}</div>
            <div className="text-xs text-slate-gray">
              <span className="mr-1">💡</span>
              {e.suggestion}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function typeBadge(type: string) {
  const t = type.toLowerCase();
  if (t.includes("neg") || t.includes("high") || t.includes("v-high") || t.includes("hl-high")) {
    return <Badge className="bg-red-600 text-white">{type}</Badge>;
  }
  if (t.includes("low") || t.includes("small") || t.includes("v-low") || t.includes("hl-small")) {
    return <Badge className="bg-yellow-500 text-white">{type}</Badge>;
  }
  return <Badge variant="outline">{type}</Badge>;
}

