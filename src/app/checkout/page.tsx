import { CheckoutClient } from "@/app/checkout/CheckoutClient";
import { Suspense } from "react";

export default function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
      <Suspense
        fallback={
          <div className="rounded-2xl border border-border-lavender bg-white p-6 text-sm text-slate-gray shadow-whisper">
            Menyiapkan checkoutâ€¦
          </div>
        }
      >
        <CheckoutClient />
      </Suspense>
    </main>
  );
}

