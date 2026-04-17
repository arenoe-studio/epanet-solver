import { cn } from "@/lib/utils";

export function Progress({
  value,
  className
}: {
  value: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-border-lavender",
        className
      )}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={clamped}
      role="progressbar"
    >
      <div
        className="h-full rounded-full bg-expo-black transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

