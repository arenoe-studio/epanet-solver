"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/providers/ToastProvider";
import type { AuthActionResponse } from "@/types/auth";

function getCooldownStorageKey(email: string) {
  return `verify_email_resend_next_at:${email.toLowerCase()}`;
}

export function VerifyEmailNoticeClient(props: {
  email: string;
  sent: boolean;
  reason: string;
}) {
  const router = useRouter();
  const { status } = useSession();
  const { push } = useToast();

  const [resending, setResending] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [router, status]);

  const email = props.email.trim().toLowerCase();
  const storageKey = useMemo(() => (email ? getCooldownStorageKey(email) : null), [email]);

  useEffect(() => {
    if (!storageKey) return;

    if (props.sent) {
      try {
        const nextAt = Date.now() + 60_000;
        localStorage.setItem(storageKey, String(nextAt));
      } catch {}
    }

    const tick = () => {
      let nextAtMs = 0;
      try {
        const raw = localStorage.getItem(storageKey);
        nextAtMs = raw ? Number(raw) : 0;
      } catch {
        nextAtMs = 0;
      }
      const remainingMs = Math.max(0, nextAtMs - Date.now());
      setRemainingSeconds(Math.ceil(remainingMs / 1000));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [props.sent, storageKey]);

  useEffect(() => {
    if (props.reason === "expired") {
      push({
        title: "Link verifikasi kadaluarsa",
        description: "Silakan kirim ulang email verifikasi.",
        variant: "error",
      });
    }
    if (props.reason === "invalid") {
      push({
        title: "Link verifikasi tidak valid",
        description: "Silakan kirim ulang email verifikasi.",
        variant: "error",
      });
    }
  }, [props.reason, push]);

  async function resend() {
    if (resending || remainingSeconds > 0 || !email) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verify-email", {
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
        title: "Email verifikasi terkirim",
        description: "Cek inbox/spam email Anda.",
        variant: "success",
      });

      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(Date.now() + 60_000));
        } catch {}
      }
    } catch {
      push({ title: "Gagal kirim ulang", variant: "error" });
    } finally {
      setResending(false);
    }
  }

  const formatted =
    remainingSeconds > 0
      ? `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(
          remainingSeconds % 60
        ).padStart(2, "0")}`
      : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
      <div className="mx-auto max-w-md rounded-3xl border border-border-lavender bg-white p-8 shadow-elevated">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-expo-black">
          Cek Email Anda
        </h1>
        <p className="mt-2 text-sm text-slate-gray">
          Kami telah mengirim link verifikasi ke:
        </p>
        <div className="mt-2 rounded-2xl border border-border-lavender bg-white px-4 py-3 text-sm font-semibold text-expo-black">
          {email || "-"}
        </div>
        <p className="mt-4 text-sm text-slate-gray">
          Klik link di email tersebut untuk mengaktifkan akun Anda.
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={resend}
            disabled={resending || !email || remainingSeconds > 0}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-expo-black px-7 text-base font-semibold text-white transition disabled:opacity-50 hover:opacity-80 active:scale-[0.98]"
          >
            {resending
              ? "Mengirim..."
              : formatted
                ? `Kirim Ulang Email Verifikasi (${formatted})`
                : "Kirim Ulang Email Verifikasi"}
          </button>
          <div className="text-center text-xs text-slate-gray">
            Cek folder Spam jika tidak ada di Inbox.
          </div>
          <div className="text-center text-xs text-slate-gray">
            Sudah verifikasi?{" "}
            <Link href="/login" className="font-semibold text-expo-black">
              Masuk
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

