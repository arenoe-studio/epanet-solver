export type PaymentProvider = "midtrans";

export function getPaymentProvider(): PaymentProvider {
  const raw = (process.env.PAYMENT_PROVIDER ?? "midtrans").toLowerCase();
  return raw === "midtrans" ? "midtrans" : "midtrans";
}

export function getPaymentAdminEmail(): string | null {
  const to = process.env.PAYMENT_ADMIN_EMAIL?.trim();
  return to ? to : null;
}
