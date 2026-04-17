"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { TOKEN_PACKAGES, type TokenPackageKey } from "@/lib/token-packages";
import { formatIdr } from "@/lib/utils";
import { useToast } from "@/components/providers/ToastProvider";
import { useTokenBalance } from "@/hooks/useTokenBalance";

type UiState = "idle" | "creating" | "ready" | "success" | "pending" | "error";

export function CheckoutClient() {
  const searchParams = useSearchParams();
  const { push } = useToast();
  const { refresh } = useTokenBalance(true);

  const [selectedPackage, setSelectedPackage] = useState<TokenPackageKey | null>(null);
  const [state, setState] = useState<UiState>("idle");
  const [orderId, setOrderId] = useState<string | null>(null);

  const initialPackage = useMemo(() => {
    const pkg = searchParams.get("package");
    if (pkg === "starter" || pkg === "value") return pkg;
    return null;
  }, [searchParams]);

  useEffect(() => {
    if (initialPackage && !selectedPackage) setSelectedPackage(initialPackage);
  }, [initialPackage, selectedPackage]);

  const startCheckout = useCallback(
    async (pkg: TokenPackageKey) => {
      setSelectedPackage(pkg);
      setState("creating");
      setOrderId(null);

      try {
        const res = await fetch("/api/token/create-transaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ package: pkg })
        });
        const json = (await res.json()) as { snapToken?: string; orderId?: string; error?: string };

        if (!res.ok || !json.snapToken) {
          setState("error");
          push({
            title: "Gagal membuat transaksi",
            description: json.error ?? "Coba lagi.",
            variant: "error"
          });
          return;
        }

        setOrderId(json.orderId ?? null);

        const snap = (window as any).snap as undefined | { embed?: (token: string, options: any) => void };

        if (!snap?.embed) {
          setState("error");
          push({
            title: "Snap.js belum siap",
            description:
              "Pastikan NEXT_PUBLIC_MIDTRANS_CLIENT_KEY sudah diset dan refresh halaman.",
            variant: "error"
          });
          return;
        }

        setState("ready");
        snap.embed(json.snapToken, {
          embedId: "snap-container",
          onSuccess: () => {
            setState("success");
            void refresh();
            push({
              title: "Pembayaran sukses",
              description: "Token akan masuk setelah webhook Midtrans diproses.",
              variant: "success"
            });
          },
          onPending: () => {
            setState("pending");
            push({
              title: "Transaksi pending",
              description: "Selesaikan pembayaran di Snap.",
              variant: "info"
            });
          },
          onError: () => {
            setState("error");
            push({ title: "Pembayaran gagal", variant: "error" });
          }
        });
      } catch {
        setState("error");
        push({ title: "Terjadi kesalahan sistem", variant: "error" });
      }
    },
    [push, refresh]
  );

  const pkg = selectedPackage ? TOKEN_PACKAGES[selectedPackage] : null;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-[-0.035em] text-expo-black">Checkout</h1>
        <p className="text-sm text-slate-gray">
          Halaman pembayaran token (IDR) untuk layanan EPANET Solver.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {(Object.keys(TOKEN_PACKAGES) as TokenPackageKey[]).map((key) => {
          const p = TOKEN_PACKAGES[key];
          const isActive = key === selectedPackage;
          return (
            <div
              key={key}
              className={`rounded-2xl border bg-white p-6 shadow-whisper ${
                isActive ? "border-expo-black" : "border-border-lavender"
              }`}
            >
              <div className="text-base font-semibold text-expo-black">{p.name}</div>
              <div className="mt-1 text-sm text-slate-gray">{p.tokens} token</div>
              <div className="mt-5 text-2xl font-semibold tracking-[-1px] text-expo-black">
                {formatIdr(p.amount)}
              </div>
              <Button
                className="mt-5 w-full"
                disabled={state === "creating" && isActive}
                onClick={() => void startCheckout(key)}
              >
                {state === "creating" && isActive ? "Menyiapkan pembayaran…" : "Pilih Paket"}
              </Button>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-expo-black">Pembayaran</div>
            <div className="mt-1 text-xs text-slate-gray">
              {pkg ? (
                <>
                  Paket: <span className="font-medium text-near-black">{pkg.name}</span>{" "}
                  • Total: <span className="font-medium text-near-black">{formatIdr(pkg.amount)}</span>
                  {orderId ? (
                    <>
                      {" "}
                      • Order: <span className="font-mono text-near-black">{orderId}</span>
                    </>
                  ) : null}
                </>
              ) : (
                "Pilih paket untuk memulai."
              )}
            </div>
          </div>
          {state === "error" ? (
            <Button
              variant="outline"
              onClick={() => {
                if (selectedPackage) void startCheckout(selectedPackage);
              }}
              disabled={!selectedPackage}
            >
              Coba Lagi
            </Button>
          ) : null}
        </div>

        <div className="mt-5">
          <div id="snap-container" className="min-h-[420px]" />
        </div>

        {state === "success" ? (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Pembayaran sukses. Jika token belum masuk dalam beberapa menit, cek Riwayat Transaksi atau hubungi{" "}
            <a className="underline" href="/contact">
              Kontak
            </a>
            .
          </div>
        ) : null}
      </section>
    </div>
  );
}
