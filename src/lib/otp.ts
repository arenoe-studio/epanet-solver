import crypto from "node:crypto";

export type OtpPurpose = "verify_email" | "login" | "reset_password";

export function generateOtpCode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

export function hashOtpCode(code: string, pepper: string): string {
  return crypto
    .createHash("sha256")
    .update(`${pepper}:${code}`)
    .digest("hex");
}

