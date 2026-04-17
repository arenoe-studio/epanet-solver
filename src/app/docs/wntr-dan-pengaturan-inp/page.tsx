export default function WntrInpSettingsDocPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-[-0.035em] text-expo-black">
          WNTR dan Pengaturan EPANET .inp
        </h1>
        <p className="text-sm text-slate-gray">
          Fokus dokumentasi ini: iterasi snapshot{" "}
          <span className="font-mono text-near-black">t=0</span> untuk jaringan
          distribusi air bersih.
        </p>
      </header>

      <section className="mt-10 space-y-6 text-sm leading-relaxed">
        <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
          <h2 className="text-base font-semibold text-expo-black">
            1. Dari mana solver “tahu” setting EPANET?
          </h2>
          <p className="mt-2 text-slate-gray">
            EPANET Solver memuat file{" "}
            <span className="font-mono text-near-black">.inp</span> menjadi model
            jaringan WNTR. Artinya, sumber kebenaran utama untuk pengaturan adalah
            isi file{" "}
            <span className="font-mono text-near-black">.inp</span> itu sendiri
            (bukan setting lokal di EPANET Desktop).
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-gray">
            <li>Topologi node & pipa, demand/pattern, controls/curves.</li>
            <li>
              Opsi hidraulik di{" "}
              <span className="font-mono text-near-black">[OPTIONS]</span> (jika
              ada) akan diparse ke model.
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
          <h2 className="text-base font-semibold text-expo-black">
            2. Kenapa hanya t=0?
          </h2>
          <p className="mt-2 text-slate-gray">
            Untuk kebutuhan saat ini, mesin analisis menjalankan simulasi lalu
            mengambil hasil timestep pertama (snapshot awal). Jadi evaluasi kriteria
            dan iterasi optimasi berjalan di kondisi{" "}
            <span className="font-mono text-near-black">t=0</span>.
          </p>
          <p className="mt-2 text-slate-gray">
            Konsekuensinya: pengaturan Extended Period Simulation (EPS) dan perubahan
            demand sepanjang waktu tidak dievaluasi sepanjang horizon waktu—hanya
            kondisi awal.
          </p>
        </div>

        <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
          <h2 className="text-base font-semibold text-expo-black">
            3. Apakah “formula headloss” dan opsi lain diikuti?
          </h2>
          <p className="mt-2 text-slate-gray">
            Ya, selama opsi tersebut tersimpan di file{" "}
            <span className="font-mono text-near-black">.inp</span> dan didukung
            oleh engine simulasi yang dipakai. Prinsipnya: solver memulai dari model
            hasil parse{" "}
            <span className="font-mono text-near-black">.inp</span>, lalu
            mensimulasikannya.
          </p>
          <p className="mt-2 text-slate-gray">
            Jika kamu mengubah opsi di EPANET Desktop tapi lupa menyimpan ke{" "}
            <span className="font-mono text-near-black">.inp</span>, maka solver
            tidak akan “melihat” perubahan itu.
          </p>
        </div>

        <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
          <h2 className="text-base font-semibold text-expo-black">
            4. Konstanta dan parameter untuk optimasi diameter
          </h2>
          <p className="mt-2 text-slate-gray">
            Sistem melakukan optimasi dengan mengubah diameter pipa lalu rerun
            simulasi. Untuk langkah analitis (perkiraan diameter), koefisien
            roughness (C) diambil dari{" "}
            <span className="font-mono text-near-black">.inp</span> per pipa jika
            tersedia (fallback default jika tidak terbaca).
          </p>
          <p className="mt-2 text-slate-gray">
            Jika network menggunakan model headloss non Hazen-Williams, anggap hasil
            langkah analitis sebagai “starting point” yang tetap divalidasi oleh
            simulasi iteratif.
          </p>
        </div>

        <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
          <h2 className="text-base font-semibold text-expo-black">
            5. Kapan butuh EPANET Toolkit?
          </h2>
          <p className="mt-2 text-slate-gray">
            EPANET Toolkit berguna jika kamu butuh parity yang lebih ketat dengan
            EPANET Desktop (misalnya perilaku controls/opsi tertentu). Namun untuk
            tahap saat ini, kita tetap fokus pada iterasi{" "}
            <span className="font-mono text-near-black">t=0</span> dengan sistem
            yang sudah ada.
          </p>
        </div>
      </section>
    </main>
  );
}

