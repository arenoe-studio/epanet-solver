"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { useToast } from "@/components/providers/ToastProvider";
import type { AuthActionResponse } from "@/types/auth";

export function ForgotPasswordClient() {
  const router = useRouter();
  const { status } = useSession();
  const { push } = useToast();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [router, status]);

  async function onSubmit() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const json = (await res.json()) as AuthActionResponse;
      if (!res.ok) {
        push({
          title: "Gagal mengirim link",
          description: json?.error ?? "Terjadi kesalahan.",
          variant: "error",
        });
        setLoading(false);
        return;
      }
      setDone(true);
      push({
        title: "Permintaan diterima",
        description:
          "Jika email ini terdaftar, kami telah mengirim link untuk mengatur ulang password.",
        variant: "success",
      });
    } catch {
      push({ title: "Gagal mengirim link", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
      <div className="mx-auto max-w-md rounded-3xl border border-border-lavender bg-white p-8 shadow-elevated">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-expo-black">
          Lupa Password
        </h1>
        <p className="mt-2 text-sm text-slate-gray">
          Masukkan email terdaftar untuk menerima link reset password.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <div className="text-xs font-semibold text-slate-gray">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="mt-1 h-11 w-full rounded-xl border border-border-lavender px-4 text-sm outline-none focus:ring-2 focus:ring-expo-black/10"
              placeholder="Masukkan email terdaftar"
              disabled={done}
            />
          </label>

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || done || !email}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-expo-black px-7 text-base font-semibold text-white transition disabled:opacity-50 hover:opacity-80 active:scale-[0.98]"
          >
            {loading ? "Mengirim..." : "Kirim Link Reset"}
          </button>

          <div className="text-center text-xs text-slate-gray">
            Kembali ke{" "}
            <Link href="/login" className="font-semibold text-expo-black">
              Masuk
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

