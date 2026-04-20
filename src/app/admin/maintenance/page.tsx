import { and, isNotNull, lte, or, sql } from "drizzle-orm";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function AdminMaintenancePage() {
  await requireAdmin();
  const db = getDb();

  const now = new Date();
  const expiredSnapshots = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(analysisSnapshots)
    .where(lte(analysisSnapshots.expiresAt, now))
    .limit(1);

  const otpDays = 14;
  const otpCutoff = new Date(Date.now() - otpDays * 24 * 60 * 60_000);
  const oldOtps = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(authOtpCodes)
    .where(
      or(
        lte(authOtpCodes.expiresAt, otpCutoff),
        and(isNotNull(authOtpCodes.consumedAt), lte(authOtpCodes.createdAt, otpCutoff))
      )
    )
    .limit(1);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-gray">
          Admin
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
          Maintenance
        </h1>
        <div className="mt-1 text-xs text-slate-gray">
          Housekeeping aman (tanpa akses SQL bebas / drop database). Konfirmasi dengan mengetik{" "}
          <span className="font-semibold text-near-black">DELETE</span>.
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cleanup Analysis Snapshots</CardTitle>
          <div className="mt-1 text-sm text-slate-gray">
            Menghapus snapshot yang sudah expired berdasarkan <code className="text-xs">expiresAt</code>.
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl border border-border-lavender bg-white px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-expo-black">Expired snapshots</div>
              <div className="font-bold text-near-black">{expiredSnapshots[0]?.count ?? 0}</div>
            </div>
            <div className="mt-1 text-xs text-slate-gray">
              Cek terakhir: <span className="text-near-black">{fmt(new Date())}</span>
            </div>
          </div>

          <form action={adminCleanupExpiredAnalysisSnapshots} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              name="confirm"
              placeholder="Ketik DELETE…"
              className="w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10 sm:w-56"
            />
            <button
              type="submit"
              className="rounded-xl bg-expo-black px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              Cleanup snapshots
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cleanup OTP Codes</CardTitle>
          <div className="mt-1 text-sm text-slate-gray">
            Menghapus OTP expired dan OTP yang sudah consumed dan berumur lebih dari N hari.
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl border border-border-lavender bg-white px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-expo-black">OTP eligible (default {otpDays} hari)</div>
              <div className="font-bold text-near-black">{oldOtps[0]?.count ?? 0}</div>
            </div>
            <div className="mt-1 text-xs text-slate-gray">
              Cutoff: <span className="text-near-black">{fmt(otpCutoff)}</span>
            </div>
          </div>

          <form action={adminCleanupOldOtpCodes} className="grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-end">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                Days
              </div>
              <input
                name="days"
                type="number"
                min={1}
                max={90}
                defaultValue={otpDays}
                className="mt-1 w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
              />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
                Confirm
              </div>
              <input
                name="confirm"
                placeholder="Ketik DELETE…"
                className="mt-1 w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-expo-black px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              Cleanup OTP
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

