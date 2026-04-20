import Link from "next/link";
import { notFound } from "next/navigation";

import { eq } from "drizzle-orm";

import { adminUpdateReport } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { contactMessages } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

const inputCls =
  "w-full rounded border border-[#e4e5ea] bg-white px-3 py-2 text-sm text-[#1b1c1f] focus:border-[#111112] focus:outline-none";
const labelCls =
  "block mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]";

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
      id:         contactMessages.id,
      userId:     contactMessages.userId,
      name:       contactMessages.name,
      email:      contactMessages.email,
      topic:      contactMessages.topic,
      message:    contactMessages.message,
      status:     contactMessages.status,
      adminNotes: contactMessages.adminNotes,
      createdAt:  contactMessages.createdAt
    })
    .from(contactMessages)
    .where(eq(contactMessages.id, reportId))
    .limit(1);

  const report = rows[0];
  if (!report) notFound();

  return (
    <div className="space-y-4">
      {/* Back + meta */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/reports" className="text-xs text-[#6b7280] hover:text-[#111112]">
            ← Kembali ke Laporan
          </Link>
          <h1 className="mt-1 text-xl font-bold text-[#111112]">{report.topic}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-[#6b7280]">
            <span>{report.name}</span>
            <span>·</span>
            <a href={`mailto:${report.email}`} className="hover:underline">{report.email}</a>
            <span>·</span>
            <span>{fmt(report.createdAt)}</span>
            <span className={`rounded px-1.5 py-0.5 font-medium ${
              report.status === "resolved" ? "bg-green-50 text-green-700"
                : report.status === "spam" ? "bg-[#f5f5f7] text-[#6b7280]"
                  : "bg-amber-50 text-amber-700"
            }`}>{report.status ?? "open"}</span>
          </div>
        </div>
        <div className="text-[11px] text-[#6b7280]">ID: {report.id}</div>
      </div>

      {/* Two-column */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Message body */}
        <div className="border border-[#e4e5ea] bg-white lg:col-span-2">
          <div className="border-b border-[#e4e5ea] px-4 py-3 text-sm font-semibold text-[#111112]">Pesan</div>
          <div className="px-4 py-4">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#1b1c1f]">
              {report.message}
            </div>
            {report.userId ? (
              <div className="mt-4 text-xs text-[#6b7280]">
                Terkait user:{" "}
                <Link
                  href={`/admin/users/${report.userId}`}
                  className="font-medium text-[#1b1c1f] hover:underline"
                >
                  {report.userId}
                </Link>
              </div>
            ) : (
              <div className="mt-4 text-xs text-[#6b7280]">Tidak terhubung ke akun (guest).</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="border border-[#e4e5ea] bg-white">
          <div className="border-b border-[#e4e5ea] px-4 py-3 text-sm font-semibold text-[#111112]">Tindak Lanjut</div>
          <div className="px-4 py-4 space-y-3">
            <form action={adminUpdateReport} className="space-y-3">
              <input type="hidden" name="id" value={report.id} />
              <div>
                <label className={labelCls}>Status</label>
                <select name="status" defaultValue={report.status ?? "open"} className={inputCls}>
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="spam">Spam</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Catatan internal</label>
                <textarea
                  name="adminNotes"
                  rows={6}
                  defaultValue={report.adminNotes ?? ""}
                  placeholder="Langkah follow-up, hasil investigasi…"
                  className={`${inputCls} resize-y`}
                />
              </div>
              <button
                type="submit"
                className="w-full rounded bg-[#111112] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Simpan
              </button>
            </form>

            <a
              href={`mailto:${report.email}?subject=${encodeURIComponent(`[EPANET Solver] Re: ${report.topic}`)}`}
              className="flex w-full items-center justify-center rounded border border-[#e4e5ea] px-3 py-2 text-sm font-medium text-[#1b1c1f] hover:bg-[#f5f5f7]"
            >
              Balas via Email
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
