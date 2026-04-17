export const TOKEN_PACKAGES = {
  starter: { tokens: 6, amount: 10000, name: "Starter 6 Token" },
  value: { tokens: 18, amount: 25000, name: "Value 18 Token" }
} as const;

export type TokenPackageKey = keyof typeof TOKEN_PACKAGES;

