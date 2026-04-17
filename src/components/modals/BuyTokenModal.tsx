"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { TOKEN_PACKAGES } from "@/lib/token-packages";
import { formatIdr } from "@/lib/utils";

type BuyTokenModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BuyTokenModal({ open, onOpenChange }: BuyTokenModalProps) {
  const router = useRouter();
  const [isChoosing, setIsChoosing] = useState<null | "starter" | "value">(null);

  function handleChoosePackage(pkg: "starter" | "value") {
    setIsChoosing(pkg);
    onOpenChange(false);
    router.push(`/checkout?package=${pkg}`);
    setIsChoosing(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Beli Token</DialogTitle>
        </DialogHeader>

        <p className="mt-2 text-sm text-slate-gray">
          Pilih paket token, lalu lanjutkan pembayaran di halaman checkout.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>🪙 {TOKEN_PACKAGES.starter.tokens} Token</CardTitle>
              <div className="text-sm text-slate-gray">
                Cukup untuk 1x analisis
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-[-2px] text-expo-black">
                {formatIdr(TOKEN_PACKAGES.starter.amount)}
              </div>
              <Button
                className="mt-4 w-full"
                disabled={isChoosing !== null}
                onClick={() => handleChoosePackage("starter")}
              >
                {isChoosing === "starter" ? "Membuka…" : "Beli Paket Ini"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🪙 {TOKEN_PACKAGES.value.tokens} Token</CardTitle>
              <div className="text-sm text-slate-gray">
                Untuk beberapa iterasi
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-[-2px] text-expo-black">
                {formatIdr(TOKEN_PACKAGES.value.amount)}
              </div>
              <Button
                className="mt-4 w-full"
                disabled={isChoosing !== null}
                onClick={() => handleChoosePackage("value")}
              >
                {isChoosing === "value" ? "Membuka…" : "Beli Paket Ini"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
