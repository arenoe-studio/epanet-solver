import { Resend } from "resend";

let cached: Resend | null = null;

function getResend() {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  cached = new Resend(apiKey);
  return cached;
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
    // Use a verified sender in your Resend account for production.
    from: "EPANET Solver <onboarding@resend.dev>",
    to: opts.to,
    subject: "Pembelian token berhasil",
    text: `Pembelian token berhasil.\n\nOrder: ${opts.orderId}\nToken: ${opts.tokens}\nAmount: Rp ${opts.amount}\n`
  });
}
