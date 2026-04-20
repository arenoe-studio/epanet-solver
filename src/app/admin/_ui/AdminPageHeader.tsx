import { cn } from "@/lib/utils";

export function AdminPageHeader({
  label,
  title,
  description,
  actions,
  className
}: {
  label?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", className)}>
      <div>
        {label && (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">
            {label}
          </div>
        )}
        <h1 className="text-xl font-bold text-[#111112]">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs text-[#6b7280]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
