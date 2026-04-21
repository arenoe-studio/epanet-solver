"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { useToast } from "@/components/providers/ToastProvider";
import type { AuthActionResponse } from "@/types/auth";

function getPasswordChecks(password: string) {
  return {
    minLen: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    symbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
}

export function ResetPasswordClient(props: { email: string; token: string }) {
  const router = useRouter();
  const { status } = useSession();
  const { push } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [router, status]);

  const checks = useMemo(() => getPasswordChecks(password), [password]);
  const allChecksOk =
    checks.minLen && checks.upper && checks.lower && checks.digit && checks.symbol;

  async function onSubmit() {
    if (loading) return;
    if (!props.email || !props.token) {
      push({
        title: "Link tidak valid",
        description: "Token reset tidak ditemukan.",
        variant: "error",
      });
      return;
    }

    if (!allChecksOk) {
      push({
        title: "Password belum memenuhi syarat",
        description: "Lengkapi semua checklist password.",
        variant: "error",
      });
      return;
    }

    if (password !== confirmPassword) {
      push({
        title: "Konfirmasi password tidak cocok",
        description: "Ulangi password yang sama.",
        variant: "error",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: props.email.trim().toLowerCase(),
          token: props.token,
          password,
          confirmPassword,
        }),
      });
      const json = (await res.json()) as AuthActionResponse;
      if (!res.ok) {
        push({
          title: "Gagal reset password",
          description: json?.error ?? "Terjadi kesalahan.",
          variant: "error",
        });
        setLoading(false);
        return;
      }
      router.push(
        `/login?reset=1&email=${encodeURIComponent(props.email.trim().toLowerCase())}`
      );
    } catch {
      push({ title: "Gagal reset password", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  const checklist = [
    { ok: checks.minLen, label: "Minimal 8 karakter" },
    { ok: checks.upper, label: "Mengandung huruf besar (A-Z)" },
    { ok: checks.lower, label: "Mengandung huruf kecil (a-z)" },
    { ok: checks.digit, label: "Mengandung angka (0-9)" },
    { ok: checks.symbol, label: "Mengandung simbol (!, @, #, $, dll)" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
      <div className="mx-auto max-w-md rounded-3xl border border-border-lavender bg-white p-8 shadow-elevated">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-expo-black">
          Reset Password
        </h1>
        <p className="mt-2 text-sm text-slate-gray">
          Buat password baru untuk akun <span className="font-semibold">{props.email || "-"}</span>.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <div className="text-xs font-semibold text-slate-gray">Password baru</div>
            <div className="relative mt-1">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="h-11 w-full rounded-xl border border-border-lavender px-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-expo-black/10"
                placeholder="Buat password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-expo-black hover:bg-cloud-gray"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? "Tutup" : "Lihat"}
              </button>
            </div>
          </label>

          <div className="rounded-2xl border border-border-lavender bg-white px-4 py-3">
            <div className="text-xs font-semibold text-slate-gray">
              Syarat password
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className={item.ok ? "text-emerald-700" : "text-slate-gray"}
                >
                  {item.ok ? "✓" : "•"} {item.label}
                </li>
              ))}
            </ul>
          </div>

          <label className="block">
            <div className="text-xs font-semibold text-slate-gray">
              Konfirmasi password
            </div>
            <div className="relative mt-1">
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSubmit();
                }}
                className="h-11 w-full rounded-xl border border-border-lavender px-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-expo-black/10"
                placeholder="Ulangi password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-expo-black hover:bg-cloud-gray"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showConfirm ? "Tutup" : "Lihat"}
              </button>
            </div>
          </label>

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || !password || !confirmPassword}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-expo-black px-7 text-base font-semibold text-white transition disabled:opacity-50 hover:opacity-80 active:scale-[0.98]"
          >
            {loading ? "Memproses..." : "Simpan Password Baru"}
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

