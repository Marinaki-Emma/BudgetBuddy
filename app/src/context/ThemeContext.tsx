import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MidnightTheme, SandTheme } from "../theme";
import type { MD3Theme } from "react-native-paper";

type ThemeName = "midnight" | "sand";

interface ThemeContextValue {
  themeName: ThemeName;
  theme: MD3Theme;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeName: "midnight",
  theme: MidnightTheme,
  isDark: true,
  toggleTheme: () => {},
});

const STORAGE_KEY = "budget_buddy_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>("midnight");

  // Load saved preference on startup
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved: string | null) => {
      if (saved === "sand" || saved === "midnight") {
        setThemeName(saved);
      }
    });
  }, []);

  function toggleTheme() {
    const next: ThemeName = themeName === "midnight" ? "sand" : "midnight";
    setThemeName(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const theme = themeName === "midnight" ? MidnightTheme : SandTheme;
  const isDark = themeName === "midnight";

  return (
    <ThemeContext.Provider value={{ themeName, theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}