"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { TokenPackageCard } from "@/components/checkout/TokenPackageCard";
import { TOKEN_PACKAGES_LIST } from "@/lib/token-packages";

export function PricingSection() {
  const router = useRouter();
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  return (
    <section id="pricing" className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
            Harga
          </div>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-expo-black">
            Bayar sesuai kebutuhan. Token tidak expired.
          </h2>
          <p className="mt-3 text-sm text-slate-gray">
            1x Analisis = 5 token · Fix Pressure = 3 token · Token tidak pernah kedaluwarsa
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-4">
          {TOKEN_PACKAGES_LIST.map((pkg) => (
            <TokenPackageCard
              key={pkg.key}
              pkg={pkg}
              compact
              onSelect={() => {
                const href = `/checkout?package=${pkg.key}`;
                if (!isLoggedIn) {
                  router.push(`/login?callbackUrl=${encodeURIComponent(href)}`);
                  return;
                }
                router.push(href);
              }}
              ctaLabel={isLoggedIn ? "Beli Sekarang" : "Masuk untuk Membeli"}
            />
          ))}
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-slate-gray">
          Semua analisis akurat 100% — token digunakan untuk akses ke output, bukan untuk
          akurasi.
        </p>
      </div>
    </section>
  );
}
