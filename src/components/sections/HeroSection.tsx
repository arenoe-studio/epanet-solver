"use client";

import { Button } from "@/components/ui/button";

type HeroSectionProps = {
  isLoggedIn: boolean;
  onPrimaryAction: () => void;
};

const features = [
  "Iterasi diameter pipa otomatis",
  "Output siap dibuka di EPANET",
  "Laporan analisis lengkap",
  "Standar Permen PU No. 18/2007",
];

export function HeroSection({ isLoggedIn, onPrimaryAction }: HeroSectionProps) {
  return (
    <section className="pt-10 pb-4">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border-lavender bg-white px-3 py-1 text-xs font-medium text-slate-gray shadow-whisper">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
          Permen PU No. 18/2007
        </div>

        <h1 className="mt-5 text-balance text-5xl font-bold tracking-[-0.04em] text-expo-black md:text-6xl">
          Analisis Jaringan
          <br />
          <span className="text-slate-gray">Air Bersih Otomatis</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-gray">
          Upload file <span className="font-mono text-near-black">.inp</span> EPANET,
          biarkan sistem mengiterasi diameter pipa secara otomatis, dan unduh hasilnya.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={onPrimaryAction}>
            {isLoggedIn ? "Mulai Upload" : "Mulai — Gratis"}
          </Button>
          {!isLoggedIn && (
            <span className="text-xs text-slate-gray">
              6 token gratis untuk pengguna baru
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto mt-12 grid max-w-2xl gap-2.5 sm:grid-cols-2">
        {features.map((item) => (
          <div
            key={item}
            className="flex items-center gap-2.5 rounded-xl border border-border-lavender bg-white px-4 py-3 text-sm text-near-black shadow-whisper"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
              className="shrink-0 text-expo-black"
            >
              <path
                d="M11.5 3.5L5.5 10.5L2.5 7.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
