"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn, formatIdr } from "@/lib/utils";
import type { TokenPackage } from "@/lib/token-packages";

type TokenPackageCardProps = {
  pkg: TokenPackage;
  onSelect: () => void;
  ctaLabel?: string;
  selected?: boolean;
  compact?: boolean;
  disabled?: boolean;
};

const badgeToneClasses: Record<NonNullable<TokenPackage["badgeTone"]>, string> = {
  accent: "border-amber-200 bg-amber-100 text-amber-800",
  primary: "border-sky-200 bg-sky-100 text-sky-800",
  muted: "border-border-lavender bg-cloud-gray text-slate-gray",
};

export function TokenPackageCard({
  pkg,
  onSelect,
  ctaLabel = "Beli Sekarang",
  selected = false,
  compact = false,
  disabled = false,
}: TokenPackageCardProps) {
  const comparePrice = pkg.comparePrice ? formatIdr(pkg.comparePrice) : null;

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-hidden p-0 transition-all",
        pkg.featured
          ? "border-expo-black shadow-elevated md:-translate-y-2"
          : "border-border-lavender",
        selected && "ring-2 ring-link-cobalt/20"
      )}
    >
      {pkg.badge ? (
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
          <div
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em]",
              badgeToneClasses[pkg.badgeTone ?? "muted"]
            )}
          >
            {pkg.badge}
          </div>
        </div>
      ) : null}

      <div className={cn("flex flex-1 flex-col", compact ? "p-5" : "p-6")}>
        <div className="space-y-1.5">
          <div className="text-base font-semibold tracking-[-0.02em] text-expo-black">
            {pkg.name}
          </div>
          <div className="text-4xl font-bold tracking-[-0.05em] text-expo-black">
            {pkg.tokens}
            <span className="ml-1 text-lg font-semibold tracking-[-0.02em] text-slate-gray">
              token
            </span>
          </div>
          <div className="text-2xl font-semibold tracking-[-0.04em] text-expo-black">
            {formatIdr(pkg.amount)}
          </div>
          <div className="text-xs text-slate-gray">
            {formatIdr(pkg.pricePerToken)} / token
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <div className="text-sm font-medium text-near-black">{pkg.usageLabel}</div>
          <div className="text-sm text-slate-gray">{pkg.framing}</div>
          {comparePrice && pkg.savingsLabel ? (
            <div className="text-sm text-slate-gray">
              <span className="font-semibold text-expo-black line-through">
                {comparePrice}
              </span>{" "}
              <span className="font-semibold text-near-black">{pkg.savingsLabel}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-auto pt-5">
          <Button className="w-full" onClick={onSelect} disabled={disabled}>
            {ctaLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}
