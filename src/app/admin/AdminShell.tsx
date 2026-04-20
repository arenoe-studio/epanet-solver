"use client";

import { useEffect, useId, useState } from "react";

import { AdminSidebar } from "@/app/admin/AdminSidebar";

export function AdminShell(props: { email: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="min-h-screen bg-cloud-gray text-near-black">
      <div className="mx-auto flex w-full max-w-[1100px] gap-6 px-4 py-6 sm:px-6">
        <div className="hidden w-64 shrink-0 lg:block">
          <AdminSidebar email={props.email} onNavigate={() => undefined} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-gray">
                Admin
              </div>
              <div id={headingId} className="truncate text-sm font-semibold text-expo-black">
                Panel
              </div>
            </div>
            <button
              type="button"
              className="rounded-xl border border-border-lavender bg-white px-3 py-2 text-sm font-semibold text-near-black transition hover:bg-cloud-gray active:scale-[0.98]"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-controls="admin-sidebar-drawer"
              aria-expanded={open}
            >
              Menu
            </button>
          </div>

          <main aria-labelledby={headingId}>{props.children}</main>
        </div>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          id="admin-sidebar-drawer"
          className="fixed inset-0 z-50 lg:hidden"
        >
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-expo-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[320px] max-w-[85vw] bg-cloud-gray p-4">
            <AdminSidebar
              email={props.email}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

