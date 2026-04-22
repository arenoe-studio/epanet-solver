"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

type HeroSectionProps = {
  isLoggedIn: boolean;
  onPrimaryAction: () => void;
};

const socialProof = [
  "✓ Akurasi setara EPANET desktop",
  "✓ Token tidak expired",
  "✓ Output siap buka di EPANET",
];

export function HeroSection({ isLoggedIn, onPrimaryAction }: HeroSectionProps) {
  return (
    <section className="pb-12 pt-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border-lavender bg-white px-3 py-1 text-xs font-medium text-slate-gray shadow-whisper">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
            Sesuai Permen PU No. 18/PRT/M/2007
          </div>

          <h1 className="mt-5 text-balance text-5xl font-bold tracking-[-0.04em] text-expo-black md:text-6xl">
            Optimasi Jaringan Distribusi Air.
            <br />
            <span className="text-slate-gray">Tanpa Iterasi Manual.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-gray">
            Upload file <span className="font-mono text-near-black">.inp</span> EPANET,
            sistem menganalisis tekanan dan iterasi diameter secara otomatis, lalu download
            hasilnya.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={onPrimaryAction}>
              {isLoggedIn ? "Mulai Upload" : "Coba Gratis — 5 Token"}
            </Button>
            <Link
              href="/docs"
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border-lavender bg-white px-6 text-sm font-semibold text-near-black shadow-whisper transition-colors hover:bg-cloud-gray active:scale-[0.98]"
            >
              Lihat Dokumentasi →
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {socialProof.map((item) => (
              <div
                key={item}
                className="rounded-full border border-border-lavender bg-white px-3 py-1 text-xs text-slate-gray shadow-whisper"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
