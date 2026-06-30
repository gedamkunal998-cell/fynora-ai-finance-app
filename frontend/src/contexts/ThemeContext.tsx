import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useColorScheme } from "react-native";

import { storage } from "@/src/utils/storage";
import { palette, Palette, ThemeMode } from "@/src/lib/theme";
import { Language, SUPPORTED_LANGUAGES } from "@/src/lib/i18n";

type ThemeState = {
  mode: ThemeMode;
  colors: Palette;
  language: Language;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
  setLanguage: (l: Language) => void;
};

const ThemeContext = createContext<ThemeState | undefined>(undefined);

const ALL_LANG_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

function isLanguage(v: string): v is Language {
  return (ALL_LANG_CODES as string[]).includes(v);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [language, setLangState] = useState<Language>("en");

  useEffect(() => {
    (async () => {
      const m = (await storage.getItem<string>("fynora_theme", "")) as ThemeMode | "";
      const l = await storage.getItem<string>("fynora_lang", "");
      if (m === "dark" || m === "light") setModeState(m);
      else setModeState(system === "light" ? "light" : "dark");
      if (l && isLanguage(l)) setLangState(l);
    })();
  }, [system]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    storage.setItem("fynora_theme", m);
  };

  const setLanguage = (l: Language) => {
    setLangState(l);
    storage.setItem("fynora_lang", l);
  };

  const toggleMode = () => setMode(mode === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider
      value={{ mode, colors: palette[mode] as Palette, language, setMode, toggleMode, setLanguage }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
