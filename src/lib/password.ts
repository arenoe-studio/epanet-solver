import crypto from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;

const DEFAULT_N = 16384;
const DEFAULT_R = 8;
const DEFAULT_P = 1;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SCRYPT_SALT_BYTES);
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: DEFAULT_N,
    r: DEFAULT_R,
    p: DEFAULT_P
  });

  return [
    "scrypt",
    String(DEFAULT_N),
    String(DEFAULT_R),
    String(DEFAULT_P),
    salt.toString("base64"),
    derivedKey.toString("base64")
  ].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const [alg, nStr, rStr, pStr, saltB64, hashB64] = parts;
  if (alg !== "scrypt") return false;

  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  if (!salt.length || !expected.length) return false;

  const actual = crypto.scryptSync(password, salt, expected.length, { N, r, p });
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

