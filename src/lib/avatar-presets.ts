// Förinställda profilbilder genererade av scripts/generate-preset-avatars.mjs.
// Ligger som statiska SVG i public/avatars/ och serveras direkt av Next.js.
// Listan är hardcoded så server-actions kan whitelist-validera filnamn utan
// att läsa filsystemet.

const TOTAL = 100;

export const AVATAR_PRESETS: readonly string[] = Array.from(
  { length: TOTAL },
  (_, i) => `avatar-${String(i + 1).padStart(3, "0")}.svg`,
);

export function isValidPresetFilename(filename: string): boolean {
  return AVATAR_PRESETS.includes(filename);
}

export function presetUrl(filename: string): string {
  return `/avatars/${filename}`;
}
