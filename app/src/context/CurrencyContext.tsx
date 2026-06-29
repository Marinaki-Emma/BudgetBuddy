import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

/** Major world currencies, by display symbol. */
export const CURRENCIES: Currency[] = [
  { code: "EUR", symbol: "€",  name: "Euro" },
  { code: "USD", symbol: "$",  name: "US Dollar" },
  { code: "GBP", symbol: "£",  name: "British Pound" },
  { code: "JPY", symbol: "¥",  name: "Japanese Yen" },
  { code: "CNY", symbol: "¥",  name: "Chinese Yuan" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "INR", symbol: "₹",  name: "Indian Rupee" },
  { code: "RUB", symbol: "₽",  name: "Russian Ruble" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "KRW", symbol: "₩",  name: "South Korean Won" },
  { code: "TRY", symbol: "₺",  name: "Turkish Lira" },
  { code: "MXN", symbol: "$",  name: "Mexican Peso" },
  { code: "ZAR", symbol: "R",  name: "South African Rand" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "PLN", symbol: "zł", name: "Polish Złoty" },
];

interface CurrencyContextValue {
  currency: Currency;
  symbol: string;
  setCurrencyCode: (code: string) => void;
}

const DEFAULT = CURRENCIES[0];

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT,
  symbol: DEFAULT.symbol,
  setCurrencyCode: () => {},
});

const STORAGE_KEY = "budget_buddy_currency";

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [code, setCode] = useState<string>(DEFAULT.code);

  // Load saved preference on startup
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved: string | null) => {
      if (saved && CURRENCIES.some((c) => c.code === saved)) {
        setCode(saved);
      }
    });
  }, []);

  function setCurrencyCode(next: string) {
    setCode(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const currency = CURRENCIES.find((c) => c.code === code) ?? DEFAULT;

  return (
    <CurrencyContext.Provider value={{ currency, symbol: currency.symbol, setCurrencyCode }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
