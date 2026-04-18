import { Resend } from "resend";

let cached: Resend | null = null;

function getResend() {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  cached = new Resend(apiKey);
  return cached;
}

export function getResendClient() {
  return getResend();
}

export async function sendPaymentConfirmationEmail(opts: {
  to: string;
  tokens: number;
  amount: number;
  orderId: string;
}) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: "EPANET Solver <onboarding@resend.dev>",
    to: opts.to,
    subject: "Pembelian token berhasil",
    text: `Pembelian token berhasil.\n\nOrder: ${opts.orderId}\nToken: ${opts.tokens}\nAmount: Rp ${opts.amount}\n`
  });
}

export async function sendAuthCodeEmail(opts: {
  to: string;
  code: string;
  purpose: "verify_email" | "login" | "reset_password";
}) {
  const resend = getResend();
  if (!resend) return;

  const from =
    process.env.AUTH_EMAIL_FROM ?? "EPANET Solver <onboarding@resend.dev>";

  const subject =
    opts.purpose === "verify_email"
      ? "Kode verifikasi email"
      : opts.purpose === "reset_password"
        ? "Kode reset password"
        : "Kode login";

  await resend.emails.send({
    from,
    to: opts.to,
    subject,
    text: `Kode Anda: ${opts.code}\n\nKode berlaku beberapa menit. Jika Anda tidak merasa meminta kode ini, abaikan email ini.\n`
  });
}

