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
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        ${
          active
            ? "bg-primary text-white border-primary"
            : "bg-primary-light text-primary border-primary-light hover:bg-primary-light"
        }
      `}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`text-xs ${active ? "text-white/70" : "text-secondary"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export { Tag };
export type { TagProps };
