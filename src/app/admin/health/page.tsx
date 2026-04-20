import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

function stateBadge(state: "ok" | "degraded" | "down") {
  if (state === "ok") return <Badge variant="outline">ok</Badge>;
  if (state === "degraded") return <Badge className="bg-amber-500 text-white">degraded</Badge>;
  return <Badge className="bg-red-600 text-white">down</Badge>;
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

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-gray">
            Admin
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
            Health
          </h1>
          <div className="mt-1 text-xs text-slate-gray">
            Cek koneksi & konfigurasi penting (read-only).
          </div>
        </div>
        <Link
          href={`/admin/health?t=${Date.now()}`}
          className="rounded-xl border border-border-lavender bg-white px-3 py-2 text-sm font-semibold text-near-black transition hover:bg-cloud-gray active:scale-[0.98]"
        >
          Refresh
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-expo-black">Status</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {all.map((r) => (
            <div
              key={r.name}
              className="flex flex-col justify-between gap-1 rounded-2xl border border-border-lavender bg-white px-4 py-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-expo-black">
                  {r.name}
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-gray">
                  {r.message}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <div className="text-xs text-slate-gray">{fmt(r.checkedAt)}</div>
                {stateBadge(r.state)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

