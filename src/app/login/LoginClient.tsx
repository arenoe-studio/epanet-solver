"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/providers/ToastProvider";
import type { AuthActionResponse } from "@/types/auth";

type PostVerifyLogin = {
  email: string;
  password: string;
  callbackUrl: string;
};

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

  async function onSubmit() {
    if (loading) return;
    setLoading(true);
    try {
      const checkRes = await fetch("/api/auth/check-credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const checkJson = (await checkRes.json()) as AuthActionResponse;

      // Belum terdaftar → buat akun dan arahkan ke halaman OTP/aktivasi
      if (checkRes.status === 401 && checkJson?.notRegistered) {
        const regRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        let regJson: AuthActionResponse | null = null;
        try {
          regJson = (await regRes.json()) as AuthActionResponse;
        } catch {
          regJson = null;
        }

        if (regRes.ok) {
          const emailSent = regJson?.emailSent !== false;
          push(
            emailSent
              ? {
                  title: "Akun dibuat",
                  description: "Kami mengirim kode verifikasi ke email Anda.",
                  variant: "success",
                }
              : {
                  title: "Akun dibuat",
                  description:
                    "Kode verifikasi belum terkirim. Silakan klik “Kirim Kode” di halaman aktivasi.",
                  variant: "success",
                }
          );
          try {
            const payload: PostVerifyLogin = {
              email,
              password,
              callbackUrl: props.callbackUrl,
            };
            sessionStorage.setItem("post_verify_login", JSON.stringify(payload));
          } catch {}
          router.push(
            emailSent
              ? `/verify?email=${encodeURIComponent(email)}&sent=1&callbackUrl=${encodeURIComponent(props.callbackUrl)}`
              : `/verify?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(props.callbackUrl)}`
          );
          return;
        }

        // Race: baru saja terdaftar → lanjutkan ke alur login.
        if (regRes.status !== 409) {
          push({
            title: "Gagal daftar",
            description: regJson?.error ?? "Terjadi kesalahan.",
            variant: "error",
          });
          setLoading(false);
          return;
        }
      }

      // Sudah daftar tapi belum aktivasi → ke halaman OTP/aktivasi
      if (checkRes.status === 403 && checkJson?.notVerified) {
        push({
          title: "Akun belum diaktivasi",
          description: "Selesaikan verifikasi email untuk mengaktifkan akun Anda.",
          variant: "error",
        });
        try {
          const payload: PostVerifyLogin = {
            email,
            password,
            callbackUrl: props.callbackUrl,
          };
          sessionStorage.setItem("post_verify_login", JSON.stringify(payload));
        } catch {}
        router.push(
          `/verify?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(props.callbackUrl)}`
        );
        return;
      }

      if (!checkRes.ok) {
        push({
          title: "Gagal masuk",
          description: checkJson?.error ?? "Email atau password salah.",
          variant: "error",
        });
        setLoading(false);
        return;
      }

      const res = await signIn("credentials", {
        redirect: false,
        callbackUrl: props.callbackUrl,
        email,
        password,
      });

      if (!res?.ok) {
        push({
          title: "Gagal masuk",
          description: "Terjadi kesalahan. Coba lagi.",
          variant: "error",
        });
        setLoading(false);
        return;
      }

      router.push(res.url ?? props.callbackUrl);
    } catch {
      push({ title: "Gagal masuk", variant: "error" });
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16">
      <div className="mx-auto max-w-md rounded-3xl border border-border-lavender bg-white p-8 shadow-elevated">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-expo-black">
          Autentikasi
        </h1>
        <p className="mt-2 text-sm text-slate-gray">
          Masukkan email dan password. Jika belum punya akun, kami akan mengirim OTP.
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
                if (e.key === "Enter" && email && password) onSubmit();
              }}
              className="mt-1 h-11 w-full rounded-xl border border-border-lavender px-4 text-sm outline-none focus:ring-2 focus:ring-expo-black/10"
              placeholder="••••••••••••"
            />
          </label>

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || !email || !password}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-expo-black px-7 text-base font-semibold text-white transition disabled:opacity-50 hover:opacity-80 active:scale-[0.98]"
          >
            {loading ? "Memproses..." : "Daftar/Masuk"}
          </button>
        </div>
      </div>
    </main>
  );
}
