import { NextResponse } from "next/server";
import { z } from "zod";
import { getResendClient } from "@/lib/resend";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  topic: z.string().min(1).max(100),
  message: z.string().min(10).max(3000)
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 422 });
  }

  const { name, email, topic, message } = parsed.data;
  const to =
    process.env.NEXT_PUBLIC_BUSINESS_EMAIL ??
    process.env.AUTH_EMAIL_FROM_ADDRESS ??
    "support@epanet-solver.com";

  try {
    const resend = getResendClient();
    if (resend) {
      await resend.emails.send({
        from:
          process.env.AUTH_EMAIL_FROM ??
          "EPANET Solver <onboarding@resend.dev>",
        to,
        replyTo: email,
        subject: `[Kontak] ${topic} — dari ${name}`,
        text: [
          `Nama: ${name}`,
          `Email: ${email}`,
          `Topik: ${topic}`,
          "",
          `Pesan:`,
          message
        ].join("\n")
      });
    }
  } catch {
    // Non-fatal — log silently; we still return success to the user
    console.error("[contact] failed to send email");
  }

  return NextResponse.json({ success: true });
}
