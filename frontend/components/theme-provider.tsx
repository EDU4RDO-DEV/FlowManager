"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: "class" | "data-theme";
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: Theme, enableSystem: boolean): ResolvedTheme {
  if (theme === "system") {
    return enableSystem ? getSystemTheme() : "light";
  }

  return theme;
}

function applyThemeToDom(
  resolvedTheme: ResolvedTheme,
  attribute: "class" | "data-theme",
  disableTransitionOnChange: boolean,
) {
  const root = document.documentElement;

  if (disableTransitionOnChange) {
    root.classList.add("theme-no-transition");
  }

  if (attribute === "class") {
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  } else {
    root.setAttribute("data-theme", resolvedTheme);
  }

  root.style.colorScheme = resolvedTheme;

  if (disableTransitionOnChange) {
    window.setTimeout(() => {
      root.classList.remove("theme-no-transition");
    }, 0);
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "flowmanager-theme",
  attribute = "class",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  const applyAndStoreTheme = useCallback(
    (nextTheme: Theme, shouldPersist: boolean) => {
      const nextResolvedTheme = resolveTheme(nextTheme, enableSystem);
      setThemeState(nextTheme);
      setResolvedTheme(nextResolvedTheme);
      applyThemeToDom(nextResolvedTheme, attribute, disableTransitionOnChange);

      if (shouldPersist) {
        window.localStorage.setItem(storageKey, nextTheme);
      }
    },
    [attribute, disableTransitionOnChange, enableSystem, storageKey],
  );

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(storageKey) as Theme | null;
    const initialTheme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
      ? storedTheme
      : defaultTheme;

    applyAndStoreTheme(initialTheme, false);
  }, [applyAndStoreTheme, defaultTheme, storageKey]);

  useEffect(() => {
    if (!enableSystem) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyAndStoreTheme("system", false);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [applyAndStoreTheme, enableSystem, theme]);

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      applyAndStoreTheme(nextTheme, true);
    },
    [applyAndStoreTheme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [resolvedTheme, setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme debe usarse dentro de ThemeProvider");
  }

  return context;
}
