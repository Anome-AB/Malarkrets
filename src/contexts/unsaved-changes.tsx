"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Promise-resolver för väntande navigation. Sätts när user klickar på ett
 * GuardedLink medan dirty=true; resolvas när användaren svarar på dialogen.
 */
type PendingResolver = (proceed: boolean) => void;

interface UnsavedChangesValue {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  /**
   * Visar bekräftelse-dialog om dirty=true. Resolvas till true om användaren
   * accepterar att lämna, false om de stannar. Returnerar true direkt om
   * inget är dirty.
   */
  confirmLeave: () => Promise<boolean>;
}

const UnsavedChangesContext = createContext<UnsavedChangesValue | null>(null);

interface ProviderProps {
  children: ReactNode;
}

/**
 * Globalt state för "har formuläret osparade ändringar?". Mountas en gång
 * i AppShell så alla dotterelement (sidebar, topnav, bottomnav, sidor) kan
 * läsa och uppdatera värdet.
 *
 * Två primärer:
 *  - useTrackUnsavedChanges(dirty) i sidor med formulär
 *  - GuardedLink eller useUnsavedChanges().confirmLeave() i navigations-element
 *
 * beforeunload-listener registreras automatiskt så browser-stäng/refresh/
 * back-knapp triggar native varning. Det går inte att visa egen dialog där;
 * browsers visar sin egen prompt.
 */
export function UnsavedChangesProvider({ children }: ProviderProps) {
  const [isDirty, setDirty] = useState(false);
  const [pendingResolver, setPendingResolver] =
    useState<PendingResolver | null>(null);

  const confirmLeave = useCallback((): Promise<boolean> => {
    if (!isDirty) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      // Wrap i en lambda för att undvika att React tolkar resolver som
      // setState-funktion (resolver-tecknet matchar (prev) => next).
      setPendingResolver(() => resolve);
    });
  }, [isDirty]);

  // Native browser-varning vid refresh/stäng/back. Vi kan inte rendera vår
  // egen dialog där - browsern visar sin egen prompt.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers visar en generisk text oavsett returnValue, men
      // sätt något så Firefox och äldre Chrome får en hint.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  return (
    <UnsavedChangesContext.Provider
      value={{ isDirty, setDirty, confirmLeave }}
    >
      {children}
      <ConfirmDialog
        open={!!pendingResolver}
        onCancel={() => {
          if (pendingResolver) pendingResolver(false);
          setPendingResolver(null);
        }}
        onConfirm={() => {
          if (pendingResolver) pendingResolver(true);
          setPendingResolver(null);
        }}
        title="Osparade ändringar"
        message="Du har osparade ändringar. Vill du verkligen lämna sidan?"
        confirmLabel="Lämna utan att spara"
        cancelLabel="Stanna kvar"
        variant="danger"
      />
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges(): UnsavedChangesValue {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error(
      "useUnsavedChanges måste användas inuti UnsavedChangesProvider",
    );
  }
  return ctx;
}

/**
 * Rapportera dirty-state från en sida. Pageeffekten sätter värdet vid
 * mount och rensar vid unmount så provider-staten alltid speglar aktiva
 * sidan.
 */
export function useTrackUnsavedChanges(isDirty: boolean): void {
  const { setDirty } = useUnsavedChanges();
  useEffect(() => {
    setDirty(isDirty);
    return () => setDirty(false);
  }, [isDirty, setDirty]);
}
