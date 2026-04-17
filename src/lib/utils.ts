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
