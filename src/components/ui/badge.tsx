import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "outline";
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tracking-[-0.01em]",
        variant === "default"
          ? "bg-expo-black text-white"
          : "border border-border-lavender bg-white text-near-black",
        className
      )}
      {...props}
    />
  );
}

