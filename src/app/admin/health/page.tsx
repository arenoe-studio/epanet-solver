import Link from "next/link";

import { requireAdmin } from "@/lib/admin-server";
import { checkConfigSanity, checkDatabase, checkUpstashRedis } from "@/lib/admin-health";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AdminHealthPage() {
  await requireAdmin();

  const db = getDb();
  const dbRes = await checkDatabase({
    probe: async () => {
      await db.select({ id: users.id }).from(users).limit(1);
    }
  });
  const redisRes = await checkUpstashRedis();
  const configRes = checkConfigSanity();

  const all = [dbRes, redisRes, ...configRes].sort((a, b) => a.name.localeCompare(b.name));
  const anyDown = all.some((r) => r.state === "down");
  const anyDegraded = all.some((r) => r.state === "degraded");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111112]">Health</h1>
          <p className="mt-0.5 text-xs text-[#6b7280]">
            Koneksi & konfigurasi · read-only ·{" "}
            <span className={anyDown ? "text-red-700 font-semibold" : anyDegraded ? "text-amber-700 font-semibold" : "text-green-700 font-semibold"}>
              {anyDown ? "ada masalah" : anyDegraded ? "degraded" : "semua ok"}
            </span>
          </p>
        </div>
        <Link
          href={`/admin/health?t=${Date.now()}`}
          className="rounded border border-[#e4e5ea] bg-white px-3 py-1.5 text-sm font-medium text-[#1b1c1f] hover:bg-[#f5f5f7]"
        >
          Refresh
        </Link>
      </div>

      <div className="border border-[#e4e5ea] bg-white">
        <div className="divide-y divide-[#e4e5ea]">
          {all.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[#111112]">{r.name}</div>
                <div className="mt-0.5 text-xs text-[#6b7280]">{r.message}</div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-[#6b7280]">{fmt(r.checkedAt)}</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  r.state === "ok"       ? "text-green-700"
                    : r.state === "degraded" ? "text-amber-700"
                      : "text-red-700"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    r.state === "ok" ? "bg-green-500" : r.state === "degraded" ? "bg-amber-400" : "bg-red-500"
                  }`} />
                  {r.state}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
