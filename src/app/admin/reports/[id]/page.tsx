import Link from "next/link";
import { notFound } from "next/navigation";

import { eq } from "drizzle-orm";

import { adminUpdateReport } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { contactMessages } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AdminReportDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isFinite(reportId)) notFound();

  const db = getDb();
  const rows = await db
    .select({
      id: contactMessages.id,
      userId: contactMessages.userId,
      name: contactMessages.name,
      email: contactMessages.email,
      topic: contactMessages.topic,
      message: contactMessages.message,
      status: contactMessages.status,
      adminNotes: contactMessages.adminNotes,
      createdAt: contactMessages.createdAt
    })
    .from(contactMessages)
    .where(eq(contactMessages.id, reportId))
    .limit(1);

  const report = rows[0];
  if (!report) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/reports"
            className="text-sm font-semibold text-slate-gray hover:text-expo-black"
          >
            ← Kembali
          </Link>
          <Badge variant="outline">laporan</Badge>
          <Badge variant="outline">{report.status ?? "open"}</Badge>
        </div>
        <div className="text-xs text-slate-gray">
          ID: <span className="font-mono text-[11px] text-near-black">{report.id}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{report.topic}</CardTitle>
            <div className="mt-1 text-sm text-slate-gray">
              {report.name} ·{" "}
              <a className="font-semibold text-expo-black hover:underline" href={`mailto:${report.email}`}>
                {report.email}
              </a>{" "}
              · {fmt(report.createdAt)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap rounded-2xl border border-border-lavender bg-white p-5 text-sm leading-relaxed text-near-black">
              {report.message}
            </div>
            {report.userId ? (
              <div className="mt-4 text-xs text-slate-gray">
                Terkait user:{" "}
                <Link
                  href={`/admin/users/${report.userId}`}
                  className="font-semibold text-expo-black hover:underline"
                >
                  {report.userId}
                </Link>
              </div>
            ) : (
              <div className="mt-4 text-xs text-slate-gray">Tidak terhubung ke akun (guest).</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tindak Lanjut</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={adminUpdateReport} className="space-y-3">
              <input type="hidden" name="id" value={report.id} />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue={report.status ?? "open"}
                  className="mt-1.5 w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                >
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="spam">Spam</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                  Catatan internal
                </label>
                <textarea
                  name="adminNotes"
                  rows={6}
                  defaultValue={report.adminNotes ?? ""}
                  placeholder="Tulis langkah follow-up, hasil investigasi, dll…"
                  className="mt-1.5 w-full resize-y rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
                />
              </div>
              <Button type="submit" className="w-full">
                Simpan
              </Button>
            </form>

            <a
              href={`mailto:${report.email}?subject=${encodeURIComponent(`[EPANET Solver] Re: ${report.topic}`)}`}
              className="inline-flex h-9 w-full items-center justify-center rounded-full border border-border-lavender bg-white px-5 text-sm font-semibold text-near-black shadow-sm transition hover:bg-cloud-gray active:scale-[0.98]"
            >
              Balas via Email
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

