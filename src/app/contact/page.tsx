import { getBusinessInfo } from "@/lib/business";

export default function ContactPage() {
  const business = getBusinessInfo();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-[-0.035em] text-expo-black">
          Kontak
        </h1>
        <p className="text-sm text-slate-gray">
          Informasi kontak bisnis yang bisa dihubungi.
        </p>
      </header>

      <section className="mt-10 grid gap-4">
        <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
          <div className="text-xs font-medium text-slate-gray">Email</div>
          <a
            className="mt-1 block text-sm font-semibold text-link-cobalt underline"
            href={`mailto:${business.email}`}
          >
            {business.email}
          </a>
          <p className="mt-2 text-sm text-slate-gray">
            Kami biasanya merespons pada jam kerja (WIB).
          </p>
        </div>

        {business.phone ? (
          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <div className="text-xs font-medium text-slate-gray">Telepon / WhatsApp</div>
            <a
              className="mt-1 block text-sm font-semibold text-link-cobalt underline"
              href={`tel:${business.phone}`}
            >
              {business.phone}
            </a>
          </div>
        ) : null}

        {business.address ? (
          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <div className="text-xs font-medium text-slate-gray">Alamat</div>
            <div className="mt-1 text-sm font-semibold text-expo-black">
              {business.address}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

