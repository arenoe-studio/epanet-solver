"use client";

export function ConfirmButton({
  message,
  className,
  title,
  children
}: {
  message: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      title={title}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
