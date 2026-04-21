import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RatelimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number; limit: number };

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

type BackoffResult =
  | { ok: true; cooldownSeconds: number }
  | { ok: false; retryAfterSeconds: number; cooldownSeconds: number };

let cachedAnalyzeLimiter: Ratelimit | null = null;
let cachedTxLimiter: Ratelimit | null = null;
let cachedAuthLimiter: Ratelimit | null = null;
let cachedOtpLimiter: Ratelimit | null = null;

function getAnalyzeLimiter() {
  if (cachedAnalyzeLimiter) return cachedAnalyzeLimiter;
  const redis = getRedis();
  if (!redis) return null;
  cachedAnalyzeLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    analytics: true,
    prefix: "rl:analyze"
  });
  return cachedAnalyzeLimiter;
}

function getTxLimiter() {
  if (cachedTxLimiter) return cachedTxLimiter;
  const redis = getRedis();
  if (!redis) return null;
  cachedTxLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "10 m"),
    analytics: true,
    prefix: "rl:tx"
  });
  return cachedTxLimiter;
}

function getAuthLimiter() {
  if (cachedAuthLimiter) return cachedAuthLimiter;
  const redis = getRedis();
  if (!redis) return null;
  cachedAuthLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "10 m"),
    analytics: true,
    prefix: "rl:auth"
  });
  return cachedAuthLimiter;
}

function getOtpLimiter() {
  if (cachedOtpLimiter) return cachedOtpLimiter;
  const redis = getRedis();
  if (!redis) return null;
  cachedOtpLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    analytics: true,
    prefix: "rl:otp"
  });
  return cachedOtpLimiter;
}

export async function rateLimitAnalyze(key: string): Promise<RatelimitResult> {
  const limiter = getAnalyzeLimiter();
  if (!limiter) return { ok: true };
  const res = await limiter.limit(key);
  if (res.success) return { ok: true };
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil(res.reset / 1000)),
    limit: res.limit
  };
}

export async function rateLimitCreateTransaction(
  key: string
): Promise<RatelimitResult> {
  const limiter = getTxLimiter();
  if (!limiter) return { ok: true };
  const res = await limiter.limit(key);
  if (res.success) return { ok: true };
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil(res.reset / 1000)),
    limit: res.limit
  };
}

export async function rateLimitAuth(key: string): Promise<RatelimitResult> {
  const limiter = getAuthLimiter();
  if (!limiter) return { ok: true };
  const res = await limiter.limit(key);
  if (res.success) return { ok: true };
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil(res.reset / 1000)),
    limit: res.limit
  };
}

export async function rateLimitOtpSend(key: string): Promise<RatelimitResult> {
  const limiter = getOtpLimiter();
  if (!limiter) return { ok: true };
  const res = await limiter.limit(key);
  if (res.success) return { ok: true };
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil(res.reset / 1000)),
    limit: res.limit
  };
}

export async function rateLimitBackoff(
  key: string,
  opts: {
    baseSeconds: number;
    maxSeconds: number;
    windowSeconds: number;
  }
): Promise<BackoffResult> {
  const redis = getRedis();
  const baseSeconds = Math.max(1, Math.floor(opts.baseSeconds));
  const maxSeconds = Math.max(baseSeconds, Math.floor(opts.maxSeconds));
  const windowSeconds = Math.max(60, Math.floor(opts.windowSeconds));

  // Fallback (tanpa Redis): pakai cooldown base agar UI tetap punya timer.
  if (!redis) return { ok: true, cooldownSeconds: baseSeconds };

  const now = Date.now();
  const redisKey = `backoff:${key}`;

  let count = 0;
  let nextAtMs = 0;
  try {
    const raw = await redis.get<string>(redisKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { count?: unknown; nextAtMs?: unknown };
      const c = Number(parsed?.count ?? 0);
      const n = Number(parsed?.nextAtMs ?? 0);
      if (Number.isFinite(c) && c > 0) count = Math.floor(c);
      if (Number.isFinite(n) && n > 0) nextAtMs = Math.floor(n);
    }
  } catch {
    count = 0;
    nextAtMs = 0;
  }

  if (nextAtMs > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((nextAtMs - now) / 1000));
    return { ok: false, retryAfterSeconds, cooldownSeconds: retryAfterSeconds };
  }

  const nextCount = Math.min(30, count + 1);
  const exp = Math.min(10, nextCount - 1);
  const cooldownSeconds = Math.min(maxSeconds, baseSeconds * 2 ** exp);

  const newState = {
    count: nextCount,
    nextAtMs: now + cooldownSeconds * 1000
  };

  try {
    await redis.set(redisKey, JSON.stringify(newState), { ex: windowSeconds });
  } catch {
    // Jika gagal set state, tetap izinkan request agar UX tidak macet.
  }

  return { ok: true, cooldownSeconds };
}
