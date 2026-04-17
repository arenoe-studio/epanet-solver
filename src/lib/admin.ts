import { getServerEnv } from "@/lib/env";

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

  const env = getServerEnv();
  const admins = parseEmailList(env.ADMIN_EMAILS);
  return admins.includes(normalized);
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

