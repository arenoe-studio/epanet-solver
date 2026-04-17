"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

import { AnalysisHistoryModal } from "@/components/modals/AnalysisHistoryModal";
import { BuyTokenModal } from "@/components/modals/BuyTokenModal";
import { TransactionHistoryModal } from "@/components/modals/TransactionHistoryModal";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { UI_EVENT_OPEN_BUY_TOKEN } from "@/lib/ui-events";

export function Navbar() {
  const [buyOpen, setBuyOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";
  const user = session?.user ?? null;

  const { balance: tokenBalance } = useTokenBalance(isLoggedIn);

  useEffect(() => {
    function onOpenBuy() {
      setBuyOpen(true);
      setProfileOpen(false);
    }
    window.addEventListener(UI_EVENT_OPEN_BUY_TOKEN, onOpenBuy);
    return () => window.removeEventListener(UI_EVENT_OPEN_BUY_TOKEN, onOpenBuy);
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!profileOpen) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!profileOpen) return;
      if (e.key === "Escape") setProfileOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileOpen]);

  const initials = useMemo(() => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
  }, [user?.name]);

  return (
    <header className="sticky top-0 z-50 border-b border-border-lavender bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <button
          className="flex items-center gap-2 text-sm font-bold tracking-[-0.03em] text-expo-black transition-opacity hover:opacity-60"
          onClick={() => window.location.reload()}
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="3" fill="currentColor" opacity="0.25" />
            <path
              d="M8 1v2M8 13v2M1 8h2M13 8h2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          EPANET Solver
        </button>

        {!isLoggedIn ? (
          <button
            onClick={() => signIn("google")}
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-expo-black px-5 text-sm font-semibold text-white transition-opacity hover:opacity-80 active:scale-[0.98]"
          >
            Masuk dengan Google
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-border-lavender bg-white px-3 py-1.5 text-xs">
              <span className="text-slate-gray">Token</span>
              <span className="font-bold text-expo-black">{tokenBalance ?? 0}</span>
            </div>

            <button
              onClick={() => {
                setProfileOpen(false);
                setBuyOpen(true);
              }}
              type="button"
              className="rounded-full border border-border-lavender bg-white px-3 py-1.5 text-xs font-semibold text-near-black transition hover:bg-cloud-gray active:scale-[0.98]"
            >
              Beli
            </button>

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-expo-black text-xs font-bold text-white select-none"
                onClick={() => setProfileOpen((v) => !v)}
              >
                {initials}
              </button>

              {profileOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 z-[60] w-60 overflow-hidden rounded-2xl border border-border-lavender bg-white shadow-elevated"
                >
                  <div className="border-b border-border-lavender px-4 py-3">
                    <div className="truncate text-sm font-semibold text-expo-black">
                      {user?.name ?? "User"}
                    </div>
                    <div className="truncate text-xs text-slate-gray">
                      {user?.email ?? ""}
                    </div>
                  </div>
                  <div className="p-1.5">
                    <button
                      role="menuitem"
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-near-black transition-colors hover:bg-cloud-gray"
                      onClick={() => {
                        setProfileOpen(false);
                        setAnalysisOpen(true);
                      }}
                      type="button"
                    >
                      Riwayat Analisis
                    </button>
                    <button
                      role="menuitem"
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-near-black transition-colors hover:bg-cloud-gray"
                      onClick={() => {
                        setProfileOpen(false);
                        setTxOpen(true);
                      }}
                      type="button"
                    >
                      Riwayat Transaksi
                    </button>
                    <div className="my-1 border-t border-border-lavender" />
                    <button
                      role="menuitem"
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-gray transition-colors hover:bg-cloud-gray hover:text-near-black"
                      onClick={() => {
                        setProfileOpen(false);
                        void signOut();
                      }}
                      type="button"
                    >
                      Keluar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <BuyTokenModal open={buyOpen} onOpenChange={setBuyOpen} />
      <AnalysisHistoryModal open={analysisOpen} onOpenChange={setAnalysisOpen} />
      <TransactionHistoryModal open={txOpen} onOpenChange={setTxOpen} />
    </header>
  );
}
