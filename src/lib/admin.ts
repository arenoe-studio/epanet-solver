import { getServerEnv } from "@/lib/env";

const MASTER_ADMIN_EMAIL = "arenoe.studio@gmail.com";

function parseEmailList(raw: string | undefined) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;

  return normalized === MASTER_ADMIN_EMAIL;
}

export function shouldBypassTokensForEmail(
  email: string | null | undefined
): boolean {
  if (!isAdminEmail(email)) return false;

  const env = getServerEnv();
  const bypass =
    env.ADMIN_BYPASS_TOKENS === undefined
      ? process.env.NODE_ENV !== "production"
      : env.ADMIN_BYPASS_TOKENS === "true";

  return bypass;
}
