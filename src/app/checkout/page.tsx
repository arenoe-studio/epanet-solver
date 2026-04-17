import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { CheckoutClient } from "@/app/checkout/CheckoutClient";
import { Suspense } from "react";

export default function CheckoutPage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-border-lavender bg-white p-6 text-sm text-slate-gray shadow-whisper">
              Menyiapkan checkout…
            </div>
          }
        >
          <CheckoutClient />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
