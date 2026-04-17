"use client";

import { useState } from "react";

const faqs = [
  {
    q: "Apakah hasilnya sama persis dengan EPANET desktop?",
    a: "Solver yang digunakan kompatibel dengan EPANET. Ada perbedaan minor karena analisis adalah snapshot steady-state, bukan Extended Period Simulation. Untuk kebutuhan akademik standar, hasilnya equivalent.",
  },
  {
    q: "Kalau token habis di tengah proses, apakah dipotong?",
    a: "Tidak. Token hanya dipotong setelah analisis berhasil selesai. Jika terjadi error, token dikembalikan otomatis.",
  },
  {
    q: "Apakah file .inp saya disimpan di server?",
    a: "Tidak. File hanya ada di server selama proses analisis berjalan, dan otomatis terhapus setelah selesai.",
  },
  {
    q: "Format .inp versi EPANET berapa yang didukung?",
    a: "File .inp dari EPANET 2.x (termasuk 2.2) didukung. Mayoritas file yang dihasilkan EPANET desktop kompatibel.",
  },
  {
    q: "Apakah ada free trial?",
    a: "Ya. Setiap akun baru mendapat 5 token gratis saat pertama kali login — cukup untuk 1x analisis penuh.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-3xl font-bold tracking-[-0.035em] text-expo-black">
            Pertanyaan yang sering muncul.
          </h2>

          <div className="mt-10 space-y-2">
            {faqs.map((faq, i) => (
              <div
                key={faq.q}
                className="overflow-hidden rounded-2xl border border-border-lavender bg-white shadow-whisper"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-expo-black"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  aria-expanded={openIndex === i}
                >
                  {faq.q}
                  <span
                    className={`ml-4 shrink-0 text-slate-gray transition-transform duration-200 ${
                      openIndex === i ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  >
                    ↓
                  </span>
                </button>
                {openIndex === i ? (
                  <div className="border-t border-border-lavender px-5 pb-4 pt-3 text-sm leading-relaxed text-slate-gray">
                    {faq.a}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
