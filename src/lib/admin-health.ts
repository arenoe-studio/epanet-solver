import "server-only";

import { Redis } from "@upstash/redis";

import { getPaymentProvider } from "@/lib/payment";

type HealthState = "ok" | "degraded" | "down";

export type HealthCheckResult = {
  name: string;
  state: HealthState;
  checkedAt: Date;
  message: string;
};

function safeErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

export async function checkDatabase(opts: {
  probe: () => Promise<void>;
}): Promise<HealthCheckResult> {
  const checkedAt = new Date();
  try {
    await opts.probe();
    return {
      name: "Database",
      state: "ok",
      checkedAt,
      message: "Connected"
    };
  } catch (err) {
    return {
      name: "Database",
      state: "down",
      checkedAt,
      message: safeErrorMessage(err)
    };
  }
}

export async function checkUpstashRedis(): Promise<HealthCheckResult> {
  const checkedAt = new Date();
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return {
      name: "Redis (Upstash)",
      state: "degraded",
      checkedAt,
      message: "Not configured"
    };
  }

  try {
    const redis = new Redis({ url, token });
    await redis.get<string>("__health__");
    return {
      name: "Redis (Upstash)",
      state: "ok",
      checkedAt,
      message: "Connected"
    };
  } catch (err) {
    return {
      name: "Redis (Upstash)",
      state: "down",
      checkedAt,
      message: safeErrorMessage(err)
    };
  }
}

export function checkConfigSanity(): HealthCheckResult[] {
  const checkedAt = new Date();
  const configured = (name: string, ok: boolean) => ({
    name,
    state: ok ? ("ok" as const) : ("degraded" as const),
    checkedAt,
    message: ok ? "Configured" : "Missing"
  });

  const paymentProvider = getPaymentProvider();
  const midtransOk =
    process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY &&
    process.env.MIDTRANS_SERVER_KEY;

  const qrisOk =
    process.env.NEXT_PUBLIC_QRIS_STATIC_QR_IMAGE_URL;

  return [
    configured("DATABASE_URL", !!process.env.DATABASE_URL),
    configured("RESEND_API_KEY", !!process.env.RESEND_API_KEY),
    configured(
      "Midtrans",
      paymentProvider === "midtrans" ? !!midtransOk : true
    ),
    configured(
      "QRIS Static",
      paymentProvider === "qris_static" ? !!qrisOk : true
    )
  ];
}
