import useSWR from "swr";

type TokenBalanceResponse =
  | { balance: number; totalBought: number; totalUsed: number }
  | { error: string };

async function fetcher(url: string): Promise<TokenBalanceResponse> {
  const res = await fetch(url);
  return res.json();
}

export function useTokenBalance(enabled: boolean) {
  const { data, isLoading, mutate } = useSWR(
    enabled ? "/api/token/balance" : null,
    fetcher,
    { refreshInterval: enabled ? 15000 : 0 }
  );

  if (!enabled) {
    return { balance: null as number | null, isLoading: false, refresh: mutate };
  }

  if (!data || "error" in data) {
    return { balance: null as number | null, isLoading, refresh: mutate };
  }

  return { balance: data.balance, isLoading, refresh: mutate };
}

