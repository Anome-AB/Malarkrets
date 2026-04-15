"use client";

import { COLOR_PRESETS } from "@/lib/color-themes";

export { COLOR_PRESETS, getColorHex } from "@/lib/color-themes";
export type { ColorThemeValue } from "@/lib/color-themes";

interface ColorPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div>
      <label className="text-sm font-medium text-heading mb-2 block">
        Eller välj bakgrundsfärg
      </label>
      <div className="flex flex-wrap gap-2">
        {COLOR_PRESETS.map((color) => {
          const isActive = value === color.value;
          return (
            <button
              key={color.value}
              type="button"
              onClick={() => onChange(isActive ? null : color.value)}
              className={`w-10 h-10 rounded-full border-2 transition-all ${
                isActive
                  ? "border-heading scale-110 shadow-md"
                  : "border-border hover:scale-105"
              }`}
              style={{ backgroundColor: color.hex }}
              title={color.label}
              aria-label={color.label}
              aria-pressed={isActive}
            />
          );
        })}
      </div>
    </div>
  );
}
