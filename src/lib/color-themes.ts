export const COLOR_PRESETS = [
  { value: "sage", label: "Salvia", hex: "#b8cfc0" },
  { value: "peach", label: "Persika", hex: "#f5cfb5" },
  { value: "sky", label: "Himmelsblå", hex: "#bdd4e0" },
  { value: "terracotta", label: "Terrakotta", hex: "#d9a890" },
  { value: "lavender", label: "Lavendel", hex: "#d1c5de" },
  { value: "mustard", label: "Senap", hex: "#e5cf97" },
  { value: "rose", label: "Rosenträ", hex: "#e4c5cd" },
  { value: "stone", label: "Sten", hex: "#c7c9c2" },
] as const;

export type ColorThemeValue = (typeof COLOR_PRESETS)[number]["value"];

export function getColorHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const preset = COLOR_PRESETS.find((p) => p.value === value);
  return preset?.hex ?? null;
}
