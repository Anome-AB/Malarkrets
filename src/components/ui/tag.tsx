"use client";

import React from "react";

type TagProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
  count?: number;
};

function Tag({ label, active = false, onClick, count }: TagProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5
        px-3 py-1.5
        rounded-full
        border
        text-sm font-medium
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-[#3d6b5e] focus:ring-offset-2
        ${
          active
            ? "bg-[#3d6b5e] text-white border-[#3d6b5e]"
            : "bg-[#e8f0ec] text-[#3d6b5e] border-[#c5d9cf] hover:bg-[#d5e5dc]"
        }
      `}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`text-xs ${active ? "text-white/70" : "text-[#666666]"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export { Tag };
export type { TagProps };
