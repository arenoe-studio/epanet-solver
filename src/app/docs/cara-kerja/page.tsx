export default function CaraKerjaDocsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-[-0.035em] text-expo-black">
          Cara Kerja Sistem
        </h1>
        <p className="text-sm text-slate-gray">
          Ringkasan alur penggunaan EPANET Solver, dari upload hingga hasil unduhan.
        </p>
      </header>

      <section className="mt-10 space-y-6 text-sm leading-relaxed text-slate-gray">
        <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
          <h2 className="text-base font-semibold text-expo-black">1) Upload file .inp</h2>
          <p className="mt-2">
            Anda mengunggah file{" "}
            <span className="font-mono text-near-black">.inp</span> dari EPANET desktop.
            Sistem akan melakukan validasi dasar untuk memastikan file dapat diproses.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">2) Proses analisis</h2>
          <p className="mt-2">
            Setelah file diterima, sistem menjalankan mesin analisis untuk mengevaluasi
            parameter jaringan (misalnya tekanan, kecepatan, dan headloss) sesuai
            ketentuan yang berlaku di aplikasi. Jika fitur optimasi diameter digunakan,
            sistem akan melakukan iterasi diameter pipa secara otomatis sesuai batasan
            yang ditetapkan.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">3) Unduh hasil</h2>
          <p className="mt-2">
            Setelah analisis selesai, Anda dapat mengunduh output digital berupa file
            jaringan yang telah diproses dan laporan ringkasan hasil (before/after) untuk
            kebutuhan verifikasi dan dokumentasi.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">Catatan</h2>
          <p className="mt-2">
            Penggunaan token (jika berlaku) akan diinformasikan di aplikasi sebelum
            analisis dijalankan. Untuk detail teknis terkait mesin simulasi dan batasan
            analisis, lihat dokumentasi teknis lainnya pada menu{" "}
            <span className="font-semibold text-near-black">Dokumentasi</span>.
          </p>
        </div>
      </section>
    </main>
  );
}

