"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/providers/ToastProvider";
import type { AuthActionResponse } from "@/types/auth";

function getSafeCallbackUrl(raw: string) {
  return raw && raw.startsWith("/") ? raw : "/dashboard";
}

function getOtpCooldownStorageKey(email: string) {
  return `otp_resend_next_at:login:${email.toLowerCase()}`;
}

export function LoginClient(props: {
  callbackUrl: string;
  initialEmail: string;
  verified: boolean;
  reset: boolean;
}) {
  const router = useRouter();
  const { status } = useSession();
  const { push } = useToast();

  const callbackUrl = getSafeCallbackUrl(props.callbackUrl);

  const [email, setEmail] = useState(props.initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [needsVerify, setNeedsVerify] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpRemainingSeconds, setOtpRemainingSeconds] = useState(0);

  const otpStorageKey = useMemo(
    () => (email ? getOtpCooldownStorageKey(email.trim().toLowerCase()) : null),
    [email]
  );

  useEffect(() => {
    if (status === "authenticated") router.replace(callbackUrl);
  }, [callbackUrl, router, status]);

  useEffect(() => {
    if (props.verified) {
      push({
        title: "Email berhasil diverifikasi",
        description: "Silakan masuk.",
        variant: "success",
      });
    }
    if (props.reset) {
      push({
        title: "Password berhasil diubah",
        description: "Silakan masuk dengan password baru.",
        variant: "success",
      });
    }
  }, [props.reset, props.verified, push]);

  useEffect(() => {
    if (!otpStorageKey) return;

    const tick = () => {
      let nextAtMs = 0;
      try {
        const raw = localStorage.getItem(otpStorageKey);
        nextAtMs = raw ? Number(raw) : 0;
      } catch {
        nextAtMs = 0;
      }
      const remainingMs = Math.max(0, nextAtMs - Date.now());
      setOtpRemainingSeconds(Math.ceil(remainingMs / 1000));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [otpStorageKey]);

  async function resendVerifyEmail() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;
    try {
      const res = await fetch("/api/auth/resend-verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const json = (await res.json()) as AuthActionResponse;
      if (!res.ok) {
        push({
          title: "Gagal kirim ulang",
          description: json?.error ?? "Terjadi kesalahan.",
          variant: "error",
        });
        return;
      }
      push({
        title: "Email verifikasi terkirim",
        description: "Cek inbox/spam email Anda.",
        variant: "success",
      });
      router.push(
        `/verify-email-notice?email=${encodeURIComponent(trimmedEmail)}&sent=1`
      );
    } catch {
      push({ title: "Gagal kirim ulang", variant: "error" });
    }
  }

  async function requestLoginOtp() {
    const trimmedEmail = email.trim().toLowerCase();
    if (sendingOtp || otpRemainingSeconds > 0) return;
    if (!trimmedEmail || !password) return;
    setSendingOtp(true);
    try {
      const res = await fetch("/api/auth/request-login-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const json = (await res.json()) as AuthActionResponse;
      if (!res.ok) {
        const retryAfter = res.headers.get("Retry-After");
        const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
        if (
          res.status === 429 &&
          Number.isFinite(retryAfterSeconds) &&
          retryAfterSeconds > 0 &&
          otpStorageKey
        ) {
          try {
            localStorage.setItem(
              otpStorageKey,
              String(Date.now() + retryAfterSeconds * 1000)
            );
          } catch {}
        }
        push({
          title: "Gagal kirim OTP",
          description: json?.error ?? "Terjadi kesalahan.",
          variant: "error",
        });
        setSendingOtp(false);
        return;
      }

      push({
        title: "OTP terkirim",
        description: "Masukkan kode yang dikirim ke email Anda.",
        variant: "success",
      });

      if (otpStorageKey) {
        try {
          localStorage.setItem(otpStorageKey, String(Date.now() + 60_000));
        } catch {}
      }
    } catch {
      push({ title: "Gagal kirim OTP", variant: "error" });
    } finally {
      setSendingOtp(false);
    }
  }

  async function onSubmit() {
    if (loading) return;
    setLoading(true);
    setNeedsVerify(false);
    setMfaRequired(false);

    const trimmedEmail = email.trim().toLowerCase();
    try {
      const res = await signIn("credentials", {
        redirect: false,
        callbackUrl,
        email: trimmedEmail,
        password,
        otp: otp?.trim() ? otp.trim() : undefined,
      });

      if (res?.ok) {
        router.push(res.url ?? callbackUrl);
        return;
      }

      const checkRes = await fetch("/api/auth/check-credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const checkJson = (await checkRes.json()) as AuthActionResponse;

      if (checkRes.status === 403 && checkJson?.notVerified) {
        setNeedsVerify(true);
        push({
          title: "Email belum diverifikasi",
          description: "Silakan verifikasi email Anda terlebih dahulu.",
          variant: "error",
        });
        setLoading(false);
        return;
      }

      if (checkRes.status === 428 && checkJson?.mfaRequired) {
        setMfaRequired(true);
        push({
          title: "OTP diperlukan",
          description: "Kirim OTP, lalu masukkan kode untuk melanjutkan.",
          variant: "success",
        });
        setLoading(false);
        return;
      }

      if (checkRes.status === 404 && checkJson?.notRegistered) {
        push({
          title: "Akun belum terdaftar",
          description: "Email belum ada. Silakan daftar untuk membuat akun baru.",
          variant: "success",
        });
        router.push(`/register?email=${encodeURIComponent(trimmedEmail)}`);
        setLoading(false);
        return;
      }

      if (checkRes.status === 409 && checkJson?.useOAuth) {
        push({
          title: "Tidak bisa pakai password",
          description: checkJson?.error ?? "Gunakan metode login lain.",
          variant: "error",
        });
        setLoading(false);
        return;
      }

      if (checkRes.status === 401 && checkJson?.passwordWrong) {
        push({
          title: "Password salah",
          description: "Coba lagi atau gunakan fitur lupa password.",
          variant: "error",
        });
        setLoading(false);
        return;
      }

      if (checkRes.status === 429) {
        push({
          title: "Terlalu banyak percobaan",
          description: checkJson?.error ?? "Coba lagi nanti.",
          variant: "error",
        });
        setLoading(false);
        return;
      }

      push({
        title: "Gagal masuk",
        description: checkJson?.error ?? "Email atau password salah.",
        variant: "error",
      });
    } catch {
      push({ title: "Gagal masuk", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  const otpFormatted =
    otpRemainingSeconds > 0
      ? `${String(Math.floor(otpRemainingSeconds / 60)).padStart(2, "0")}:${String(
          otpRemainingSeconds % 60
        ).padStart(2, "0")}`
      : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
      <div className="mx-auto max-w-md rounded-3xl border border-border-lavender bg-white p-8 shadow-elevated">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-expo-black">
          Masuk
        </h1>
        <p className="mt-2 text-sm text-slate-gray">
          Masukkan email dan password untuk masuk.
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
              placeholder="contoh@email.com"
            />
          </label>

          <label className="block">
            <div className="text-xs font-semibold text-slate-gray">Password</div>
            <div className="relative mt-1">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && email && password) onSubmit();
                }}
                className="h-11 w-full rounded-xl border border-border-lavender px-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-expo-black/10"
                placeholder="Masukkan password"
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

          {mfaRequired ? (
            <label className="block">
              <div className="text-xs font-semibold text-slate-gray">Kode OTP</div>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                className="mt-1 h-11 w-full rounded-xl border border-border-lavender px-4 text-sm outline-none focus:ring-2 focus:ring-expo-black/10"
                placeholder="6 digit"
              />
              <button
                type="button"
                onClick={requestLoginOtp}
                disabled={sendingOtp || !email || !password || otpRemainingSeconds > 0}
                className="mt-2 block text-xs font-semibold text-expo-black underline underline-offset-4 disabled:opacity-50"
              >
                {sendingOtp
                  ? "Mengirim OTP..."
                  : otpFormatted
                    ? `Kirim OTP (${otpFormatted})`
                    : "Kirim OTP"}
              </button>
            </label>
          ) : null}

          {needsVerify ? (
            <div className="rounded-2xl border border-border-lavender bg-white px-4 py-3 text-xs text-slate-gray">
              Email belum diverifikasi.{" "}
              <button
                type="button"
                onClick={resendVerifyEmail}
                className="font-semibold text-expo-black underline underline-offset-4"
              >
                Kirim ulang email verifikasi
              </button>
              .
            </div>
          ) : null}

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || !email || !password}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-expo-black px-7 text-base font-semibold text-white transition disabled:opacity-50 hover:opacity-80 active:scale-[0.98]"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>

          <div className="flex items-center justify-between text-xs text-slate-gray">
            <Link href="/forgot-password" className="font-semibold text-expo-black">
              Lupa password?
            </Link>
            <Link href="/register" className="font-semibold text-expo-black">
              Daftar sekarang
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
