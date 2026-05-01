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
    text: `Pembelian token berhasil.\n\nOrder: ${opts.orderId}\nToken: ${opts.tokens}\nAmount: Rp ${opts.amount}\n`,
    html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pembelian token berhasil</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
    <div style="padding:24px 12px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="color:#1e3a5f;font-size:20px;font-weight:600;margin-bottom:24px;border-bottom:1px solid #e5e7eb;padding-bottom:16px;">
          EPANET Solver
        </div>
        <div style="color:#374151;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px 0;">Pembelian token berhasil.</p>
          <p style="margin:0 0 6px 0;"><strong>Order:</strong> ${opts.orderId}</p>
          <p style="margin:0 0 6px 0;"><strong>Token:</strong> ${opts.tokens}</p>
          <p style="margin:0;"><strong>Amount:</strong> Rp ${opts.amount}</p>
        </div>
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:24px;font-size:13px;color:#6b7280;">
          Salam,<br />Tim EPANET Solver
        </div>
      </div>
    </div>
  </body>
</html>`
  });
}

export async function sendAdminPendingPaymentEmail(opts: {
  to: string;
  userEmail: string;
  userName: string;
  orderId: string;
  amount: number;
  tokens: number;
  packageKey: string;
  packageName: string;
}) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: "EPANET Solver <onboarding@resend.dev>",
    to: opts.to,
    subject: `Pembayaran baru (pending) — ${opts.orderId}`,
    text: [
      "Ada transaksi baru yang menunggu verifikasi.",
      "",
      `Order: ${opts.orderId}`,
      `User: ${opts.userName} <${opts.userEmail}>`,
      `Package: ${opts.packageName} (${opts.packageKey})`,
      `Token: ${opts.tokens}`,
      `Amount: Rp ${opts.amount}`,
      "",
      "Konfirmasi pembayaran dari panel admin: /admin"
    ].join("\n"),
    html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pembayaran baru (pending)</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
    <div style="padding:24px 12px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="color:#1e3a5f;font-size:20px;font-weight:600;margin-bottom:24px;border-bottom:1px solid #e5e7eb;padding-bottom:16px;">
          EPANET Solver
        </div>
        <div style="color:#374151;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px 0;">Ada transaksi baru yang menunggu verifikasi.</p>
          <p style="margin:0 0 6px 0;"><strong>Order:</strong> ${opts.orderId}</p>
          <p style="margin:0 0 6px 0;"><strong>User:</strong> ${opts.userName} &lt;${opts.userEmail}&gt;</p>
          <p style="margin:0 0 6px 0;"><strong>Package:</strong> ${opts.packageName} (${opts.packageKey})</p>
          <p style="margin:0 0 6px 0;"><strong>Token:</strong> ${opts.tokens}</p>
          <p style="margin:0 0 12px 0;"><strong>Amount:</strong> Rp ${opts.amount}</p>
          <p style="margin:0;">Konfirmasi pembayaran dari panel admin: <code style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">/admin</code></p>
        </div>
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:24px;font-size:13px;color:#6b7280;">
          Salam,<br />Tim EPANET Solver
        </div>
      </div>
    </div>
  </body>
</html>`
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

  const introText =
    opts.purpose === "verify_email"
      ? "Gunakan kode berikut untuk memverifikasi email Anda."
      : opts.purpose === "reset_password"
        ? "Gunakan kode berikut untuk reset password Anda."
        : "Gunakan kode berikut untuk login.";

  await resend.emails.send({
    from,
    to: opts.to,
    subject,
    text: `Kode Anda: ${opts.code}\n\nKode berlaku beberapa menit. Jika Anda tidak merasa meminta kode ini, abaikan email ini.\n`,
    html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
    <div style="padding:24px 12px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="color:#1e3a5f;font-size:20px;font-weight:600;margin-bottom:24px;border-bottom:1px solid #e5e7eb;padding-bottom:16px;">
          EPANET Solver
        </div>
        <div style="color:#374151;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 8px 0;">${introText}</p>
          <div style="font-size:32px;font-weight:700;color:#1e3a5f;letter-spacing:8px;text-align:center;margin:24px 0;">
            ${opts.code}
          </div>
          <p style="margin:0;">Kode berlaku beberapa menit. Jika Anda tidak merasa meminta kode ini, abaikan email ini.</p>
        </div>
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:24px;font-size:13px;color:#6b7280;">
          Salam,<br />Tim EPANET Solver
        </div>
      </div>
    </div>
  </body>
</html>`
  });
}

export async function sendVerifyEmailLinkEmail(opts: {
  to: string;
  name?: string | null;
  verifyUrl: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const from =
    process.env.AUTH_EMAIL_FROM ?? "EPANET Solver <onboarding@resend.dev>";
  const subject = "Verifikasi Email Akun Anda - EPANET Solver";
  const greetingName = opts.name?.trim() ? opts.name.trim() : "Pengguna baru";

  await resend.emails.send({
    from,
    to: opts.to,
    subject,
    text: [
      `Halo ${greetingName},`,
      "",
      "Terima kasih telah mendaftar di EPANET Solver.",
      "Klik link di bawah untuk memverifikasi alamat email Anda (berlaku 24 jam):",
      "",
      opts.verifyUrl,
      "",
      "Jika Anda tidak merasa mendaftar, abaikan email ini.",
      "",
      "Salam,",
      "Tim EPANET Solver"
    ].join("\n"),
    html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
    <div style="padding:24px 12px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="color:#1e3a5f;font-size:20px;font-weight:600;margin-bottom:24px;border-bottom:1px solid #e5e7eb;padding-bottom:16px;">
          EPANET Solver
        </div>
        <div style="color:#374151;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px 0;">Halo ${greetingName},</p>
          <p style="margin:0 0 12px 0;">Terima kasih telah mendaftar di EPANET Solver.</p>
          <p style="margin:0 0 16px 0;">Klik tombol di bawah untuk memverifikasi alamat email Anda (berlaku 24 jam):</p>
          <a href="${opts.verifyUrl}" style="display:inline-block;background:#1e3a5f;color:#ffffff;padding:12px 24px;border-radius:6px;font-weight:600;text-decoration:none;margin:24px 0;">
            Verifikasi Email Saya
          </a>
          <div style="font-size:13px;color:#6b7280;margin-top:8px;">
            Jika tombol tidak berfungsi, salin link ini:
            <div style="margin-top:8px;">
              <code style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${opts.verifyUrl}</code>
            </div>
          </div>
          <p style="margin:16px 0 0 0;">Jika Anda tidak merasa mendaftar, abaikan email ini.</p>
        </div>
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:24px;font-size:13px;color:#6b7280;">
          Salam,<br />Tim EPANET Solver
        </div>
      </div>
    </div>
  </body>
</html>`
  });
}

export async function sendResetPasswordLinkEmail(opts: {
  to: string;
  resetUrl: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const from =
    process.env.AUTH_EMAIL_FROM ?? "EPANET Solver <onboarding@resend.dev>";
  const subject = "Reset Password - EPANET Solver";

  await resend.emails.send({
    from,
    to: opts.to,
    subject,
    text: [
      "Halo,",
      "",
      "Kami menerima permintaan reset password untuk akun ini.",
      "Klik link di bawah (berlaku 1 jam):",
      "",
      opts.resetUrl,
      "",
      "Jika Anda tidak meminta ini, abaikan email ini. Password tidak akan berubah.",
      "",
      "Salam,",
      "Tim EPANET Solver"
    ].join("\n"),
    html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
    <div style="padding:24px 12px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="color:#1e3a5f;font-size:20px;font-weight:600;margin-bottom:24px;border-bottom:1px solid #e5e7eb;padding-bottom:16px;">
          EPANET Solver
        </div>
        <div style="color:#374151;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px 0;">Halo,</p>
          <p style="margin:0 0 16px 0;">Kami menerima permintaan reset password untuk akun ini. Klik tombol di bawah (berlaku 1 jam):</p>
          <a href="${opts.resetUrl}" style="display:inline-block;background:#1e3a5f;color:#ffffff;padding:12px 24px;border-radius:6px;font-weight:600;text-decoration:none;margin:24px 0;">
            Reset Password Saya
          </a>
          <div style="font-size:13px;color:#6b7280;margin-top:8px;">
            Jika tombol tidak berfungsi, salin link ini:
            <div style="margin-top:8px;">
              <code style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${opts.resetUrl}</code>
            </div>
          </div>
          <p style="margin:16px 0 0 0;">Jika Anda tidak meminta ini, abaikan email ini. Password tidak akan berubah.</p>
        </div>
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:24px;font-size:13px;color:#6b7280;">
          Salam,<br />Tim EPANET Solver
        </div>
      </div>
    </div>
  </body>
</html>`
  });
}
