import type { Metadata } from "next";

import { AdminNav } from "@/app/admin/AdminNav";
import { requireAdmin } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Admin — EPANET Solver",
  robots: { index: false, follow: false }
};

export default async function AdminLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const { email } = await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
            Admin
          </div>
          <div className="mt-1 text-2xl font-bold tracking-[-0.04em] text-expo-black">
            Panel Admin
          </div>
          <div className="mt-1 text-xs text-slate-gray">
            Login sebagai: <span className="font-semibold text-near-black">{email}</span>
          </div>
        </div>
        <AdminNav />
      </div>

      {children}
    </div>
  );
}

