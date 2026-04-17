export const TOKEN_PACKAGE_ORDER = [
  "mauCoba",
  "upsKurangDikit",
  "bestValue",
  "tenangSampaiSelesai"
] as const;

export type TokenPackageKey = (typeof TOKEN_PACKAGE_ORDER)[number];

export type TokenPackage = {
  key: TokenPackageKey;
  name: string;
  tokens: number;
  amount: number;
  pricePerToken: number;
  analysisCount: number;
  fixCount: number;
  comparePrice: number | null;
  compareLabel: string | null;
  savingsLabel: string | null;
  usageLabel: string;
  framing: string;
  badge?: string;
  badgeTone?: "accent" | "primary" | "muted";
  featured?: boolean;
};

export const TOKEN_PACKAGES: Record<TokenPackageKey, TokenPackage> = {
  mauCoba: {
    key: "mauCoba",
    name: "Mau Coba",
    tokens: 6,
    amount: 8900,
    pricePerToken: 1483,
    analysisCount: 1,
    fixCount: 0,
    comparePrice: null,
    compareLabel: null,
    savingsLabel: null,
    usageLabel: "Untuk 1x analisis penuh",
    framing: "Cukup untuk mencoba sekali",
    badge: undefined,
    badgeTone: "muted"
  },
  upsKurangDikit: {
    key: "upsKurangDikit",
    name: "Ups Kurang Dikit",
    tokens: 13,
    amount: 16900,
    pricePerToken: 1300,
    analysisCount: 2,
    fixCount: 1,
    comparePrice: 26700,
    compareLabel: "Rp 26.700",
    savingsLabel: "Hemat Rp 9.800",
    usageLabel: "Untuk 2x analisis + 1x fix pressure",
    framing: "atau 2× beli Paket 1"
  },
  bestValue: {
    key: "bestValue",
    name: "Best Value",
    tokens: 18,
    amount: 19900,
    pricePerToken: 1106,
    analysisCount: 3,
    fixCount: 1,
    comparePrice: 35600,
    compareLabel: "Rp 35.600",
    savingsLabel: "Hemat Rp 15.700",
    usageLabel: "Untuk 3x analisis + 1x fix pressure",
    framing: "Lebih murah dari fotokopi + jilid laporan",
    badge: "🔥 PALING WORTH IT",
    badgeTone: "accent",
    featured: true
  },
  tenangSampaiSelesai: {
    key: "tenangSampaiSelesai",
    name: "Tenang Sampai Selesai",
    tokens: 28,
    amount: 27900,
    pricePerToken: 996,
    analysisCount: 5,
    fixCount: 1,
    comparePrice: 53400,
    compareLabel: "Rp 53.400",
    savingsLabel: "Hemat Rp 25.500",
    usageLabel: "Untuk 5x analisis + 1x fix pressure",
    framing: "Cukup untuk sepanjang semester",
    badge: "💡 UNTUK SKRIPSI",
    badgeTone: "primary"
  }
} as const;

const LEGACY_PACKAGE_ALIASES: Record<string, TokenPackageKey> = {
  starter: "mauCoba",
  value: "bestValue"
};

export function resolveTokenPackageKey(
  value: string | null | undefined
): TokenPackageKey | null {
  if (!value) return null;
  if (value in TOKEN_PACKAGES) return value as TokenPackageKey;
  return LEGACY_PACKAGE_ALIASES[value] ?? null;
}

export function getTokenPackage(value: string | null | undefined) {
  const key = resolveTokenPackageKey(value);
  return key ? TOKEN_PACKAGES[key] : null;
}

export const TOKEN_PACKAGES_LIST = TOKEN_PACKAGE_ORDER.map((key) => TOKEN_PACKAGES[key]);
