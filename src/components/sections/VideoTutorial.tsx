const mockNodeRows = [
  { id: "J-1", pressure: "42.3 m", status: "OK" },
  { id: "J-2", pressure: "38.7 m", status: "OK" },
  { id: "J-3", pressure: "11.2 m", status: "OK" },
  { id: "J-4", pressure: "28.9 m", status: "OK" },
];

const mockMetrics = [
  { label: "Node", value: "12" },
  { label: "Pipa", value: "15" },
  { label: "Iterasi", value: "4" },
];

function AppMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-lavender bg-white shadow-elevated">
      <div className="flex items-center gap-1.5 border-b border-border-lavender bg-cloud-gray/60 px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-300" />
        <span className="ml-2 text-xs text-slate-gray">EPANET Solver — Hasil Analisis</span>
      </div>

      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between rounded-xl border border-border-lavender bg-cloud-gray/50 px-4 py-3">
          <span className="text-xs font-semibold text-expo-black">network_skripsi.inp</span>
          <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
            Selesai
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {mockMetrics.map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-border-lavender bg-white px-3 py-2.5 text-center"
            >
              <div className="text-lg font-bold tracking-[-0.04em] text-expo-black">
                {m.value}
              </div>
              <div className="text-[10px] text-slate-gray">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-gray">
            Status Node
          </div>
          {mockNodeRows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-lg bg-cloud-gray/40 px-3 py-1.5 text-xs"
            >
              <span className="font-mono text-near-black">{row.id}</span>
              <span className="text-slate-gray">{row.pressure}</span>
              <span className="font-semibold text-green-600">{row.status}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="flex-1 rounded-xl bg-expo-black px-3 py-2 text-center text-xs font-semibold text-white">
            Download .inp
          </div>
          <div className="flex-1 rounded-xl border border-border-lavender bg-white px-3 py-2 text-center text-xs font-semibold text-near-black">
            Download Laporan
          </div>
        </div>
      </div>
    </div>
  );
}

export function VideoTutorial() {
  return (
    <section className="border-y border-border-lavender bg-cloud-gray/40 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-14">
          <AppMockup />

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Tutorial
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-expo-black">
              Dari AutoCAD ke hasil analisis dalam 10 menit.
            </h2>

            <ul className="mt-4 space-y-2 text-sm text-slate-gray">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-expo-black">→</span>
                Cara konversi gambar AutoCAD ke file{" "}
                <span className="font-mono">.inp</span> menggunakan ePACad
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-expo-black">→</span>
                Cara menggunakan iterasi otomatis di EPANET Solver
              </li>
            </ul>

            <div className="mt-6 flex aspect-video items-center justify-center rounded-2xl border border-border-lavender bg-expo-black/5">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border-lavender bg-white shadow-whisper">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <path d="M6 4l9 5-9 5V4z" fill="currentColor" className="text-expo-black" />
                  </svg>
                </div>
                <div className="mt-3 text-sm font-semibold text-expo-black">
                  Video Tutorial
                </div>
                <div className="mt-1 text-xs text-slate-gray">Coming Soon</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
