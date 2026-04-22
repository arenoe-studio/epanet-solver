"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import { FAQSection } from "@/components/sections/FAQSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { NetworkPreviewStrip } from "@/components/sections/NetworkPreviewStrip";
import { PricingSection } from "@/components/sections/PricingSection";
import { TechnicalCredibility } from "@/components/sections/TechnicalCredibility";
import { VideoTutorial } from "@/components/sections/VideoTutorial";

export default function HomePage() {
  const router = useRouter();
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  return (
    <main>
      <HeroSection
        isLoggedIn={isLoggedIn}
        onPrimaryAction={() => {
          if (isLoggedIn) {
            router.push("/dashboard");
            return;
          }
          router.push("/login?callbackUrl=%2Fdashboard");
        }}
      />
      <NetworkPreviewStrip />
      <TechnicalCredibility />
      <VideoTutorial />
      <PricingSection />
      <FAQSection />
    </main>
  );
}
