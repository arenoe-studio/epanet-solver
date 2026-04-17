import { Suspense } from "react";

import { CheckoutClient } from "@/app/checkout/CheckoutClient";

export default function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-10 md:px-6 md:pt-16">
      <Suspense
        fallback={
          <div className="rounded-2xl border border-border-lavender bg-white p-6 text-sm text-slate-gray shadow-whisper">
            Menyiapkan checkout...
          </div>
        }
      >
        <CheckoutClient />
      </Suspense>
    </main>
  );
}
