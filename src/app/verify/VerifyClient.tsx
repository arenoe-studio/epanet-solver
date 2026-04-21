"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { useToast } from "@/components/providers/ToastProvider";
import type { AuthActionResponse } from "@/types/auth";

type PostVerifyLogin = {
  email: string;
  password: string;
  callbackUrl: string;
};

function getCooldownStorageKey(email: string) {
  return `otp_resend_next_at:verify_email:${email.toLowerCase()}`;
}

function getSafeCallbackUrl(raw?: string) {
  return raw && raw.startsWith("/") ? raw : "/upload";
}

export function VerifyClient(props: {
  initialEmail: string;
  callbackUrl?: string;
  initialResendCooldownSeconds?: number;
}) {
  const router = useRouter();
  const { push } = useToast();

  const [email, setEmail] = useState(props.initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendRemainingSeconds, setResendRemainingSeconds] = useState(0);

  useEffect(() => setEmail(props.initialEmail), [props.initialEmail]);

  const storageKey = useMemo(() => (email ? getCooldownStorageKey(email) : null), [email]);

  useEffect(() => {
    if (!storageKey) return;

    let timer: number | null = null;

    const tick = () => {
      let nextAtMs = 0;
      try {
        const raw = localStorage.getItem(storageKey);
        nextAtMs = raw ? Number(raw) : 0;
      } catch {
        nextAtMs = 0;
      }

      const remainingMs = Math.max(0, nextAtMs - Date.now());
      setResendRemainingSeconds(Math.ceil(remainingMs / 1000));
    };

    try {
      const existing = localStorage.getItem(storageKey);
      const shouldInit =
        !existing && (props.initialResendCooldownSeconds ?? 0) > 0;
      if (shouldInit) {
        const nextAt =
          Date.now() + (props.initialResendCooldownSeconds ?? 0) * 1000;
        localStorage.setItem(storageKey, String(nextAt));
      }
    } catch {}

    tick();
    timer = window.setInterval(tick, 1000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [props.initialResendCooldownSeconds, storageKey]);

  async function onVerify() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const json = (await res.json()) as AuthActionResponse;
      if (!res.ok) {
        push({
          title: "Autentikasi gagal",
          description: json?.error ?? "Terjadi kesalahan.",
          variant: "error",
        });
        setLoading(false);
        return;
      }

      push({
        title: "Berhasil",
        description: "Kode OTP valid.",
        variant: "success",
      });

      let postVerify: PostVerifyLogin | null = null;
      try {
        const raw = sessionStorage.getItem("post_verify_login");
        postVerify = raw ? (JSON.parse(raw) as PostVerifyLogin) : null;
      } catch {
        postVerify = null;
      }

      const callbackUrl = getSafeCallbackUrl(postVerify?.callbackUrl ?? props.callbackUrl);
      const sameEmail =
        postVerify?.email?.toLowerCase() &&
        postVerify.email.toLowerCase() === email.toLowerCase();

      if (sameEmail && postVerify?.password) {
        try {
          const signRes = await signIn("credentials", {
            redirect: false,
            callbackUrl,
            email: postVerify.email,
            password: postVerify.password,
          });

          if (signRes?.ok) {
            try {
              sessionStorage.removeItem("post_verify_login");
            } catch {}
            router.push(signRes.url ?? callbackUrl);
            return;
          }
        } catch {}
      }

      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    } catch {
      push({ title: "Autentikasi gagal", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (resending || resendRemainingSeconds > 0) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verify-email-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as AuthActionResponse;
      if (!res.ok) {
        const retryAfter = res.headers.get("Retry-After");
        const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
        if (
          res.status === 429 &&
          Number.isFinite(retryAfterSeconds) &&
          retryAfterSeconds > 0 &&
          storageKey
        ) {
          try {
            localStorage.setItem(
              storageKey,
              String(Date.now() + retryAfterSeconds * 1000)
            );
          } catch {}
        }

        push({
          title: "Gagal kirim ulang",
          description: json?.error ?? "Terjadi kesalahan.",
          variant: "error",
        });
        setResending(false);
        return;
      }

      push({
        title: "OTP terkirim",
        description: "Cek inbox/spam email Anda.",
        variant: "success",
      });

      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(Date.now() + 60 * 1000));
        } catch {}
      }
    } catch {
      push({ title: "Gagal kirim ulang", variant: "error" });
    } finally {
      setResending(false);
    }
  }

  const formattedRemaining =
    resendRemainingSeconds > 0
      ? `${String(Math.floor(resendRemainingSeconds / 60)).padStart(2, "0")}:${String(
          resendRemainingSeconds % 60
        ).padStart(2, "0")}`
      : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
      <div className="mx-auto max-w-md rounded-3xl border border-border-lavender bg-white p-8 shadow-elevated">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-expo-black">
          Autentikasi OTP
        </h1>
        <p className="mt-2 text-sm text-slate-gray">
          Masukkan kode 6 digit yang dikirim ke email Anda.
        </p>
        {email && (
          <div className="mt-3 text-xs text-slate-gray">
            Dikirim ke <span className="font-semibold text-near-black">{email}</span>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <label className="block">
            <div className="text-xs font-semibold text-slate-gray">Kode</div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              onKeyDown={(e) => {
                if (e.key === "Enter" && email && code) onVerify();
              }}
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
            disabled={resending || !email || resendRemainingSeconds > 0}
            className="mx-auto block text-xs font-semibold text-expo-black underline underline-offset-4 disabled:opacity-50"
          >
            {resending
              ? "Mengirim ulang..."
              : formattedRemaining
                ? `Kirim ulang OTP (${formattedRemaining})`
                : "Kirim ulang OTP"}
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
