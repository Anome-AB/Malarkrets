"use client";

import { useSyncExternalStore } from "react";

function storageKey(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return `site-banner-dismissed:${h}`;
}

const CHANGE_EVENT = "site-banner-dismiss-change";

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

function readDismissed(key: string) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function SiteBannerDismissible({ text }: { text: string }) {
  const key = storageKey(text);
  const dismissed = useSyncExternalStore(
    subscribe,
    () => readDismissed(key),
    () => false,
  );

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
            sessionStorage.setItem(key, "1");
          } catch {
            // sessionStorage unavailable — fall back to dispatching the event
            // so any other same-page subscribers still react.
          }
          window.dispatchEvent(new Event(CHANGE_EVENT));
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-black/70 hover:text-black text-base leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}
