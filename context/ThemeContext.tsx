import React, { createContext, useContext, useEffect, useState } from "react";
import { loadData, saveData } from "@/utils/storage";

export type ThemeOption = "light" | "dark" | "system";

interface ThemeContextValue {
  themeOption: ThemeOption;
  theme: "light" | "dark";
  setThemeOption: (t: ThemeOption) => void;
  currencySymbol: string;
  setCurrencySymbol: (s: string) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeOption, setThemeOptionState] = useState<ThemeOption>("dark");
  const [currencySymbol, setCurrencySymbolState] = useState("$");

  useEffect(() => {
    loadData("theme_option", "dark" as ThemeOption).then(setThemeOptionState);
    loadData("currency_symbol", "$").then(setCurrencySymbolState);
  }, []);

  function setThemeOption(t: ThemeOption) {
    setThemeOptionState(t);
    saveData("theme_option", t);
  }

  function setCurrencySymbol(s: string) {
    setCurrencySymbolState(s);
    saveData("currency_symbol", s);
  }

  const theme: "light" | "dark" = themeOption === "system" ? "dark" : themeOption;

  return (
    <ThemeContext.Provider value={{ themeOption, theme, setThemeOption, currencySymbol, setCurrencySymbol }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
