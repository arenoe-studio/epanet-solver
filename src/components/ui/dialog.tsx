"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function Dialog({
  open,
  onOpenChange,
  children
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    if (!open) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogContent({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(DialogContext);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!ctx?.open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/40"
        onClick={() => ctx.onOpenChange(false)}
        type="button"
      />
      <div
        className={cn(
          "relative z-[101] w-full max-w-xl rounded-3xl border border-border-lavender bg-white p-6 shadow-elevated",
          className
        )}
      >
        <button
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-full px-3 py-2 text-sm font-semibold text-slate-gray hover:bg-cloud-gray"
          onClick={() => ctx.onOpenChange(false)}
          type="button"
        >
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pr-8", className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-2xl font-semibold tracking-[-2px] text-expo-black",
        className
      )}
      {...props}
    />
  );
}
