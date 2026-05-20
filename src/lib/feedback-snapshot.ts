// Mellanlager mellan topnav-knappen och /tipsa-formuläret.
// När användaren klickar på tips-ikonen i topnav fångar vi skärmdump +
// console-log på den sida hen står på, sedan navigerar vi till /tipsa.
// Snapshot:en hamnar i sessionStorage så formuläret kan plocka upp den
// utan SPA-context provider över hela appen.

const KEY = "malarkrets-feedback-snapshot";
const MAX_AGE_MS = 10 * 60 * 1000; // 10 min, sedan anses snapshoten stale

export interface FeedbackSnapshot {
  screenshotDataUrl?: string;
  consoleLog: string;
  pageUrl: string;
  userAgent: string;
  viewportWidth: number;
  viewportHeight: number;
  appVersion?: string;
  capturedAt: number;
}

export function saveSnapshot(snapshot: FeedbackSnapshot) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // sessionStorage kan vara full (screenshot är stor). Fall back tyst
    // utan screenshot.
    try {
      const withoutScreenshot = { ...snapshot, screenshotDataUrl: undefined };
      sessionStorage.setItem(KEY, JSON.stringify(withoutScreenshot));
    } catch {
      // Ge upp tyst, tipset funkar utan snapshot
    }
  }
}

export function loadSnapshot(): FeedbackSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedbackSnapshot;
    if (Date.now() - parsed.capturedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSnapshot() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
