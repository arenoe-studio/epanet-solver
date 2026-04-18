import Link from "next/link";

import { desc, eq, sql } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const qRaw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = qRaw?.trim() ? qRaw.trim() : "";

  const where =
    q.length > 0
      ? sql`lower(${users.email}) like ${`%${q.toLowerCase()}%`} or ${adminTokenEvents.userId} = ${q}`
      : undefined;

  const db = getDb();
  const rows = await db
    .select({
      id: adminTokenEvents.id,
      userId: adminTokenEvents.userId,
      userEmail: users.email,
      adminEmail: adminTokenEvents.adminEmail,
      kind: adminTokenEvents.kind,
      delta: adminTokenEvents.delta,
      balanceBefore: adminTokenEvents.balanceBefore,
      balanceAfter: adminTokenEvents.balanceAfter,
      note: adminTokenEvents.note,
      createdAt: adminTokenEvents.createdAt
    })
    .from(adminTokenEvents)
    .leftJoin(users, eq(users.id, adminTokenEvents.userId))
    .where(where)
    .orderBy(desc(adminTokenEvents.createdAt))
    .limit(250);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Token Log</CardTitle>
            <div className="mt-1 text-sm text-slate-gray">{rows.length} event</div>
          </div>
          <form className="w-full max-w-sm">
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari email / userId…"
              className="w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10"
            />
          </form>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Delta</TableHead>
                <TableHead>Before → After</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{fmt(r.createdAt)}</TableCell>
                  <TableCell className="text-near-black">
                    <Link
                      href={`/admin/users/${r.userId}`}
                      className="block font-semibold text-expo-black hover:underline"
                    >
                      {r.userEmail ?? r.userId}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-slate-gray">{r.userId}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline">{r.kind}</Badge>
                    <div className="mt-1 text-[11px] text-slate-gray">by {r.adminEmail}</div>
                  </TableCell>
                  <TableCell className={`text-xs font-semibold ${r.delta >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {r.delta >= 0 ? `+${r.delta}` : r.delta}
                  </TableCell>
                  <TableCell className="text-xs text-near-black">
                    {r.balanceBefore} → {r.balanceAfter}
                  </TableCell>
                  <TableCell className="text-xs">{r.note ?? "—"}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-gray">
                    Belum ada event.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

