import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1).optional(),
  AUTH_EMAIL_FROM: z.string().min(1).optional(),
  AUTH_REQUIRE_LOGIN_OTP: z.enum(["true", "false"]).optional(),
  AUTH_OTP_TTL_MINUTES: z.coerce.number().int().min(3).max(60).optional(),
  // Comma-separated list of admin emails (lower/upper case allowed)
  ADMIN_EMAILS: z.string().optional(),
  // When "true", admins can run analysis without token deductions.
  // Defaults to enabled in non-production builds.
  ADMIN_BYPASS_TOKENS: z.enum(["true", "false"]).optional()
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    AUTH_REQUIRE_LOGIN_OTP: process.env.AUTH_REQUIRE_LOGIN_OTP,
    AUTH_OTP_TTL_MINUTES: process.env.AUTH_OTP_TTL_MINUTES,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    ADMIN_BYPASS_TOKENS: process.env.ADMIN_BYPASS_TOKENS
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => i.path.join("."))
      .filter(Boolean);
    throw new Error(
      `Missing/invalid server env vars: ${missing.join(", ")}. Copy .env.example -> .env.local and fill values.`
    );
  }

  cached = parsed.data;
  return parsed.data;
}
