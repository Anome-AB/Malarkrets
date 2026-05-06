"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ShareButtonProps {
  /** Absolut eller relativ URL att dela. Relativa URL:er löses mot window.location.origin. */
  url: string;
  /** Titel som visas i Web Share-sheet på mobil. Faller tillbaka på sidans title. */
  title?: string;
  /** Beskrivning som visas i Web Share-sheet på mobil. */
  text?: string;
  /** Ren ikon utan text. Kräver att aria-label sätts via parent eller standardvärdet "Dela". */
  iconOnly?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

/**
 * Dela-knapp som först försöker Web Share API (native share-sheet på mobil
 * och Safari/desktop) och annars faller tillbaka på clipboard. På fallback
 * visas en toast som bekräftar att länken är kopierad.
 *
 * Open Graph-metadata på destinationssidan styr vilken bild/titel som syns
 * när URL:en klistras in i sociala medier - knappen själv ändrar inte vad
 * som hämtas av crawlers, bara hur användaren får ut URL:en.
 */
export function ShareButton({
  url,
  title,
  text,
  iconOnly = false,
  variant = "secondary",
  size = "compact",
  className = "",
}: ShareButtonProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  function resolveUrl(): string {
    if (typeof window === "undefined") return url;
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);

    const fullUrl = resolveUrl();
    const shareData: ShareData = {
      url: fullUrl,
      ...(title ? { title } : {}),
      ...(text ? { text } : {}),
    };

    // Web Share API: bara på en del browsers (mobil Safari/Chrome/Firefox,
    // desktop Safari). canShare-check undviker tysta fel där navigator.share
    // finns men URL/text-payloaden inte stöds.
    const canUseWebShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (typeof navigator.canShare !== "function" ||
        navigator.canShare(shareData));

    if (canUseWebShare) {
      try {
        await navigator.share(shareData);
        setBusy(false);
        return;
      } catch (err) {
        // AbortError = användaren stängde share-sheeten. Inget att rapportera.
        if (err instanceof Error && err.name === "AbortError") {
          setBusy(false);
          return;
        }
        // Annat fel: fall ner till clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(fullUrl);
      toast("Länken kopierad", "success");
    } catch {
      toast("Kunde inte kopiera länken", "error");
    } finally {
      setBusy(false);
    }
  }

  const icon = (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );

  if (iconOnly) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={busy}
        aria-label="Dela"
        className={className}
        type="button"
      >
        {icon}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={busy}
      className={className}
      type="button"
    >
      <span className="mr-2 inline-flex">{icon}</span>
      Dela
    </Button>
  );
}
