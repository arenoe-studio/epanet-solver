import Link from "next/link";

const cards = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <rect x="4" y="2" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: "Kriteria Teknis Permen PU",
    body: "Evaluasi menggunakan batas resmi Permen PU No. 18/PRT/M/2007: tekanan 10–80 m, kecepatan 0.3–2.5 m/s, headloss ≤ 10 m/km.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M4.93 4.93l1.06 1.06M14.01 14.01l1.06 1.06M15.07 4.93l-1.06 1.06M5.99 14.01l-1.06 1.06"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "Optimasi Diameter Otomatis",
    body: "Sistem mengiterasi diameter dari daftar ukuran standar pipa (40–315 mm), menjalankan ulang simulasi tiap iterasi hingga semua kriteria terpenuhi atau konvergen.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M3 6a1 1 0 0 1 1-1h1.5l1-2h7l1 2H17a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="10" cy="10.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    title: "Snapshot Steady-State",
    body: "Analisis dilakukan pada kondisi awal (t=0), bukan Extended Period Simulation. Cocok untuk desain steady-state. Untuk EPS penuh, gunakan EPANET desktop.",
  },
];

export function TechnicalCredibility() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
            Di Balik Sistem
          </div>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-expo-black">
            Apa yang sebenarnya terjadi saat analisis berjalan.
          </h2>
          <p className="mt-3 text-sm text-slate-gray">
            Hasil selalu akurat dan menggunakan standar teknis resmi Indonesia.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cloud-gray text-expo-black">
                {card.icon}
              </div>
              <div className="mt-4 text-base font-semibold tracking-[-0.02em] text-expo-black">
                {card.title}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-gray">{card.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/docs"
            className="text-sm font-semibold text-link-cobalt hover:underline"
          >
            Baca dokumentasi lengkap →
          </Link>
        </div>
      </div>
    </section>
  );
}
