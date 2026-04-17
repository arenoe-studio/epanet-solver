import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border-lavender">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-bold tracking-[-0.025em] text-expo-black">
          EPANET Solver
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-gray">
          <Link className="transition-colors hover:text-expo-black" href="/privacy-policy">
            Kebijakan Privasi
          </Link>
          <Link className="transition-colors hover:text-expo-black" href="/terms">
            Syarat & Ketentuan
          </Link>
          <Link className="transition-colors hover:text-expo-black" href="/refund-policy">
            Refund Policy
          </Link>
          <Link className="transition-colors hover:text-expo-black" href="/contact">
            Kontak
          </Link>
          <span className="opacity-40">© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
