import { getBusinessInfo } from "@/lib/business";

export default function TermsPage() {
  const business = getBusinessInfo();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-[-0.035em] text-expo-black">
          Syarat & Ketentuan
        </h1>
        <p className="text-sm text-slate-gray">
          Berlaku untuk penggunaan layanan {business.name}.
        </p>
        <p className="text-xs text-slate-gray">
          Contoh template (Midtrans):{" "}
          <a
            className="text-link-cobalt underline"
            href="/legal/midtrans-tnc-template-13-jan-2017.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Download PDF
          </a>
        </p>
      </header>

      <section className="mt-10 space-y-6 text-sm leading-relaxed text-near-black">
        <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
          <h2 className="text-base font-semibold text-expo-black">Ketentuan Umum</h2>
          <p className="mt-2 text-slate-gray">
            Syarat &amp; Ketentuan ini mengatur akses dan penggunaan layanan {business.name}.
            Dengan mengakses atau menggunakan layanan, Anda menyatakan setuju untuk
            terikat pada ketentuan ini.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">Layanan</h2>
          <p className="mt-2 text-slate-gray">
            {business.name} menyediakan layanan analisis file{" "}
            <span className="font-mono text-near-black">.inp</span> EPANET dan
            menghasilkan output digital yang dapat diunduh. Hasil analisis disediakan
            untuk tujuan edukasi dan/atau asistensi teknis sesuai konteks penggunaan
            Anda, serta diberikan sebagaimana adanya.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">Akun</h2>
          <p className="mt-2 text-slate-gray">
            Untuk menggunakan fitur tertentu (termasuk analisis dan pembelian token),
            Anda dapat diminta untuk masuk menggunakan akun yang didukung. Anda
            bertanggung jawab atas kerahasiaan kredensial serta seluruh aktivitas yang
            terjadi melalui akun Anda.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">
            Token, Harga, dan Pembayaran
          </h2>
          <p className="mt-2 text-slate-gray">
            Pembelian token dilakukan dalam mata uang Rupiah (IDR). Pembayaran diproses
            melalui penyedia pembayaran pihak ketiga (misalnya Midtrans), dan metode
            pembayaran dapat berbeda sesuai ketersediaan. Setelah pembayaran
            terkonfirmasi, token akan ditambahkan ke saldo akun Anda sesuai jumlah yang
            dibeli.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">Penggunaan Token</h2>
          <p className="mt-2 text-slate-gray">
            Token digunakan untuk menjalankan analisis. Jumlah token yang dibutuhkan
            ditampilkan di aplikasi sebelum analisis dijalankan. Token yang telah
            digunakan tidak dapat dikembalikan, kecuali ditentukan lain dalam kebijakan
            yang berlaku.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">
            Kebijakan Pengembalian Dana
          </h2>
          <p className="mt-2 text-slate-gray">
            Ketentuan pengembalian dana diatur dalam halaman{" "}
            <a className="text-link-cobalt underline" href="/refund-policy">
              Refund Policy
            </a>
            .
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">
            Batasan Tanggung Jawab
          </h2>
          <p className="mt-2 text-slate-gray">
            Sejauh diizinkan oleh ketentuan peraturan perundang-undangan yang berlaku,
            {business.name} tidak bertanggung jawab atas kerugian tidak langsung,
            insidental, atau konsekuensial yang timbul dari atau terkait penggunaan
            layanan. Kami dapat melakukan pemeliharaan atau perubahan layanan dari waktu
            ke waktu, termasuk penghentian sementara, tanpa pemberitahuan terlebih
            dahulu apabila diperlukan.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">Kontak</h2>
          <p className="mt-2 text-slate-gray">
            Pertanyaan terkait Syarat &amp; Ketentuan dapat dikirim ke{" "}
            <a className="text-link-cobalt underline" href={`mailto:${business.email}`}>
              {business.email}
            </a>
            .
          </p>
        </div>
      </section>

      <p className="mt-10 text-xs text-slate-gray">
        Terakhir diperbarui: {new Date().toLocaleDateString("id-ID")}
      </p>
    </main>
  );
}
