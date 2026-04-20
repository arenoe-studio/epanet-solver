"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/reports", label: "Laporan" },
  { href: "/admin/ledger", label: "Token Log" },
  { href: "/admin/health", label: "Health" },
  { href: "/admin/maintenance", label: "Maintenance" }
];

export function AdminSidebar(props: { email: string; onNavigate: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="rounded-3xl border border-border-lavender bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
            Admin
          </div>
          <div className="mt-1 truncate text-base font-bold tracking-[-0.03em] text-expo-black">
            Root Panel
          </div>
          <div className="mt-1 truncate text-xs text-slate-gray">
            {props.email}
          </div>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-xl border border-border-lavender bg-white px-3 py-1.5 text-xs font-semibold text-near-black transition hover:bg-cloud-gray active:scale-[0.98]"
          onClick={props.onNavigate}
        >
          Back
        </Link>
      </div>

      <nav aria-label="Admin" className="mt-4 flex flex-col gap-1">
        {nav.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={props.onNavigate}
              className={cn(
                "rounded-2xl px-3 py-2 text-sm transition",
                active
                  ? "bg-cloud-gray font-semibold text-expo-black"
                  : "text-slate-gray hover:bg-cloud-gray hover:text-expo-black"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-border-lavender pt-4">
        <button
          type="button"
          className="w-full rounded-2xl bg-expo-black px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          onClick={() => {
            props.onNavigate();
            void signOut({ callbackUrl: "/" });
          }}
        >
          Keluar
        </button>
      </div>
    </aside>
  );
}

