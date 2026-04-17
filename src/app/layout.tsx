import type { Metadata } from "next";
import Script from "next/script";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { AuthSessionProvider } from "@/components/providers/SessionProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";

import "./globals.css";

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
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="font-sans antialiased">
        <AuthSessionProvider>
          <ToastProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <div className="flex-1">{children}</div>
              <Footer />
            </div>
          </ToastProvider>
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
