import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
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
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    ADMIN_BYPASS_TOKENS: process.env.ADMIN_BYPASS_TOKENS
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => i.path.join("."))
      .filter(Boolean);
    throw new Error(
      `Missing/invalid server env vars: ${missing.join(", ")}. Copy .env.example → .env.local and fill values.`
    );
  }

  cached = parsed.data;
  return parsed.data;
}
