"use client";

import { useEffect } from "react";
import { installConsoleCapture } from "@/lib/console-capture";

// Aktiveras vid första rendering av root-layouten. Override:ar console.* så
// fångar logs och fel kan plockas in i feedback_tips.console_log när en
// testare skickar ett tips. No-op om man kör server-sidan.
export function ConsoleCaptureProvider() {
  useEffect(() => {
    installConsoleCapture();
  }, []);
  return null;
}
