import type { ExchangeRates } from "@shared/schema";

let cachedRates: { base: string; rates: ExchangeRates; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function getExchangeRates(base: string): Promise<ExchangeRates> {
  if (cachedRates && cachedRates.base === base && Date.now() - cachedRates.timestamp < CACHE_DURATION) {
    return cachedRates.rates;
  }

  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}`);
    if (!res.ok) throw new Error(`Exchange rate API error: ${res.status}`);
    const data = await res.json();

    const rates: ExchangeRates = { [base]: 1, ...data.rates };
    cachedRates = { base, rates, timestamp: Date.now() };
    return rates;
  } catch (error) {
    console.error("Failed to fetch exchange rates:", error);
    if (cachedRates && cachedRates.base === base) {
      return cachedRates.rates;
    }
    return { [base]: 1 };
  }
}
