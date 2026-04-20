import { clsx } from "clsx";

export function cn(...inputs: Array<string | undefined | null | false>) {
  return clsx(inputs);
}

export function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount);
}

export function normalizeQrisQrImageUrl(input: string) {
  const raw = input.trim();
  if (!raw) return "";

  if (
    raw.startsWith("data:") ||
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("/")
  ) {
    return raw;
  }

  if (raw.startsWith("public/")) {
    return `/${raw.slice("public/".length)}`;
  }

  if (raw.startsWith("./")) {
    return `/${raw.slice(2)}`;
  }

  return `/${raw}`;
}
