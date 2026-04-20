"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/* ── nav items ─────────────────────────────────────────────────── */
const nav = [
  {
    href: "/admin",
    label: "Overview",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: "/admin/payments",
    label: "Payments",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="3.5" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1 7h14" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    href: "/admin/reports",
    label: "Laporan",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 2h12v9H9l-3 3V11H2V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    href: "/admin/ledger",
    label: "Token Log",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 4h10M3 8h10M3 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: "/admin/health",
    label: "Health",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M1 8h2.5l2-5 3 10 2-5H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    href: "/admin/maintenance",
    label: "Maintenance",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
];

/* ── component ──────────────────────────────────────────────────── */
export function AdminSidebar(props: {
  email: string;
  collapsed: boolean;
  onCollapse: () => void;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const { collapsed } = props;

  return (
    <aside className="flex h-full flex-col">
      {/* Header */}
      <div className={cn(
        "flex items-center border-b border-[#e4e5ea] py-3",
        collapsed ? "justify-center px-0" : "justify-between px-4 gap-2"
      )}>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">Admin</div>
            <div className="truncate text-sm font-bold text-[#111112]">Root Panel</div>
            <div className="truncate text-[11px] text-[#6b7280]">{props.email}</div>
          </div>
        )}
        <button
          type="button"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={props.onCollapse}
          className="shrink-0 rounded-md p-1 text-[#6b7280] hover:bg-[#f5f5f7] hover:text-[#111112]"
        >
          {collapsed ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav aria-label="Admin" className="flex flex-1 flex-col gap-0.5 p-2">
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
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm",
                active
                  ? "bg-[#f5f5f7] font-semibold text-[#111112]"
                  : "text-[#6b7280] hover:bg-[#f5f5f7] hover:text-[#111112]",
                collapsed && "justify-center px-0"
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn(
        "border-t border-[#e4e5ea] p-2 space-y-1",
      )}>
        {!collapsed && (
          <Link
            href="/"
            onClick={props.onNavigate}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-[#6b7280] hover:bg-[#f5f5f7] hover:text-[#111112]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 12L5 8l5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Kembali ke App
          </Link>
        )}
        <button
          type="button"
          title={collapsed ? "Keluar" : undefined}
          onClick={() => {
            props.onNavigate();
            void signOut({ callbackUrl: "/" });
          }}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-[#6b7280] hover:bg-red-50 hover:text-red-700",
            collapsed && "justify-center px-0"
          )}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {!collapsed && <span>Keluar</span>}
        </button>
      </div>
    </aside>
  );
}
