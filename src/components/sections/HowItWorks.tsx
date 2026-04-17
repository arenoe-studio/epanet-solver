const steps = [
  {
    number: "01",
    title: "Upload",
    description: "Upload file .inp dari EPANET ke sistem."
  },
  {
    number: "02",
    title: "Analisis",
    description: "Sistem cek pelanggaran pressure, velocity, dan headloss."
  },
  {
    number: "03",
    title: "Download",
    description: "Unduh file .inp teroptimasi dan laporan analisis."
  }
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-4xl">
      <h2 className="text-center text-3xl font-bold tracking-[-0.035em] text-expo-black">
        Cara Kerja
      </h2>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-slate-gray">
        3 langkah sederhana untuk mengoptimasi jaringan distribusi air.
      </p>

      <div className="mt-10 grid gap-3 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl border border-border-lavender bg-white p-5 shadow-whisper"
          >
            <div className="text-3xl font-bold tracking-[-0.04em] text-border-lavender">
              {s.number}
            </div>
            <div className="mt-3 text-base font-semibold tracking-[-0.02em] text-expo-black">
              {s.title}
            </div>
            <div className="mt-1.5 text-sm leading-relaxed text-slate-gray">
              {s.description}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
