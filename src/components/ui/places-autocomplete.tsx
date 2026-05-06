"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { isInVasteras } from "@/lib/geo";
import {
  composeAddress,
  reverseGeocode,
  type LocationValue,
} from "@/lib/places";

interface LocationPickerProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  placeholder?: string;
  error?: string;
}

const VASTERAS_CENTER = { lat: 59.6099, lng: 16.5448 };
const OUT_OF_BOUNDS_MSG = "Platsen måste ligga i Västerås kommun";

let optionsSet = false;

/**
 * Komponent som låter användaren välja plats antingen via Google Places-
 * autocomplete eller genom att klicka/dra en pin på en interaktiv karta.
 * Båda paths producerar samma LocationValue (address + lat + lng) och
 * båda gateas av isInVasteras-check.
 *
 * För platser utan adress (badplatser, stigar, naturreservat) kan användaren
 * dropp:a en pin direkt på kartan; reverse geocode föreslår en adress om
 * textfältet är tomt, men skriver aldrig över egen text.
 *
 * Vid Maps-load-fail degraderar komponenten till search-only via
 * mapLoadFailed-flaggan.
 */
export function PlacesAutocomplete({
  value,
  onChange,
  placeholder = "Sök plats eller klicka på kartan...",
  error,
}: LocationPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [outOfBoundsError, setOutOfBoundsError] = useState<string | null>(null);

  // Stabil ref till senaste value+onChange så event-listenerna kan läsa
  // current state utan att rerendra och rebinda.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  // Ladda Maps + Places-libben en gång. Sätt mapLoadFailed om SDK inte
  // går att ladda — komponenten degraderar då till search-only utan karta.
  useEffect(() => {
    if (!optionsSet) {
      setOptions({
        key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
        v: "weekly",
      });
      optionsSet = true;
    }
    Promise.all([importLibrary("places"), importLibrary("maps")])
      .then(() => setLibrariesLoaded(true))
      .catch(() => setMapLoadFailed(true));
  }, []);

  // Drop / drag pin-handler. Kollar bbox, sätter marker, och kör
  // reverse geocode om address-textfältet är tomt — skriver aldrig över
  // egen text. Lagrad i ref så att marker-listeners (som skapas inuti
  // funktionen själv) kan kalla senaste versionen utan rekursion-varning.
  const placePinRef = useRef<(lat: number, lng: number) => Promise<void>>(
    null as never,
  );

  const placePin = useCallback(
    async (lat: number, lng: number) => {
      if (!isInVasteras(lat, lng)) {
        setOutOfBoundsError(OUT_OF_BOUNDS_MSG);
        markerRef.current?.setMap(null);
        markerRef.current = null;
        onChangeRef.current({
          address: valueRef.current.address,
          lat: null,
          lng: null,
        });
        return;
      }

      setOutOfBoundsError(null);

      // Skapa eller flytta marker
      if (markerRef.current) {
        markerRef.current.setPosition({ lat, lng });
      } else if (mapRef.current) {
        markerRef.current = new google.maps.Marker({
          position: { lat, lng },
          map: mapRef.current,
          draggable: true,
          animation: google.maps.Animation.DROP,
        });
        markerRef.current.addListener("dragend", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          placePinRef.current?.(e.latLng.lat(), e.latLng.lng());
        });
      }

      // Adress: behåll om användaren typat något, fyll annars från reverse
      // geocode om vi får ett vettigt svar.
      let address = valueRef.current.address;
      if (!address.trim()) {
        const guess = await reverseGeocode(lat, lng);
        if (guess) address = guess;
      }

      onChangeRef.current({ address, lat, lng });
    },
    [],
  );

  useEffect(() => {
    placePinRef.current = placePin;
  });

  // Initiera kartan när libben är laddade och div:en finns. Sätt initial
  // pin från props om koordinater redan finns (edit-läge).
  useEffect(() => {
    if (!librariesLoaded || !mapDivRef.current || mapRef.current) return;

    const initialValue = valueRef.current;
    const hasInitialPin =
      typeof initialValue.lat === "number" &&
      typeof initialValue.lng === "number";

    const map = new google.maps.Map(mapDivRef.current, {
      center: hasInitialPin
        ? { lat: initialValue.lat!, lng: initialValue.lng! }
        : VASTERAS_CENTER,
      zoom: hasInitialPin ? 14 : 11,
      gestureHandling: "cooperative",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
    });
    mapRef.current = map;

    if (hasInitialPin) {
      const marker = new google.maps.Marker({
        position: { lat: initialValue.lat!, lng: initialValue.lng! },
        map,
        draggable: true,
      });
      marker.addListener("dragend", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        placePin(e.latLng.lat(), e.latLng.lng());
      });
      markerRef.current = marker;
    }

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      placePin(e.latLng.lat(), e.latLng.lng());
    });
  }, [librariesLoaded, placePin]);

  // Initiera autocomplete på input:en när libben är laddade.
  useEffect(() => {
    if (!librariesLoaded || !inputRef.current || autocompleteRef.current)
      return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ["address_components", "formatted_address", "geometry", "name"],
      componentRestrictions: { country: "se" },
    });

    const bounds = new google.maps.LatLngBounds(
      { lat: VASTERAS_CENTER.lat - 0.15, lng: VASTERAS_CENTER.lng - 0.3 },
      { lat: VASTERAS_CENTER.lat + 0.15, lng: VASTERAS_CENTER.lng + 0.3 },
    );
    autocomplete.setBounds(bounds);

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      if (!isInVasteras(lat, lng)) {
        setOutOfBoundsError(OUT_OF_BOUNDS_MSG);
        return;
      }

      setOutOfBoundsError(null);

      const address = composeAddress(place);
      onChangeRef.current({ address, lat, lng });

      // Synka kartan — flytta marker och centrera
      const map = mapRef.current;
      if (map) {
        map.panTo({ lat, lng });
        map.setZoom(15);
        if (markerRef.current) {
          markerRef.current.setPosition({ lat, lng });
        } else {
          const marker = new google.maps.Marker({
            position: { lat, lng },
            map,
            draggable: true,
            animation: google.maps.Animation.DROP,
          });
          marker.addListener("dragend", (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            placePin(e.latLng.lat(), e.latLng.lng());
          });
          markerRef.current = marker;
        }
      }
    });

    autocompleteRef.current = autocomplete;
  }, [librariesLoaded, placePin]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAddress = e.target.value;
      onChangeRef.current({
        ...valueRef.current,
        address: newAddress,
      });
      if (outOfBoundsError) setOutOfBoundsError(null);
    },
    [outOfBoundsError],
  );

  const visibleError = error ?? outOfBoundsError;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-heading">Plats</label>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-dimmed pointer-events-none"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={value.address}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`w-full pl-9 pr-3 py-2 min-h-touch-target rounded-control border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 transition-colors ${
            visibleError
              ? "border-error focus:border-error focus:ring-error"
              : "border-border focus:border-primary focus:ring-primary"
          }`}
        />
      </div>
      {visibleError && <p className="text-sm text-error">{visibleError}</p>}

      {!mapLoadFailed && (
        <div className="mt-2 rounded-control overflow-hidden border border-border">
          <div
            ref={mapDivRef}
            className="w-full h-72"
            aria-label="Karta för platsval. Klicka för att placera ut en markör."
            role="application"
          />
          <p className="text-xs text-dimmed bg-muted px-3 py-2 border-t border-border">
            Klicka på kartan för att placera ut en pin. Dra pinnen för att
            flytta den. Använd två fingrar för att panorera på mobil.
          </p>
        </div>
      )}

      {mapLoadFailed && (
        <p className="text-xs text-dimmed mt-1">
          Kartan kunde inte laddas. Du kan fortfarande söka efter en plats i
          fältet ovan.
        </p>
      )}
    </div>
  );
}
