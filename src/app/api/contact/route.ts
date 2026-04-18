import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { contactMessages } from "@/lib/db/schema";
import { getResendClient } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const db = getDb();
    await db.insert(contactMessages).values({
      userId,
      name,
      email,
      topic,
      message,
      status: "open"
    });
  } catch {
    console.error("[contact] failed to save message");
    return NextResponse.json(
      { error: "Gagal menyimpan pesan. Coba lagi." },
      { status: 500 }
    );
  }

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
