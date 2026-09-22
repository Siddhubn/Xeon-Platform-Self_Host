export type ThemeMode = "system" | "light" | "dark";

export type AccentColor =
  | "blue"
  | "cyan"
  | "teal"
  | "green"
  | "emerald"
  | "lime"
  | "yellow"
  | "amber"
  | "orange"
  | "red"
  | "rose"
  | "pink"
  | "fuchsia"
  | "purple"
  | "violet"
  | "indigo";

export interface ThemeSettings {
  mode: ThemeMode;
  accentColor: AccentColor;
}

export const ACCENT_COLORS: { id: AccentColor; label: string; hex: string; hexDark: string; fg: string; fgDark: string }[] = [
  { id: "blue",    label: "Blue",    hex: "#3b82f6", hexDark: "#60a5fa", fg: "#ffffff", fgDark: "#ffffff" },
  { id: "cyan",    label: "Cyan",    hex: "#06b6d4", hexDark: "#22d3ee", fg: "#ffffff", fgDark: "#ffffff" },
  { id: "teal",    label: "Teal",    hex: "#14b8a6", hexDark: "#2dd4bf", fg: "#ffffff", fgDark: "#ffffff" },
  { id: "green",   label: "Green",   hex: "#22c55e", hexDark: "#4ade80", fg: "#ffffff", fgDark: "#ffffff" },
  { id: "emerald", label: "Emerald", hex: "#10b981", hexDark: "#34d399", fg: "#ffffff", fgDark: "#ffffff" },
  { id: "lime",    label: "Lime",    hex: "#84cc16", hexDark: "#a3e635", fg: "#1a1a1a", fgDark: "#1a1a1a" },
  { id: "yellow",  label: "Yellow",  hex: "#eab308", hexDark: "#facc15", fg: "#1a1a1a", fgDark: "#1a1a1a" },
  { id: "amber",   label: "Amber",   hex: "#f59e0b", hexDark: "#fbbf24", fg: "#1a1a1a", fgDark: "#1a1a1a" },
  { id: "orange",  label: "Orange",  hex: "#f97316", hexDark: "#fb923c", fg: "#ffffff", fgDark: "#ffffff" },
  { id: "red",     label: "Red",     hex: "#ef4444", hexDark: "#f87171", fg: "#ffffff", fgDark: "#ffffff" },
  { id: "rose",    label: "Rose",    hex: "#f43f5e", hexDark: "#fb7185", fg: "#ffffff", fgDark: "#ffffff" },
  { id: "pink",    label: "Pink",    hex: "#ec4899", hexDark: "#f472b6", fg: "#ffffff", fgDark: "#ffffff" },
  { id: "fuchsia", label: "Fuchsia", hex: "#d946ef", hexDark: "#e879f9", fg: "#ffffff", fgDark: "#ffffff" },
  { id: "purple",  label: "Purple",  hex: "#a855f7", hexDark: "#c084fc", fg: "#ffffff", fgDark: "#ffffff" },
  { id: "violet",  label: "Violet",  hex: "#8b5cf6", hexDark: "#a78bfa", fg: "#ffffff", fgDark: "#ffffff" },
  { id: "indigo",  label: "Indigo",  hex: "#6366f1", hexDark: "#818cf8", fg: "#ffffff", fgDark: "#ffffff" },
];

export const DEFAULT_THEME: ThemeSettings = {
  mode: "system",
  accentColor: "blue",
};

export function isValidAccentColor(s: string): s is AccentColor {
  return ACCENT_COLORS.some((c) => c.id === s);
}
