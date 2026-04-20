import type { Metadata } from "next";

import { AdminShell } from "@/app/admin/AdminShell";
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
    <AdminShell email={email}>{children}</AdminShell>
  );
}
