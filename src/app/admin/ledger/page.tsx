import Link from "next/link";

import { desc, eq, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { adminTokenEvents, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AdminLedgerPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim();

  const where =
    q.length > 0
      ? sql`lower(${users.email}) like ${`%${q.toLowerCase()}%`} or ${adminTokenEvents.userId} = ${q}`
      : undefined;

  const db = getDb();
  const rows = await db
    .select({
      id:            adminTokenEvents.id,
      userId:        adminTokenEvents.userId,
      userEmail:     users.email,
      adminEmail:    adminTokenEvents.adminEmail,
      kind:          adminTokenEvents.kind,
      delta:         adminTokenEvents.delta,
      balanceBefore: adminTokenEvents.balanceBefore,
      balanceAfter:  adminTokenEvents.balanceAfter,
      note:          adminTokenEvents.note,
      createdAt:     adminTokenEvents.createdAt
    })
    .from(adminTokenEvents)
    .leftJoin(users, eq(users.id, adminTokenEvents.userId))
    .where(where)
    .orderBy(desc(adminTokenEvents.createdAt))
    .limit(300);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111112]">Token Log</h1>
          <p className="mt-0.5 text-xs text-[#6b7280]">{rows.length} event · audit trail (read-only)</p>
        </div>
        <form method="get" action="/admin/ledger" className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Cari email / userId…"
            className="w-52 rounded border border-[#e4e5ea] bg-white px-3 py-1.5 text-sm placeholder:text-[#9ca3af] focus:border-[#111112] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded border border-[#e4e5ea] bg-white px-3 py-1.5 text-sm font-medium text-[#1b1c1f] hover:bg-[#f5f5f7]"
          >
            Cari
          </button>
        </form>
      </div>

      <div className="border border-[#e4e5ea] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e4e5ea] bg-[#f5f5f7]">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Waktu</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">User</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Aksi</th>
                <th className="w-16 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Delta</th>
                <th className="w-28 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Before→After</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e5ea]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#f5f5f7]/60">
                  <td className="px-4 py-2.5 text-xs text-[#6b7280]">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/users/${r.userId}`}
                      className="text-sm font-medium text-[#1b1c1f] hover:underline"
                    >
                      {r.userEmail ?? r.userId}
                    </Link>
                    <div className="text-[11px] text-[#6b7280]">by {r.adminEmail}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-[#f5f5f7] px-1.5 py-0.5 text-[11px] font-medium text-[#1b1c1f]">
                      {r.kind}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-right text-sm font-semibold ${r.delta >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {r.delta >= 0 ? `+${r.delta}` : r.delta}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#1b1c1f]">
                    {r.balanceBefore} → {r.balanceAfter}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#6b7280]">{r.note ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#6b7280]">Belum ada event.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
