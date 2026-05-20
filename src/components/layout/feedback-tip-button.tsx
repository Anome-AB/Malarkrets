"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSnapshot } from "@/lib/feedback-snapshot";
import { getConsoleLogSnapshot } from "@/lib/console-capture";

// Knapp i topnav bredvid notifikationsklockan. Klick: fångar skärmdump +
// console-log på den sida testaren står på och navigerar sedan till /tipsa
// där formuläret tar över. Snapshot:en passas via sessionStorage så vi
// slipper en context provider över hela appen.

export function FeedbackTipButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function captureScreenshotDataUrl(): Promise<string | undefined> {
    try {
      // Dynamisk import håller html2canvas (~50 KB gzipped) ute ur main bundle.
      const html2canvas = (await import("html2canvas-pro")).default;
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: false,
        logging: false,
        // Begränsa till viewport, vi behöver inte hela scroll-höjden.
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
      });
      return canvas.toDataURL("image/png");
    } catch {
      // Cross-origin images (t.ex. Google Maps-tiles) kan tainta canvas. Då
      // hoppar vi över skärmdumpen tyst, tipset funkar utan den.
      return undefined;
    }
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const screenshotDataUrl = await captureScreenshotDataUrl();
      saveSnapshot({
        screenshotDataUrl,
        consoleLog: getConsoleLogSnapshot(),
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
        capturedAt: Date.now(),
      });
      router.push("/tipsa");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="relative w-11 h-11 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors disabled:opacity-60"
      aria-label="Tipsa oss"
      title="Tipsa oss om något konstigt eller en idé"
    >
      {busy ? (
        <svg
          className="animate-spin h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Glödlampa: tips/idé/bugg, neutral vid båda */}
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </svg>
      )}
    </button>
  );
}
