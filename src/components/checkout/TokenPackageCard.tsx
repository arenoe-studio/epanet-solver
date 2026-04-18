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
        "relative flex h-full flex-col p-0 transition-all",
        pkg.featured
          ? "border-expo-black shadow-elevated md:-translate-y-2"
          : "border-border-lavender",
        selected && "ring-2 ring-link-cobalt/20"
      )}
    >
      {/* Fixed-height badge slot — always rendered so all cards start at the same baseline */}
      <div className="flex h-9 items-center justify-center">
        {pkg.badge ? (
          <div
            className={cn(
              "rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]",
              badgeToneClasses[pkg.badgeTone ?? "muted"]
            )}
          >
            {pkg.badge}
          </div>
        ) : null}
      </div>

      <div className={cn("flex flex-1 flex-col", compact ? "p-4" : "p-5", "pt-0")}>
        <div className="space-y-1">
          <div className="text-sm font-semibold tracking-[-0.02em] text-expo-black">
            {pkg.name}
          </div>
          <div className="text-2xl font-bold tracking-[-0.04em] text-expo-black">
            {pkg.tokens}
            <span className="ml-1 text-sm font-semibold tracking-[-0.01em] text-slate-gray">
              token
            </span>
          </div>
          <div className="text-lg font-semibold tracking-[-0.03em] text-expo-black">
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
