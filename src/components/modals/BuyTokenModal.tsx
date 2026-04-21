"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TokenPackageCard } from "@/components/checkout/TokenPackageCard";
import { TOKEN_PACKAGES_LIST, type TokenPackageKey } from "@/lib/token-packages";

type BuyTokenModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BuyTokenModal({ open, onOpenChange }: BuyTokenModalProps) {
  const router = useRouter();
  const [isChoosing, setIsChoosing] = useState<TokenPackageKey | null>(null);

  function handleChoosePackage(pkg: TokenPackageKey) {
    setIsChoosing(pkg);
    onOpenChange(false);
    router.push(`/checkout?package=${pkg}`);
    setIsChoosing(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl 2xl:max-w-7xl">
        <DialogHeader>
          <DialogTitle>Beli Token</DialogTitle>
        </DialogHeader>

        <p className="mt-2 text-sm text-slate-gray">
          Pilih paket token, lalu lanjutkan pembayaran di halaman checkout.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {TOKEN_PACKAGES_LIST.map((pkg) => (
            <TokenPackageCard
              key={pkg.key}
              pkg={pkg}
              compact
              ctaLabel={isChoosing === pkg.key ? "Membuka..." : "Pilih Paket"}
              disabled={isChoosing !== null}
              onSelect={() => handleChoosePackage(pkg.key)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
