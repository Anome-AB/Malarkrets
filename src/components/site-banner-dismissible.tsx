"use client";

import { useEffect, useState } from "react";

function storageKey(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return `site-banner-dismissed:${h}`;
}

export function SiteBannerDismissible({ text }: { text: string }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey(text)) === "1") {
        setDismissed(true);
      }
    } catch {
      // sessionStorage unavailable (private mode etc.) — show banner.
    }
  }, [text]);

  if (dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-site-banner
      className="relative bg-amber-500 text-black text-sm text-center py-2 px-10 font-medium"
    >
      {text}
      <button
        type="button"
        aria-label="Stäng banner"
        onClick={() => {
          try {
            sessionStorage.setItem(storageKey(text), "1");
          } catch {
            // ignore — still dismiss for this render
          }
          setDismissed(true);
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-black/70 hover:text-black text-base leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}
