"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";

export type SaveResult = { success: true } | { success: false; error?: string };

interface UseAutoSaveOptions<T> {
  /** Värdet som ska auto-sparas. Triggar en save när det ändras. */
  value: T;
  /** Server-action eller liknande funktion som persisterar värdet. */
  save: (value: T, signal: AbortSignal) => Promise<SaveResult>;
  /** Debounce i ms. Default 800. Höj för burst-vänliga ytor (t.ex. tag-toggles). */
  debounceMs?: number;
  /** När false skippas alla saves (t.ex. när formuläret är invalid). */
  enabled?: boolean;
  /** Toast-text vid lyckad save. Sätt till false för att tysta toasts. */
  toastOnSuccess?: string | false;
  /** Toast-text vid fel. Server-felets text överrider om den finns. */
  toastOnError?: string;
  /** Custom equality för value-jämförelse. Default JSON.stringify. */
  isEqual?: (a: T, b: T) => boolean;
}

/**
 * Auto-sparar value när det ändras. Debounce-grupperar bursts. Cancel:ar in-flight
 * via AbortController vid ny ändring eller unmount. Tystar första rendern så
 * initial value inte triggar en save.
 *
 *     useAutoSave({
 *       value: formValues,
 *       save: (v, signal) => updateProfile(v, signal),
 *     });
 */
export function useAutoSave<T>({
  value,
  save,
  debounceMs = 800,
  enabled = true,
  toastOnSuccess = "Sparat",
  toastOnError = "Kunde inte spara, försök igen",
  isEqual,
}: UseAutoSaveOptions<T>) {
  const { toast } = useToast();

  // Stabila refs för callbacks så de inte triggar omkörning av huvudeffekten.
  const saveRef = useRef(save);
  const toastRef = useRef(toast);
  const eqRef = useRef(isEqual);
  const successCopyRef = useRef(toastOnSuccess);
  const errorCopyRef = useRef(toastOnError);
  useEffect(() => {
    saveRef.current = save;
    toastRef.current = toast;
    eqRef.current = isEqual;
    successCopyRef.current = toastOnSuccess;
    errorCopyRef.current = toastOnError;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastSavedRef = useRef<T>(value);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSavedRef.current = value;
      return;
    }

    if (!enabled) return;

    const eq =
      eqRef.current ??
      ((a: T, b: T) => JSON.stringify(a) === JSON.stringify(b));
    if (eq(value, lastSavedRef.current)) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const snapshot = value;
      let result: SaveResult;
      try {
        result = await saveRef.current(snapshot, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) return;
        result = {
          success: false,
          error: err instanceof Error ? err.message : undefined,
        };
      }

      if (controller.signal.aborted) return;

      if (result.success) {
        lastSavedRef.current = snapshot;
        if (successCopyRef.current !== false) {
          toastRef.current(successCopyRef.current, "success");
        }
      } else {
        toastRef.current(result.error ?? errorCopyRef.current, "error");
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, enabled, debounceMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);
}
