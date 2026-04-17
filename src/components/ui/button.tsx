import { forwardRef } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold tracking-[-0.01em] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-link-cobalt/50 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
        size === "sm"
          ? "h-8 px-4 text-xs"
          : size === "lg"
            ? "h-11 px-7 text-base"
            : "h-9 px-5 text-sm",
        variant === "default"
          ? "bg-expo-black text-white shadow-sm hover:opacity-80"
          : variant === "outline"
            ? "border border-border-lavender bg-white text-near-black shadow-sm hover:bg-cloud-gray"
            : "bg-transparent text-slate-gray hover:bg-cloud-gray hover:text-near-black",
        className
      )}
      {...props}
    />
  );
});

