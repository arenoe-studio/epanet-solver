"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastVariant = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  push: (toast: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function genId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = genId();
    setToasts((prev) => [{ id, ...toast }, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[200] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "rounded-xl border px-4 py-3 shadow-elevated",
              t.variant === "success"
                ? "border-green-200 bg-green-50"
                : t.variant === "error"
                  ? "border-red-200 bg-red-50"
                  : "border-border-lavender bg-white"
            ].join(" ")}
          >
            <div className="flex items-start gap-2.5">
              <div
                className={[
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  t.variant === "success"
                    ? "bg-green-500 text-white"
                    : t.variant === "error"
                      ? "bg-red-500 text-white"
                      : "bg-expo-black text-white"
                ].join(" ")}
                aria-hidden
              >
                {t.variant === "success" ? "✓" : t.variant === "error" ? "!" : "i"}
              </div>
              <div className="min-w-0">
                <div
                  className={[
                    "text-sm font-semibold",
                    t.variant === "success"
                      ? "text-green-900"
                      : t.variant === "error"
                        ? "text-red-900"
                        : "text-expo-black"
                  ].join(" ")}
                >
                  {t.title}
                </div>
                {t.description ? (
                  <div
                    className={[
                      "mt-0.5 text-xs leading-relaxed",
                      t.variant === "success"
                        ? "text-green-700"
                        : t.variant === "error"
                          ? "text-red-700"
                          : "text-slate-gray"
                    ].join(" ")}
                  >
                    {t.description}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

