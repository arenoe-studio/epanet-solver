import Link from "next/link";

export default function DocsIndexPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-[-0.035em] text-expo-black">
          Dokumentasi Teknis
        </h1>
        <p className="text-sm text-slate-gray">
          Arsip dokumentasi internal tentang sistem dan mesin analisis EPANET Solver.
        </p>
      </header>

      <section className="mt-10 space-y-4 text-sm leading-relaxed">
        <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
          <h2 className="text-base font-semibold text-expo-black">Cara Kerja Sistem</h2>
          <p className="mt-2 text-slate-gray">
            Ringkasan alur penggunaan layanan: upload file{" "}
            <span className="font-mono text-near-black">.inp</span>, proses analisis,
            dan unduh hasil.
          </p>
          <div className="mt-4">
            <Link
              className="text-link-cobalt underline underline-offset-4"
              href="/docs/cara-kerja"
            >
              Buka dokumentasi
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
          <h2 className="text-base font-semibold text-expo-black">
            Mesin Simulasi: WNTR & Pengaturan .inp
          </h2>
          <p className="mt-2 text-slate-gray">
            Menjelaskan sumber setting (dari file <span className="font-mono text-near-black">.inp</span>
            ), batasan analisis saat ini (snapshot <span className="font-mono text-near-black">t=0</span>
            ), dan catatan optimasi diameter.
          </p>
          <div className="mt-4">
            <Link
              className="text-link-cobalt underline underline-offset-4"
              href="/docs/wntr-dan-pengaturan-inp"
            >
              Buka dokumentasi
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
