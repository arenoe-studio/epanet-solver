"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function KeyboardNav({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function getRows(): HTMLElement[] {
      return Array.from(
        ref.current?.querySelectorAll<HTMLElement>("[data-row-href]") ?? []
      );
    }

    function focused(): HTMLElement | null {
      return ref.current?.querySelector<HTMLElement>("[data-row-href]:focus") ?? null;
    }

    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const rows = getRows();
      if (!rows.length) return;

      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const current = focused();
        const idx = current ? rows.indexOf(current) : -1;
        const next = e.key === "j"
          ? rows[Math.min(idx + 1, rows.length - 1)]
          : rows[Math.max(idx - 1, 0)];
        next?.focus();
      }

      if (e.key === "Enter") {
        const current = focused();
        const href = current?.dataset.rowHref;
        if (href) router.push(href, { scroll: false });
      }

      if (e.key === "Escape") {
        (document.activeElement as HTMLElement)?.blur();
      }

      if (e.key === "/") {
        e.preventDefault();
        ref.current?.querySelector<HTMLInputElement>("input[name='q']")?.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  return <div ref={ref}>{children}</div>;
}
