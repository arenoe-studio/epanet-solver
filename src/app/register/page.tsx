"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/providers/ToastProvider";
import { PasswordRequirements, isPasswordValid } from "@/components/auth/PasswordRequirements";
import type { AuthActionResponse } from "@/types/auth";

type RegisterPrefill = {
  email?: string;
  password?: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const { push } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("register_prefill");
      if (raw) {
        const parsed = JSON.parse(raw) as RegisterPrefill;
        if (parsed.email) setEmail(parsed.email);
        if (parsed.password) setPassword(parsed.password);
        sessionStorage.removeItem("register_prefill");
      }
    } catch {}
  }, []);

  async function onRegister() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name || undefined, email, password })
      });
      let json: AuthActionResponse | null = null;
      try {
        json = (await res.json()) as AuthActionResponse;
      } catch {
        json = null;
      }
      if (!res.ok) {
        push({
          title: "Gagal daftar",
          description: json?.error ?? "Terjadi kesalahan.",
          variant: "error"
        });
        setLoading(false);
        return;
      }

      const emailSent = json?.emailSent !== false;
      push(
        emailSent
          ? {
              title: "Akun dibuat",
              description: "Kami mengirim kode verifikasi ke email Anda.",
              variant: "success"
            }
          : {
              title: "Akun dibuat",
              description:
                "Kode verifikasi belum terkirim. Silakan klik “Kirim Kode” di halaman aktivasi.",
              variant: "success"
            }
      );
      router.push(
        emailSent
          ? `/verify?email=${encodeURIComponent(email)}&sent=1`
          : `/verify?email=${encodeURIComponent(email)}`
      );
    } catch {
      push({ title: "Gagal daftar", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
      <div className="mx-auto max-w-md rounded-3xl border border-border-lavender bg-white p-8 shadow-elevated">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-expo-black">
          Daftar
        </h1>
        <p className="mt-2 text-sm text-slate-gray">
          Setelah daftar, verifikasi email dulu.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <div className="text-xs font-semibold text-slate-gray">Nama (opsional)</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              autoComplete="name"
              className="mt-1 h-11 w-full rounded-xl border border-border-lavender px-4 text-sm outline-none focus:ring-2 focus:ring-expo-black/10"
              placeholder="Nama Anda"
            />
          </label>

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
              autoComplete="new-password"
              className="mt-1 h-11 w-full rounded-xl border border-border-lavender px-4 text-sm outline-none focus:ring-2 focus:ring-expo-black/10"
              placeholder="Masukkan password"
            />
          </label>

          {password.length > 0 && <PasswordRequirements password={password} />}

          <button
            type="button"
            onClick={onRegister}
            disabled={loading || !email || !password || !isPasswordValid(password)}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-expo-black px-7 text-base font-semibold text-white transition disabled:opacity-50 hover:opacity-80 active:scale-[0.98]"
          >
            {loading ? "Membuat akun..." : "Buat Akun"}
          </button>

          <div className="text-center text-xs text-slate-gray">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-semibold text-expo-black">
              Masuk
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}


