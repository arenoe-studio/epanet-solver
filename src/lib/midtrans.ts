import MidtransClient from "midtrans-client";

import { TOKEN_PACKAGES, type TokenPackageKey } from "@/lib/token-packages";

export const PACKAGES = TOKEN_PACKAGES;
export type PackageKey = TokenPackageKey;

let cachedSnap: InstanceType<typeof MidtransClient.Snap> | null = null;

export function getSnap() {
  if (cachedSnap) return cachedSnap;

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const clientKey = process.env.MIDTRANS_CLIENT_KEY;
  if (!serverKey || !clientKey) {
    throw new Error("Missing Midtrans env vars: MIDTRANS_SERVER_KEY / MIDTRANS_CLIENT_KEY");
  }

  cachedSnap = new MidtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey,
    clientKey
  });

  return cachedSnap;
}
