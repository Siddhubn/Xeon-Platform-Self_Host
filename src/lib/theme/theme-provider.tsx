"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { ThemeMode, AccentColor, DEFAULT_THEME, ACCENT_COLORS } from "./types";
import { getStoredTheme, storeTheme } from "./storage";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  accentColor: AccentColor;
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  // system — check OS preference
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark"; // default for SSR
}

function applyAccentTokens(color: AccentColor, resolved: "light" | "dark") {
  const root = document.documentElement;
  const accent = ACCENT_COLORS.find((c) => c.id === color);
  if (!accent) return;

  root.setAttribute("data-accent", color);

  // Compute derived colors
  const base = resolved === "dark" ? accent.hexDark : accent.hex;
  const fg = resolved === "dark" ? accent.fgDark : accent.fg;

  // Parse hex to rgb for alpha calculations
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const rgb = hexToRgb(base);

  // Slightly darker/lighter for hover
  const hoverR = resolved === "dark" ? Math.min(255, rgb.r + 20) : Math.max(0, rgb.r - 15);
  const hoverG = resolved === "dark" ? Math.min(255, rgb.g + 20) : Math.max(0, rgb.g - 15);
  const hoverB = resolved === "dark" ? Math.min(255, rgb.b + 20) : Math.max(0, rgb.b - 15);
  const hover = `rgb(${hoverR}, ${hoverG}, ${hoverB})`;

  const activeR = resolved === "dark" ? Math.min(255, rgb.r + 35) : Math.max(0, rgb.r - 30);
  const activeG = resolved === "dark" ? Math.min(255, rgb.g + 35) : Math.max(0, rgb.g - 30);
  const activeB = resolved === "dark" ? Math.min(255, rgb.b + 35) : Math.max(0, rgb.b - 30);
  const active = `rgb(${activeR}, ${activeG}, ${activeB})`;

  root.style.setProperty("--accent", base);
  root.style.setProperty("--accent-hover", hover);
  root.style.setProperty("--accent-active", active);
  root.style.setProperty("--accent-foreground", fg);
  root.style.setProperty("--accent-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${resolved === "dark" ? "0.15" : "0.1"})`);
  root.style.setProperty("--accent-subtle", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${resolved === "dark" ? "0.08" : "0.05"})`);
  root.style.setProperty("--focus-ring", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
  root.style.setProperty("--selection", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);

  // Sidebar neon-green references
  root.style.setProperty("--neon-green", base);
  root.style.setProperty("--neon-green-hover", hover);
  root.style.setProperty("--neon-green-bg", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`);
  root.style.setProperty("--neon-green-border", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
}

function applyBaseTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;

  if (resolved === "dark") {
    root.style.setProperty("--background", "#0b0f1a");
    root.style.setProperty("--foreground", "#f3f4f6");
    root.style.setProperty("--bg-surface", "#111827");
    root.style.setProperty("--bg-surface-secondary", "#0b0f1a");
    root.style.setProperty("--bg-inset", "#1f2937");
    root.style.setProperty("--bg-hover", "rgba(255, 255, 255, 0.06)");
    root.style.setProperty("--bg-hover-strong", "rgba(255, 255, 255, 0.1)");
    root.style.setProperty("--text-primary", "#f9fafb");
    root.style.setProperty("--text-secondary", "#d1d5db");
    root.style.setProperty("--text-tertiary", "#9ca3af");
    root.style.setProperty("--text-inverse", "#111827");
    root.style.setProperty("--border-default", "#374151");
    root.style.setProperty("--border-hover", "#4b5563");
    root.style.setProperty("--border-strong", "#6b7280");
    root.style.setProperty("--shadow-sm", "0 1px 2px rgba(0, 0, 0, 0.2)");
    root.style.setProperty("--shadow-md", "0 4px 12px rgba(0, 0, 0, 0.3)");
    root.style.setProperty("--shadow-lg", "0 8px 30px rgba(0, 0, 0, 0.4)");
    root.style.setProperty("--scrollbar-thumb", "#4b5563");
  } else {
    root.style.setProperty("--background", "#ffffff");
    root.style.setProperty("--foreground", "#171717");
    root.style.setProperty("--bg-surface", "#ffffff");
    root.style.setProperty("--bg-surface-secondary", "#f9fafb");
    root.style.setProperty("--bg-inset", "#f3f4f6");
    root.style.setProperty("--bg-hover", "rgba(0, 0, 0, 0.04)");
    root.style.setProperty("--bg-hover-strong", "rgba(0, 0, 0, 0.06)");
    root.style.setProperty("--text-primary", "#111827");
    root.style.setProperty("--text-secondary", "#4b5563");
    root.style.setProperty("--text-tertiary", "#9ca3af");
    root.style.setProperty("--text-inverse", "#ffffff");
    root.style.setProperty("--border-default", "#e5e7eb");
    root.style.setProperty("--border-hover", "#d1d5db");
    root.style.setProperty("--border-strong", "#9ca3af");
    root.style.setProperty("--shadow-sm", "0 1px 2px rgba(0, 0, 0, 0.04)");
    root.style.setProperty("--shadow-md", "0 4px 12px rgba(0, 0, 0, 0.06)");
    root.style.setProperty("--shadow-lg", "0 8px 30px rgba(0, 0, 0, 0.08)");
    root.style.setProperty("--scrollbar-thumb", "#d1d5db");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME.mode);
  const [accentColor, setAccentColorState] = useState<AccentColor>(DEFAULT_THEME.accentColor);
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize from stored preferences
  useEffect(() => {
    const stored = getStoredTheme();
    setModeState(stored.mode);
    setAccentColorState(stored.accentColor);
    setMounted(true);
  }, []);

  // Resolve mode and apply theme
  useEffect(() => {
    if (!mounted) return;
    const resolved = resolveMode(mode);
    setResolvedMode(resolved);
    applyBaseTheme(resolved);
    applyAccentTokens(accentColor, resolved);
    storeTheme({ mode, accentColor });
  }, [mode, accentColor, mounted]);

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    if (mode !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = resolveMode("system");
      setResolvedMode(resolved);
      applyBaseTheme(resolved);
      applyAccentTokens(accentColor, resolved);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode, accentColor]);

  const applyTransition = useCallback(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("theme-transitioning");
      setTimeout(() => {
        document.documentElement.classList.remove("theme-transitioning");
      }, 200);
    }
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    applyTransition();
    setModeState(m);
  }, [applyTransition]);

  const setAccentColor = useCallback((c: AccentColor) => {
    applyTransition();
    setAccentColorState(c);
  }, [applyTransition]);

  const resetTheme = useCallback(() => {
    applyTransition();
    setModeState(DEFAULT_THEME.mode);
    setAccentColorState(DEFAULT_THEME.accentColor);
  }, [applyTransition]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, accentColor, setMode, setAccentColor, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
