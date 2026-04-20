import Link from "next/link";

import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { adminAdjustTokens } from "@/app/admin/actions";
import { FilterBar } from "@/app/admin/users/_components/FilterBar";
import { KeyboardNav } from "@/app/admin/users/_components/KeyboardNav";
import { type PanelUser, UserDetailPanel } from "@/app/admin/users/_components/UserDetailPanel";
import { requireAdmin } from "@/lib/admin-server";
import { getDb } from "@/lib/db";
import { analyses, contactMessages, tokenBalances, transactions, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function relativeTime(dt: Date | null | undefined): string {
  if (!dt) return "—";
  const diff = Date.now() - new Date(dt).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "< 1 jam lalu";
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari lalu`;
  return fmt(dt);
}

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const q             = (Array.isArray(sp.q)      ? sp.q[0]      : sp.q)?.trim()      ?? "";
  const filter        = (Array.isArray(sp.filter) ? sp.filter[0] : sp.filter)?.trim() ?? "";
  const sort          = (Array.isArray(sp.sort)   ? sp.sort[0]   : sp.sort)?.trim()   ?? "created";
  const dir           = (Array.isArray(sp.dir)    ? sp.dir[0]    : sp.dir)?.trim()    ?? "desc";
  const selectedUserId = (Array.isArray(sp.user)  ? sp.user[0]   : sp.user)?.trim()   ?? "";

  const db = getDb();

  /* ── pre-query for filters that need a subquery ─────────────── */
  let filterIds: string[] | null = null;

  if (filter === "pending_payment") {
    const rows = await db
      .selectDistinct({ userId: transactions.userId })
      .from(transactions)
      .where(eq(transactions.status, "pending"));
    filterIds = rows.map((r) => r.userId).filter((id): id is string => id != null);
  }

  if (filter === "open_report") {
    const rows = await db
      .selectDistinct({ userId: contactMessages.userId })
      .from(contactMessages)
      .where(eq(contactMessages.status, "open"));
    filterIds = rows.map((r) => r.userId).filter((id): id is string => id != null);
  }

  if (filter === "active_7d") {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const rows = await db
      .selectDistinct({ userId: analyses.userId })
      .from(analyses)
      .where(gte(analyses.createdAt, since7d));
    filterIds = rows.map((r) => r.userId).filter((id): id is string => id != null);
  }

  /* ── last-analysis subquery ──────────────────────────────────── */
  const lastAnalysisSq = db
    .select({
      userId: analyses.userId,
      lastAt: sql<Date | null>`max(${analyses.createdAt})`.as("lastAt")
    })
    .from(analyses)
    .groupBy(analyses.userId)
    .as("la");

  /* ── where conditions ────────────────────────────────────────── */
  const conditions: ReturnType<typeof eq>[] = [];

  if (q) {
    conditions.push(
      sql`lower(${users.email}) like ${`%${q.toLowerCase()}%`} or lower(coalesce(${users.name}, '')) like ${`%${q.toLowerCase()}%`}` as ReturnType<typeof eq>
    );
  }

  if (filter === "low_token") {
    conditions.push(
      sql`coalesce(${tokenBalances.balance}, 0) <= 2` as ReturnType<typeof eq>
    );
  }

  if (filter === "unverified") {
    conditions.push(
      sql`${users.emailVerified} is null` as ReturnType<typeof eq>
    );
  }

  /* filterIds: pre-queried user id sets */
  if (filterIds !== null && filterIds.length > 0) {
    conditions.push(inArray(users.id, filterIds) as ReturnType<typeof eq>);
  }

  /* ── order by ────────────────────────────────────────────────── */
  const dirFn = dir === "asc" ? asc : desc;
  const orderBy =
    sort === "last_analysis"
      ? dirFn(lastAnalysisSq.lastAt)
      : sort === "balance"
        ? dirFn(tokenBalances.balance)
        : dirFn(users.createdAt);

  /* ── early return: filter exists but no matching ids ─────────── */
  const noResults = filterIds !== null && filterIds.length === 0;

  /* ── main query ──────────────────────────────────────────────── */
  const rows = noResults ? [] : await db
    .select({
      id:             users.id,
      email:          users.email,
      name:           users.name,
      emailVerified:  users.emailVerified,
      createdAt:      users.createdAt,
      mfaEnabled:     users.mfaEnabled,
      balance:        tokenBalances.balance,
      totalBought:    tokenBalances.totalBought,
      totalUsed:      tokenBalances.totalUsed,
      lastAnalysisAt: lastAnalysisSq.lastAt
    })
    .from(users)
    .leftJoin(tokenBalances, eq(tokenBalances.userId, users.id))
    .leftJoin(lastAnalysisSq, eq(lastAnalysisSq.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy)
    .limit(300);

  /* ── panel data (when user is selected) ─────────────────────── */
  let panelUser: PanelUser | null = null;
  if (selectedUserId) {
    const panelRows = await db
      .select({
        id:              users.id,
        email:           users.email,
        name:            users.name,
        emailVerified:   users.emailVerified,
        mfaEnabled:      users.mfaEnabled,
        loginLockedUntil: users.loginLockedUntil,
        balance:         tokenBalances.balance,
        totalBought:     tokenBalances.totalBought,
        totalUsed:       tokenBalances.totalUsed
      })
      .from(users)
      .leftJoin(tokenBalances, eq(tokenBalances.userId, users.id))
      .where(eq(users.id, selectedUserId))
      .limit(1);

    const pu = panelRows[0];
    if (pu) {
      const [recentAnalyses, recentTransactions] = await Promise.all([
        db.select({
          id:         analyses.id,
          kind:       analyses.kind,
          status:     analyses.status,
          tokensUsed: analyses.tokensUsed,
          createdAt:  analyses.createdAt
        })
          .from(analyses)
          .where(eq(analyses.userId, selectedUserId))
          .orderBy(desc(analyses.createdAt))
          .limit(5),

        db.select({
          id:            transactions.id,
          orderId:       transactions.orderId,
          status:        transactions.status,
          tokens:        transactions.tokens,
          amount:        transactions.amount,
          paymentMethod: transactions.paymentMethod,
          createdAt:     transactions.createdAt,
          paidAt:        transactions.paidAt
        })
          .from(transactions)
          .where(eq(transactions.userId, selectedUserId))
          .orderBy(desc(transactions.createdAt))
          .limit(5)
      ]);

      panelUser = {
        id:               pu.id,
        email:            pu.email,
        name:             pu.name,
        emailVerified:    pu.emailVerified,
        mfaEnabled:       pu.mfaEnabled,
        loginLockedUntil: pu.loginLockedUntil,
        balance:          pu.balance ?? 0,
        totalBought:      pu.totalBought ?? 0,
        totalUsed:        pu.totalUsed ?? 0,
        recentAnalyses,
        recentTransactions
      };
    }
  }

  /* ── close href (removes ?user=) ─────────────────────────────── */
  const closeParams = new URLSearchParams();
  if (q) closeParams.set("q", q);
  if (filter) closeParams.set("filter", filter);
  if (sort !== "created") closeParams.set("sort", sort);
  if (dir !== "desc") closeParams.set("dir", dir);
  const closeHref = `/admin/users${closeParams.toString() ? `?${closeParams.toString()}` : ""}`;

  /* ── stats ───────────────────────────────────────────────────── */
  const totalCount    = rows.length;
  const verifiedCount = rows.filter((r) => !!r.emailVerified).length;
  const lowTokenCount = rows.filter((r) => (r.balance ?? 0) <= 2).length;

  return (
    <KeyboardNav>
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#111112]">Users</h1>
            <p className="mt-0.5 text-xs text-[#6b7280]">
              {totalCount} user · {verifiedCount} verified · {lowTokenCount} token rendah
            </p>
          </div>
          <form method="get" action="/admin/users" className="flex items-center gap-2">
            {filter && <input type="hidden" name="filter" value={filter} />}
            {sort !== "created" && <input type="hidden" name="sort" value={sort} />}
            {dir !== "desc" && <input type="hidden" name="dir" value={dir} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari email / nama… (/)"
              autoComplete="off"
              className="w-56 rounded border border-[#e4e5ea] bg-white px-3 py-1.5 text-sm text-[#1b1c1f] placeholder:text-[#9ca3af] focus:border-[#111112] focus:outline-none"
            />
            {q && (
              <Link
                href={`/admin/users${filter ? `?filter=${filter}` : ""}`}
                className="rounded border border-[#e4e5ea] px-2 py-1.5 text-xs text-[#6b7280] hover:bg-[#f5f5f7]"
              >
                ✕
              </Link>
            )}
          </form>
        </div>

        {/* Filter bar */}
        <FilterBar q={q} filter={filter} sort={sort} dir={dir} />

        {/* Table */}
        <div className="border border-[#e4e5ea] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e4e5ea] bg-[#f5f5f7]">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">User</th>
                  <th className="w-20 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Verified</th>
                  <th className="w-24 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Token</th>
                  <th className="w-44 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Aktivitas terakhir</th>
                  <th className="w-32 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e5ea]">
                {rows.map((row) => {
                  const balance    = row.balance ?? 0;
                  const isSelected = row.id === selectedUserId;

                  const rowParams = new URLSearchParams();
                  if (q) rowParams.set("q", q);
                  if (filter) rowParams.set("filter", filter);
                  if (sort !== "created") rowParams.set("sort", sort);
                  if (dir !== "desc") rowParams.set("dir", dir);
                  rowParams.set("user", row.id);
                  const rowHref = `/admin/users?${rowParams.toString()}`;

                  return (
                    <tr
                      key={row.id}
                      data-row-href={rowHref}
                      tabIndex={0}
                      className={`cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#111112] ${
                        isSelected ? "bg-[#f5f5f7]" : "hover:bg-[#f5f5f7]/60"
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <Link href={rowHref} scroll={false} className="block" onClick={(e) => e.stopPropagation()}>
                          <div className="font-medium text-[#111112]">{row.email}</div>
                          <div className="mt-0.5 text-xs text-[#6b7280]">
                            {row.name ?? "—"} · dibuat {fmt(row.createdAt)}
                          </div>
                        </Link>
                      </td>

                      <td className="px-4 py-2.5">
                        {row.emailVerified
                          ? <span className="text-xs font-medium text-green-700">✓</span>
                          : <span className="text-xs text-amber-600">—</span>
                        }
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-sm font-semibold ${balance <= 2 ? "text-red-600" : "text-[#111112]"}`}>
                          {balance}
                        </span>
                        <div className="text-[11px] text-[#6b7280]">
                          {row.totalBought ?? 0}b · {row.totalUsed ?? 0}u
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-xs text-[#6b7280]">
                        {relativeTime(row.lastAnalysisAt)}
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <form action={adminAdjustTokens}>
                            <input type="hidden" name="userId" value={row.id} />
                            <input type="hidden" name="kind" value="grant" />
                            <input type="hidden" name="amount" value="5" />
                            <input type="hidden" name="note" value="quick grant dari list" />
                            <button
                              type="submit"
                              title="Grant 5 token"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!confirm(`Grant 5 token ke ${row.email}?`)) e.preventDefault();
                              }}
                              className="rounded border border-[#e4e5ea] px-2 py-1 text-[11px] font-medium text-[#6b7280] hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                            >
                              +5
                            </button>
                          </form>
                          <Link
                            href={rowHref}
                            scroll={false}
                            onClick={(e) => e.stopPropagation()}
                            title="Buka detail"
                            className="rounded border border-[#e4e5ea] px-2 py-1 text-[11px] font-medium text-[#6b7280] hover:bg-[#f5f5f7]"
                          >
                            Detail
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#6b7280]">
                      Tidak ada user yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#e4e5ea] px-4 py-2 text-xs text-[#6b7280]">
            {rows.length} user ·{" "}
            <kbd className="rounded border border-[#e4e5ea] px-1 py-0.5 font-mono text-[10px]">j</kbd>{" "}
            <kbd className="rounded border border-[#e4e5ea] px-1 py-0.5 font-mono text-[10px]">k</kbd> navigasi ·{" "}
            <kbd className="rounded border border-[#e4e5ea] px-1 py-0.5 font-mono text-[10px]">Enter</kbd> detail ·{" "}
            <kbd className="rounded border border-[#e4e5ea] px-1 py-0.5 font-mono text-[10px]">/</kbd> cari
          </div>
        </div>
      </div>

      {panelUser && (
        <UserDetailPanel user={panelUser} closeHref={closeHref} />
      )}
    </KeyboardNav>
  );
}
