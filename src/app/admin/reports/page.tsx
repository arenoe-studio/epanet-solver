import Link from "next/link";

import { desc, sql } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { contactMessages } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function normalizeParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = normalizeParam(sp.status) ?? "open";
  const q = (normalizeParam(sp.q) ?? "").trim();

  const where = sql`
    (${status === "all" ? sql`true` : sql`${contactMessages.status} = ${status}`})
    and (
      ${q.length === 0
        ? sql`true`
        : sql`lower(${contactMessages.email}) like ${`%${q.toLowerCase()}%`} or lower(${contactMessages.topic}) like ${`%${q.toLowerCase()}%`}`}
    )
  `;

  const db = getDb();
  const rows = await db
    .select({
      id: contactMessages.id,
      name: contactMessages.name,
      email: contactMessages.email,
      topic: contactMessages.topic,
      status: contactMessages.status,
      createdAt: contactMessages.createdAt,
      message: contactMessages.message
    })
    .from(contactMessages)
    .where(where)
    .orderBy(desc(contactMessages.createdAt))
    .limit(250);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Laporan</CardTitle>
            <div className="mt-1 text-sm text-slate-gray">
              {rows.length} item
            </div>
          </div>
          <form className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <select
              name="status"
              defaultValue={status}
              className="w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10 sm:w-44"
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="spam">Spam</option>
              <option value="all">All</option>
            </select>
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari email / topik…"
              className="w-full rounded-xl border border-input-border bg-white px-3.5 py-2.5 text-sm text-expo-black placeholder:text-slate-gray/60 outline-none transition focus:border-near-black focus:ring-2 focus:ring-near-black/10 sm:w-72"
            />
          </form>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Pengirim</TableHead>
                <TableHead>Topik</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const excerpt =
                  (r.message ?? "").trim().slice(0, 110) +
                  (((r.message ?? "").trim().length ?? 0) > 110 ? "…" : "");
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-near-black">
                      <div className="font-semibold">{r.name}</div>
                      <div className="mt-0.5 text-xs text-slate-gray">{r.email}</div>
                    </TableCell>
                    <TableCell className="text-near-black">
                      <Link
                        href={`/admin/reports/${r.id}`}
                        className="block font-semibold text-expo-black hover:underline"
                      >
                        {r.topic}
                      </Link>
                      <div className="mt-0.5 text-xs text-slate-gray">{excerpt || "—"}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline">{r.status ?? "open"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{fmt(r.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-gray">
                    Tidak ada laporan.
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

