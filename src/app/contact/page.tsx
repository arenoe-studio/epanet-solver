"use client";

import { useState } from "react";

const BUSINESS_EMAIL =
  process.env.NEXT_PUBLIC_BUSINESS_EMAIL ?? "support@epanet-solver.com";
const BUSINESS_PHONE = process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? null;

const TOPICS = [
  "Pertanyaan umum",
  "Laporan bug / masalah teknis",
  "Saran fitur baru",
  "Masalah pembayaran / token",
  "Lainnya"
];

function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7 10-7" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 12 19.79 19.79 0 0 1 .93 3.18 2 2 0 0 1 2.91 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91A16 16 0 0 0 13 14.83l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22 11 13 2 9l20-7z" />
    </svg>
  );
}

type FormState = "idle" | "sending" | "success" | "error";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic) { setErrorMsg("Pilih topik terlebih dahulu."); return; }
    if (message.trim().length < 10) { setErrorMsg("Pesan minimal 10 karakter."); return; }
    setErrorMsg("");
    setFormState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), topic, message: message.trim() })
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setErrorMsg(json.error ?? "Terjadi kesalahan. Coba lagi.");
        setFormState("error");
        return;
      }
      setFormState("success");
    } catch {
      setErrorMsg("Tidak dapat terhubung ke server. Coba lagi.");
      setFormState("error");
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 pb-24 pt-14">

      {/* Header */}
      <div className="mb-10">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
          Bantuan
        </div>
        <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.04em] text-expo-black">
          Kontak & Kotak Saran
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-gray">
          Kirim pertanyaan, laporan bug, atau saran — kami baca dan respons semuanya.
        </p>
      </div>

      {/* Contact info cards */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <a
          href={`mailto:${BUSINESS_EMAIL}`}
          className="group flex items-start gap-3.5 rounded-2xl border border-border-lavender bg-white p-5 shadow-whisper transition hover:border-near-black/30 hover:shadow-sm"
        >
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-lavender bg-cloud-gray text-slate-gray group-hover:bg-expo-black group-hover:text-white group-hover:border-expo-black transition-colors">
            <IconMail />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.07em] text-slate-gray">
              Email
            </div>
            <div className="mt-0.5 text-sm font-semibold text-expo-black group-hover:underline">
              {BUSINESS_EMAIL}
            </div>
            <div className="mt-1 text-xs text-slate-gray">Respons dalam 1×24 jam (WIB)</div>
          </div>
        </a>

        {BUSINESS_PHONE ? (
          <a
            href={`https://wa.me/${BUSINESS_PHONE.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3.5 rounded-2xl border border-border-lavender bg-white p-5 shadow-whisper transition hover:border-near-black/30 hover:shadow-sm"
          >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-lavender bg-cloud-gray text-slate-gray group-hover:bg-expo-black group-hover:text-white group-hover:border-expo-black transition-colors">
              <IconPhone />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.07em] text-slate-gray">
                WhatsApp
              </div>
              <div className="mt-0.5 text-sm font-semibold text-expo-black group-hover:underline">
                {BUSINESS_PHONE}
              </div>
              <div className="mt-1 text-xs text-slate-gray">Senin–Jumat, 08.00–17.00 WIB</div>
            </div>
          </a>
        ) : (
          <div className="flex items-start gap-3.5 rounded-2xl border border-border-lavender bg-cloud-gray/40 p-5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-lavender bg-cloud-gray text-slate-gray">
              <IconPhone />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.07em] text-slate-gray">
                WhatsApp
              </div>
              <div className="mt-0.5 text-sm text-slate-gray">Segera tersedia</div>
              <div className="mt-1 text-xs text-slate-gray">Hubungi via email sementara ini</div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestion box */}
      <div className="rounded-2xl border border-border-lavender bg-white shadow-whisper">
        <div className="border-b border-border-lavender px-6 py-5">
          <h2 className="text-base font-bold tracking-[-0.02em] text-expo-black">
            Kirim Pesan
          </h2>
          <p className="mt-1 text-sm text-slate-gray">
            Pertanyaan, laporan bug, atau saran untuk pengembangan EPANET Solver.
          </p>
        </div>

        {formState === "success" ? (
          <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-green-200 bg-green-50 text-green-600">
              <IconCheck />
            </div>
            <div>
              <div className="text-base font-semibold text-expo-black">
                Pesan terkirim!
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-gray">
                Terima kasih atas masukan Anda. Kami akan merespons ke{" "}
                <span className="font-medium text-near-black">{email}</span> secepatnya.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setName(""); setEmail(""); setTopic(""); setMessage("");
                setFormState("idle");
              }}
              className="mt-2 rounded-full border border-border-lavender bg-white px-5 py-2 text-sm font-semibold text-near-black transition hover:bg-cloud-gray active:scale-[0.98]"
            >
              Kirim pesan lain
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="px-6 py-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="contact-name" className="block text-sm font-medium text-near-black">
                  Nama
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Nama Anda"
                  className="w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-email" className="block text-sm font-medium text-near-black">
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="email@contoh.com"
                  className="w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contact-topic" className="block text-sm font-medium text-near-black">
                Topik
              </label>
              <select
                id="contact-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                className="w-full appearance-none rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
              >
                <option value="" disabled>Pilih topik...</option>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contact-message" className="block text-sm font-medium text-near-black">
                Pesan
              </label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                minLength={10}
                maxLength={3000}
                rows={5}
                placeholder="Tuliskan pertanyaan, laporan, atau saran Anda di sini..."
                className="w-full resize-y rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
              />
              <div className="text-right text-xs text-slate-gray">
                {message.length} / 3000
              </div>
            </div>

            {(formState === "error" || errorMsg) && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMsg || "Terjadi kesalahan. Coba lagi."}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-gray">
                Pesan dikirim langsung ke tim kami.
              </p>
              <button
                type="submit"
                disabled={formState === "sending"}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-expo-black px-6 text-sm font-semibold text-white transition hover:opacity-80 active:scale-[0.98] disabled:opacity-50"
              >
                {formState === "sending" ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
                    Mengirim…
                  </>
                ) : (
                  <>
                    <IconSend />
                    Kirim Pesan
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
