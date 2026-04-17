import Link from "next/link";

const cards = [
  {
    icon: "📋",
    title: "Kriteria Teknis Permen PU",
    body: "Evaluasi menggunakan batas resmi Permen PU No. 18/PRT/M/2007: tekanan 10–80 m, kecepatan 0.3–2.5 m/s, headloss ≤ 10 m/km.",
  },
  {
    icon: "⚙️",
    title: "Optimasi Diameter Otomatis",
    body: "Sistem mengiterasi diameter dari daftar ukuran standar pipa (40–315 mm), menjalankan ulang simulasi tiap iterasi hingga semua kriteria terpenuhi atau konvergen.",
  },
  {
    icon: "📸",
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
              <div className="text-2xl">{card.icon}</div>
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
