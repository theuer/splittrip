import { useState, useCallback } from "react";

const STORAGE_KEY = "splittrip-my-currency";

export function useMyCurrency() {
  const [myCurrency, setMyCurrencyState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const setMyCurrency = useCallback((currency: string) => {
    setMyCurrencyState(currency);
    try {
      if (currency) {
        localStorage.setItem(STORAGE_KEY, currency);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, []);

  return { myCurrency, setMyCurrency };
}
