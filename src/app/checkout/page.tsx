import { redirect } from "next/navigation";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { auth } from "@/lib/auth-server";
import { CheckoutClient } from "@/app/checkout/CheckoutClient";

type CheckoutPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const session = await auth();
  const pkg = typeof searchParams?.package === "string" ? searchParams.package : null;
  const callbackUrl = pkg ? `/checkout?package=${encodeURIComponent(pkg)}` : "/checkout";

  if (!session?.user?.id) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
        <CheckoutClient />
      </main>

      <Footer />
    </div>
  );
}

