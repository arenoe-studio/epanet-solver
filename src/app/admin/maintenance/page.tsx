import { and, isNotNull, lte, or, sql } from "drizzle-orm";

import { adminCleanupExpiredAnalysisSnapshots, adminCleanupOldOtpCodes } from "@/app/admin/maintenance/actions";
import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { analysisSnapshots, authOtpCodes } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

const inputCls =
  "w-full rounded border border-[#e4e5ea] bg-white px-3 py-2 text-sm text-[#1b1c1f] placeholder:text-[#9ca3af] focus:border-[#111112] focus:outline-none";
const labelCls =
  "block mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]";

export default async function AdminMaintenancePage() {
  await requireAdmin();
  const db = getDb();

  const now = new Date();
  const otpDays = 14;
  const otpCutoff = new Date(Date.now() - otpDays * 24 * 60 * 60_000);

  const [expiredSnapshots, oldOtps] = await Promise.all([
    db.select({ count: sql<number>`count(*)`.as("count") })
      .from(analysisSnapshots)
      .where(lte(analysisSnapshots.expiresAt, now))
      .limit(1),

    db.select({ count: sql<number>`count(*)`.as("count") })
      .from(authOtpCodes)
      .where(or(
        lte(authOtpCodes.expiresAt, otpCutoff),
        and(isNotNull(authOtpCodes.consumedAt), lte(authOtpCodes.createdAt, otpCutoff))
      ))
      .limit(1)
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111112]">Maintenance</h1>
        <p className="mt-0.5 text-xs text-[#6b7280]">
          Housekeeping aman. Ketik <strong className="text-[#1b1c1f]">DELETE</strong> untuk konfirmasi sebelum eksekusi.
        </p>
      </div>

      {/* Snapshots */}
      <div className="border border-[#e4e5ea] bg-white">
        <div className="border-b border-[#e4e5ea] px-4 py-3">
          <div className="text-sm font-semibold text-[#111112]">Cleanup Analysis Snapshots</div>
          <div className="mt-0.5 text-xs text-[#6b7280]">
            Menghapus snapshot yang sudah expired berdasarkan <code className="font-mono">expiresAt</code>.
          </div>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#6b7280]">Expired snapshots</span>
            <span className="font-semibold text-[#111112]">{expiredSnapshots[0]?.count ?? 0}</span>
          </div>
          <form action={adminCleanupExpiredAnalysisSnapshots} className="flex gap-2">
            <input name="confirm" placeholder="Ketik DELETE…" className={`${inputCls} max-w-xs`} />
            <button
              type="submit"
              className="shrink-0 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Cleanup
            </button>
          </form>
        </div>
      </div>

      {/* OTP */}
      <div className="border border-[#e4e5ea] bg-white">
        <div className="border-b border-[#e4e5ea] px-4 py-3">
          <div className="text-sm font-semibold text-[#111112]">Cleanup OTP Codes</div>
          <div className="mt-0.5 text-xs text-[#6b7280]">
            Menghapus OTP expired dan OTP consumed berumur lebih dari N hari.
          </div>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#6b7280]">OTP eligible (default {otpDays} hari)</span>
            <span className="font-semibold text-[#111112]">{oldOtps[0]?.count ?? 0}</span>
          </div>
          <div className="text-xs text-[#6b7280]">
            Cutoff: {fmt(otpCutoff)}
          </div>
          <form action={adminCleanupOldOtpCodes} className="flex flex-wrap gap-2">
            <div className="w-24">
              <label className={labelCls}>Days</label>
              <input
                name="days"
                type="number"
                min={1}
                max={90}
                defaultValue={otpDays}
                className={inputCls}
              />
            </div>
            <div className="flex-1">
              <label className={labelCls}>Confirm</label>
              <input name="confirm" placeholder="Ketik DELETE…" className={inputCls} />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Cleanup
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
