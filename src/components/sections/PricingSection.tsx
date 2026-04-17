"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { TOKEN_PACKAGES, type TokenPackageKey } from "@/lib/token-packages";
import { formatIdr } from "@/lib/utils";

export function PricingSection() {
  const router = useRouter();
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  const packages = useMemo(() => {
    return (Object.entries(TOKEN_PACKAGES) as Array<[TokenPackageKey, (typeof TOKEN_PACKAGES)[TokenPackageKey]]>)
      .map(([key, pkg]) => ({ key, ...pkg }));
  }, []);

  return (
    <section className="pt-4">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-[-0.035em] text-expo-black">
          Paket Token
        </h2>
        <p className="mt-2 text-sm text-slate-gray">
          Pembayaran dalam Rupiah (IDR). Token akan masuk setelah pembayaran terkonfirmasi.
        </p>
      </div>

      <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
        {packages.map((pkg) => (
          <div
            key={pkg.key}
            className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper"
          >
            <div className="text-base font-semibold text-expo-black">{pkg.name}</div>
            <div className="mt-1 text-sm text-slate-gray">
              {pkg.tokens} token untuk menjalankan analisis.
            </div>
            <div className="mt-5 text-3xl font-semibold tracking-[-2px] text-expo-black">
              {formatIdr(pkg.amount)}
            </div>
            <Button
              className="mt-5 w-full"
              onClick={() => {
                const href = `/checkout?package=${pkg.key}`;
                if (!isLoggedIn) {
                  router.push(`/api/auth/signin?callbackUrl=${encodeURIComponent(href)}`);
                  return;
                }
                router.push(href);
              }}
            >
              {isLoggedIn ? "Lanjut ke Pembayaran" : "Masuk untuk Membeli"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

