import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";

import { AuthSessionProvider } from "@/components/providers/SessionProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";

import "./globals.css";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "EPANET Solver",
  description: "Upload. Analisis. Optimasi. Selesai."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isSandbox = process.env.MIDTRANS_IS_PRODUCTION !== "true";
  const snapUrl = `https://app${isSandbox ? ".sandbox" : ""}.midtrans.com/snap/snap.js`;
  const midtransClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

  return (
    <html lang="id" className={fontSans.variable}>
      <body className="font-sans antialiased">
        <AuthSessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthSessionProvider>
        {midtransClientKey ? (
          <Script
            src={snapUrl}
            data-client-key={midtransClientKey}
            strategy="lazyOnload"
          />
        ) : null}
      </body>
    </html>
  );
}
