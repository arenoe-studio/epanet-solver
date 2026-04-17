"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/providers/ToastProvider";

export function LoginClient(props: { callbackUrl: string }) {
  const router = useRouter();
  const { status } = useSession();
  const { push } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(props.callbackUrl);
  }, [props.callbackUrl, router, status]);

  async function requestCode() {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/auth/request-login-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const json = (await res.json()) as any;
      if (!res.ok) {
        push({
          title: "Gagal kirim kode",
          description: json?.error ?? "Terjadi kesalahan.",
          variant: "error"
        });
        setSending(false);
        return;
      }
      push({
        title: "Kode terkirim",
        description: "Cek inbox/spam email Anda.",
        variant: "success"
      });
    } catch {
      push({ title: "Gagal kirim kode", variant: "error" });
    } finally {
      setSending(false);
    }
  }

  async function onLogin() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        callbackUrl: props.callbackUrl,
        email,
        password,
        otp: code
      });
      if (!res?.ok) {
        push({
          title: "Login gagal",
          description:
            "Pastikan email sudah diverifikasi, password benar, dan kode login terbaru masih berlaku.",
          variant: "error"
        });
        setLoading(false);
        return;
      }
      router.push(res.url ?? props.callbackUrl);
    } catch {
      push({ title: "Login gagal", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
      <div className="mx-auto max-w-md rounded-3xl border border-border-lavender bg-white p-8 shadow-elevated">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-expo-black">
          Masuk
        </h1>
        <p className="mt-2 text-sm text-slate-gray">
          Login email & password + kode verifikasi.
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
              placeholder="you@email.com"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-slate-gray">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-1 h-11 w-full rounded-xl border border-border-lavender px-4 text-sm outline-none focus:ring-2 focus:ring-expo-black/10"
              placeholder="••••••••••••"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={requestCode}
              disabled={sending || !email || !password}
              className="inline-flex h-10 items-center rounded-full border border-border-lavender bg-white px-5 text-sm font-semibold text-near-black transition disabled:opacity-50 hover:bg-cloud-gray active:scale-[0.98]"
            >
              {sending ? "Mengirim..." : "Kirim Kode Login"}
            </button>
            <Link
              href={`/verify?email=${encodeURIComponent(email)}`}
              className="inline-flex h-10 items-center rounded-full border border-border-lavender bg-white px-5 text-sm font-semibold text-near-black transition hover:bg-cloud-gray active:scale-[0.98]"
            >
              Verifikasi Email
            </Link>
          </div>

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
            onClick={onLogin}
            disabled={loading || !email || !password || !code}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-expo-black px-7 text-base font-semibold text-white transition disabled:opacity-50 hover:opacity-80 active:scale-[0.98]"
          >
            {loading ? "Masuk..." : "Masuk"}
          </button>

          <div className="text-center text-xs text-slate-gray">
            Belum punya akun?{" "}
            <Link href="/register" className="font-semibold text-expo-black">
              Daftar
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

