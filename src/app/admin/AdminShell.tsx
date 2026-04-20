"use client";

import { useEffect, useId, useState } from "react";

import { AdminSidebar } from "@/app/admin/AdminSidebar";

export function AdminShell(props: { email: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const titleId = useId();

  /* persist sidebar state */
  useEffect(() => {
    const stored = localStorage.getItem("admin-sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem("admin-sidebar-collapsed", prev ? "0" : "1");
      return !prev;
    });
  }

  /* close mobile sheet on Esc */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f5f5f7]">
      {/* ── Desktop sidebar ── */}
      <div
        style={{ width: collapsed ? 48 : 208 }}
        className="hidden shrink-0 flex-col border-r border-[#e4e5ea] bg-white transition-[width] duration-200 lg:flex"
      >
        <AdminSidebar
          email={props.email}
          collapsed={collapsed}
          onCollapse={toggleCollapsed}
          onNavigate={() => undefined}
        />
      </div>

      {/* ── Main content ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-[#e4e5ea] bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            aria-label="Buka menu"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1 text-[#6b7280] hover:bg-[#f5f5f7] hover:text-[#111112]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <span id={titleId} className="text-sm font-semibold text-[#111112]">Admin Panel</span>
        </div>

        <main className="flex-1 p-4 lg:p-6">{props.children}</main>
      </div>

      {/* ── Mobile bottom sheet ── */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 lg:hidden"
        >
          {/* backdrop */}
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          {/* sheet */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-xl bg-white">
            {/* drag handle */}
            <div className="flex justify-center pb-1 pt-3">
              <div className="h-1 w-10 rounded-full bg-[#e4e5ea]" />
            </div>
            <AdminSidebar
              email={props.email}
              collapsed={false}
              onCollapse={() => undefined}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
