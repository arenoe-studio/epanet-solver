"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/providers/ToastProvider";
import type { AuthActionResponse } from "@/types/auth";

export function VerifyClient(props: {
  initialEmail: string;
  callbackUrl?: string;
}) {
  const router = useRouter();
  const { push } = useToast();

  const [email, setEmail] = useState(props.initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => setEmail(props.initialEmail), [props.initialEmail]);

  async function onVerify() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      const json = (await res.json()) as AuthActionResponse;
      if (!res.ok) {
        push({
          title: "Verifikasi gagal",
          description: json?.error ?? "Terjadi kesalahan.",
          variant: "error"
        });
        setLoading(false);
        return;
      }
      push({ title: "Email terverifikasi", variant: "success" });
      const raw = props.callbackUrl;
      const callbackUrl = raw && raw.startsWith("/") ? raw : "/upload";
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    } catch {
      push({ title: "Verifikasi gagal", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (resending) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verify-email-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      const json = (await res.json()) as AuthActionResponse;
      if (!res.ok) {
        push({
          title: "Gagal kirim ulang",
          description: json?.error ?? "Terjadi kesalahan.",
          variant: "error"
        });
        setResending(false);
        return;
      }
      push({
        title: "Kode terkirim",
        description: "Cek inbox/spam email Anda.",
        variant: "success"
      });
    } catch {
      push({ title: "Gagal kirim ulang", variant: "error" });
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
      <div className="mx-auto max-w-md rounded-3xl border border-border-lavender bg-white p-8 shadow-elevated">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-expo-black">
          Autentikasi OTP
        </h1>
        <p className="mt-2 text-sm text-slate-gray">
          Masukkan kode 6 digit yang dikirim ke email Anda.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <div className="text-xs font-semibold text-slate-gray">Kode</div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              className="mt-1 h-11 w-full rounded-xl border border-border-lavender px-4 text-sm outline-none focus:ring-2 focus:ring-expo-black/10"
              placeholder="6 digit"
            />
          </label>

          <button
            type="button"
            onClick={onVerify}
            disabled={loading || !email || !code}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-expo-black px-7 text-base font-semibold text-white transition disabled:opacity-50 hover:opacity-80 active:scale-[0.98]"
          >
            {loading ? "Mengautentikasi..." : "Autentikasi"}
          </button>

          <button
            type="button"
            onClick={resend}
            disabled={resending || !email}
            className="mx-auto block text-xs font-semibold text-expo-black underline underline-offset-4 disabled:opacity-50"
          >
            {resending ? "Mengirim ulang..." : "Kirim ulang OTP"}
          </button>

          <div className="text-center text-xs text-slate-gray">
            Kembali ke{" "}
            <Link
              href={
                props.callbackUrl
                  ? `/login?callbackUrl=${encodeURIComponent(props.callbackUrl)}`
                  : "/login"
              }
              className="font-semibold text-expo-black"
            >
              Masuk
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
