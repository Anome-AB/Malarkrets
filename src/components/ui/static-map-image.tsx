"use client";

import { useState } from "react";

// Google Static Maps tar bara rå hex i markers-parametern, inte var(), så
// värdet är duplicerat från --color-primary i globals.css med flit.
const MARKER_COLOR = "0x3d6b5e";

interface StaticMapImageProps {
  lat: number;
  lng: number;
  /** Platsnamn, används i bildens alt-text. */
  location: string;
  /** Bildstorlek i Google-API:ets pixlar, före scale=2. */
  size: string;
  /** Klasser för bildytan. Fallbacken får samma klasser så ytan behålls. */
  className?: string;
}

/**
 * Statisk kartbild från Google Maps Static API, med fallback när bilden inte
 * går att hämta. Maps svarar 403 på hela nyckeln om faktureringen är avstängd
 * eller referrern inte står i allowlistan, och utan onError får användaren då
 * bara en trasig bild-ikon. Fallbacken fyller samma yta som bilden så att
 * länken runt om fortsätter se klickbar ut - den går till google.com/maps och
 * rör inget API, så den fungerar även när kartbilden inte gör det.
 */
export function StaticMapImage({
  lat,
  lng,
  location,
  size,
  className = "",
}: StaticMapImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={className}
        role="img"
        aria-label={`Kartbild saknas för ${location}`}
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-secondary">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="text-xs px-2 text-center">Kartbild saknas</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={`https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=${size}&scale=2&markers=color:${MARKER_COLOR}%7C${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
      alt={`Karta: ${location}`}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
