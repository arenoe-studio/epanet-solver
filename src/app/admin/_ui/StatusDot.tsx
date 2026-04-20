import { cn } from "@/lib/utils";

type Level = "ok" | "warn" | "down" | "info";

const dotColor: Record<Level, string> = {
  ok: "bg-green-500",
  warn: "bg-amber-400",
  down: "bg-red-500",
  info: "bg-[#6b7280]"
};

const textColor: Record<Level, string> = {
  ok: "text-green-700",
  warn: "text-amber-700",
  down: "text-red-700",
  info: "text-[#6b7280]"
};

export function StatusDot({
  level,
  label,
  className
}: {
  level: Level;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", textColor[level], className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor[level])} />
      {label}
    </span>
  );
}
