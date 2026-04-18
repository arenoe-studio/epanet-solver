"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Users" },
  { href: "/admin/reports", label: "Laporan" },
  { href: "/admin/ledger", label: "Token Log" }
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Admin">
      {nav.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm transition",
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
  );
}

