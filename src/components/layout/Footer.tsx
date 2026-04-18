import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border-lavender bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="text-sm font-bold tracking-[-0.025em] text-expo-black">
              EPANET Solver
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-gray">
              Tools analisis jaringan distribusi air untuk mahasiswa teknik.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Tautan
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/docs"
                className="text-sm text-near-black transition-colors hover:text-expo-black"
              >
                Dokumentasi
              </Link>
              <Link
                href="/#how-it-works"
                className="text-sm text-near-black transition-colors hover:text-expo-black"
              >
                Cara Kerja
              </Link>
              <Link
                href="/#pricing"
                className="text-sm text-near-black transition-colors hover:text-expo-black"
              >
                Pricing
              </Link>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Bantuan
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/contact"
                className="text-sm text-near-black transition-colors hover:text-expo-black"
              >
                Kirim Feedback / Saran
              </Link>
              <Link
                href="/contact"
                className="text-sm text-near-black transition-colors hover:text-expo-black"
              >
                Kontak
              </Link>
              <Link
                href="/privacy-policy"
                className="text-sm text-near-black transition-colors hover:text-expo-black"
              >
                Kebijakan Privasi
              </Link>
              <Link
                href="/terms"
                className="text-sm text-near-black transition-colors hover:text-expo-black"
              >
                Syarat &amp; Ketentuan
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-1 border-t border-border-lavender pt-6">
          <span className="text-xs text-slate-gray">
            © {new Date().getFullYear()} EPANET Solver
          </span>
          <span className="text-xs text-slate-gray">
            Dibuat untuk mahasiswa teknik sipil dan lingkungan Indonesia.
          </span>
        </div>
      </div>
    </footer>
  );
}
