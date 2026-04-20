import { cn } from "@/lib/utils";

export function AdminSection({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("border border-[#e4e5ea] bg-white", className)}>
      {children}
    </div>
  );
}

export function AdminSectionHeader({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("border-b border-[#e4e5ea] px-4 py-3", className)}>
      {children}
    </div>
  );
}

export function AdminSectionBody({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("px-4 py-3", className)}>{children}</div>
  );
}
