import Link from "next/link";

const steps = [
  {
    number: "01",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d="M10 13V4M6 9l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 14v1a2 2 0 002 2h8a2 2 0 002-2v-1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "Upload File .inp",
    description:
      "File dari EPANET desktop langsung diterima. Tidak perlu konversi format.",
  },
  {
    number: "02",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "Analisis Otomatis",
    description:
      "Sistem mengevaluasi tekanan, kecepatan, dan headloss. Iterasi diameter berjalan otomatis.",
  },
  {
    number: "03",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d="M10 4v9M6 9l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 14v1a2 2 0 002 2h8a2 2 0 002-2v-1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "Download Hasil",
    description:
      "Dua file siap unduh: jaringan yang sudah dioptimasi dan laporan lengkap Before vs After.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
            Cara Kerja
          </div>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-expo-black">
            Tiga langkah. Satu klik analisis.
          </h2>
        </div>

        <div className="relative mt-12 grid gap-4 md:grid-cols-3">
          <div
            aria-hidden
            className="pointer-events-none absolute left-[calc(33.33%+1rem)] right-[calc(33.33%+1rem)] top-8 hidden border-t border-dashed border-border-lavender md:block"
          />

          {steps.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cloud-gray text-near-black">
                  {s.icon}
                </div>
                <div className="text-3xl font-bold tracking-[-0.04em] text-border-lavender">
                  {s.number}
                </div>
              </div>
              <div className="mt-4 text-base font-semibold tracking-[-0.02em] text-expo-black">
                {s.title}
              </div>
              <div className="mt-1.5 text-sm leading-relaxed text-slate-gray">
                {s.description}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-slate-gray">
          Ingin tahu lebih dalam cara kerja solver?{" "}
          <Link
            href="/docs"
            className="font-semibold text-link-cobalt hover:underline"
          >
            Baca dokumentasi teknis →
          </Link>
        </div>
      </div>
    </section>
  );
}
