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
