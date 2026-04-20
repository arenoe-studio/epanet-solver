import { normalizeQrisQrImageUrl } from "@/lib/utils";

export type PaymentProvider = "midtrans" | "qris_static";

export function getPaymentProvider(): PaymentProvider {
  const raw = (process.env.PAYMENT_PROVIDER ?? "qris_static").toLowerCase();
  return raw === "midtrans" ? "midtrans" : "qris_static";
}

export type QrisStaticConfig = {
  qrImageUrl: string;
  label: string;
};

export function getQrisStaticConfig(): QrisStaticConfig | null {
  const qrImageUrlRaw = process.env.NEXT_PUBLIC_QRIS_STATIC_QR_IMAGE_URL?.trim();
  if (!qrImageUrlRaw) return null;
  const qrImageUrl = normalizeQrisQrImageUrl(qrImageUrlRaw);
  if (!qrImageUrl) return null;
  const label =
    process.env.NEXT_PUBLIC_QRIS_STATIC_LABEL?.trim() || "QRIS";
  return { qrImageUrl, label };
}

export function getPaymentAdminEmail(): string | null {
  const to = process.env.PAYMENT_ADMIN_EMAIL?.trim();
  return to ? to : null;
}
