"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import { HeroSection } from "@/components/sections/HeroSection";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { PricingSection } from "@/components/sections/PricingSection";

export default function HomePage() {
  const router = useRouter();
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
      <div className="space-y-20">
        <HeroSection
          isLoggedIn={isLoggedIn}
          onPrimaryAction={() => {
            if (isLoggedIn) {
              router.push("/upload");
              return;
            }
            signIn("google", { callbackUrl: "/upload" });
          }}
        />
        <div id="how-it-works">
          <HowItWorks />
        </div>
        <div id="pricing">
          <PricingSection />
        </div>
      </div>
    </main>
  );
}
