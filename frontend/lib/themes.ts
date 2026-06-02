export const THEME_PRESETS = [
  {
    id: "azul",
    label: "Océano",
    description: "Azul corporativo, neutro y profesional",
    preview: { light: ["#f0f4ff", "#4f7fff", "#1e293b"], dark: ["#0f1424", "#5b8fff", "#e8ecff"] },
  },
  {
    id: "violeta",
    label: "Aurora",
    description: "Violetas profundos y contraste suave",
    preview: { light: ["#f5f0ff", "#8b5cf6", "#2e1065"], dark: ["#140f24", "#a78bfa", "#ede9fe"] },
  },
  {
    id: "verde",
    label: "Bosque",
    description: "Verdes frescos, ambiente natural",
    preview: { light: ["#ecfdf5", "#10b981", "#064e3b"], dark: ["#0a1612", "#34d399", "#d1fae5"] },
  },
  {
    id: "naranja",
    label: "Atardecer",
    description: "Cálido, energético, tonos ámbar",
    preview: { light: ["#fff7ed", "#f97316", "#7c2d12"], dark: ["#1a1208", "#fb923c", "#ffedd5"] },
  },
  {
    id: "rosa",
    label: "Floral",
    description: "Rosas y malvas, moderno y vivo",
    preview: { light: ["#fdf2f8", "#ec4899", "#831843"], dark: ["#1a0a14", "#f472b6", "#fce7f3"] },
  },
  {
    id: "cyan",
    label: "Glacial",
    description: "Cian frío, estilo técnico",
    preview: { light: ["#ecfeff", "#06b6d4", "#164e63"], dark: ["#071318", "#22d3ee", "#cffafe"] },
  },
  {
    id: "rojo",
    label: "Rubí",
    description: "Rojos intensos, alto contraste",
    preview: { light: ["#fef2f2", "#ef4444", "#7f1d1d"], dark: ["#1a0808", "#f87171", "#fee2e2"] },
  },
  {
    id: "ambar",
    label: "Dorado",
    description: "Dorados y marrones cálidos",
    preview: { light: ["#fffbeb", "#f59e0b", "#78350f"], dark: ["#1a1406", "#fbbf24", "#fef3c7"] },
  },
] as const

export type ThemePreset = (typeof THEME_PRESETS)[number]["id"]
export type ColorMode = "dark" | "light"

export function isThemePreset(value: string): value is ThemePreset {
  return THEME_PRESETS.some((t) => t.id === value)
}
