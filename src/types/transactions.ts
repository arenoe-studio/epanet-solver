export type TransactionStatus = "pending" | "paid" | "failed";

export type TransactionRow = {
  id: number;
  orderId: string;
  package: string | null;
  tokens: number | null;
  amount: number | null;
  status: TransactionStatus | string | null;
  paymentMethod: string | null;
  snapToken: string | null;
  snapTokenExpiresAt: string | Date | null;
  createdAt: string | Date | null;
  paidAt: string | Date | null;
};
