import { ThemeMode, AccentColor, DEFAULT_THEME, isValidAccentColor } from "./types";

const STORAGE_KEY = "neon-theme-settings";

export function getStoredTheme(): { mode: ThemeMode; accentColor: AccentColor } {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode === "light" || parsed.mode === "dark" || parsed.mode === "system"
        ? parsed.mode
        : DEFAULT_THEME.mode,
      accentColor: isValidAccentColor(parsed.accentColor)
        ? parsed.accentColor
        : DEFAULT_THEME.accentColor,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(settings: { mode: ThemeMode; accentColor: AccentColor }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}
