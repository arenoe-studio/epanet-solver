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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(props.callbackUrl);
  }, [props.callbackUrl, router, status]);

  async function onLogin() {
    if (loading) return;
    setLoading(true);
    try {
      // Pre-check: deteksi kondisi khusus sebelum signIn
      const checkRes = await fetch("/api/auth/check-credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const checkJson = (await checkRes.json()) as any;

      // Kondisi 1: Email belum terdaftar → arahkan ke halaman daftar
      if (checkRes.status === 401 && checkJson?.notRegistered) {
        sessionStorage.setItem(
          "register_prefill",
          JSON.stringify({ email, password })
        );
        push({
          title: "Akun tidak ditemukan",
          description: "Mengarahkan ke halaman pendaftaran...",
          variant: "error",
        });
        router.push("/register");
        return;
      }

      // Kondisi 2: Sudah daftar tapi belum aktivasi → arahkan ke halaman verifikasi
      if (checkRes.status === 403 && checkJson?.notVerified) {
        push({
          title: "Akun belum diaktivasi",
          description: "Selesaikan verifikasi email untuk mengaktifkan akun Anda.",
          variant: "error",
        });
        router.push(`/verify?email=${encodeURIComponent(email)}`);
        return;
      }

      if (!checkRes.ok) {
        push({
          title: "Login gagal",
          description: checkJson?.error ?? "Email atau password salah.",
          variant: "error",
        });
        setLoading(false);
        return;
      }

      // Credentials valid → langsung login
      const res = await signIn("credentials", {
        redirect: false,
        callbackUrl: props.callbackUrl,
        email,
        password,
      });

      if (!res?.ok) {
        push({
          title: "Login gagal",
          description: "Terjadi kesalahan. Coba lagi.",
          variant: "error",
        });
        setLoading(false);
        return;
      }

      router.push(res.url ?? props.callbackUrl);
    } catch {
      push({ title: "Login gagal", variant: "error" });
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
          Masukkan email dan password akun Anda.
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && email && password) onLogin();
              }}
              className="mt-1 h-11 w-full rounded-xl border border-border-lavender px-4 text-sm outline-none focus:ring-2 focus:ring-expo-black/10"
              placeholder="••••••••••••"
            />
          </label>

          <button
            type="button"
            onClick={onLogin}
            disabled={loading || !email || !password}
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
