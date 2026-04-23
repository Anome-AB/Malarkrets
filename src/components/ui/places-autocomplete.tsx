"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { isInVasteras } from "@/lib/geo";

interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
}

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: PlaceResult) => void;
  placeholder?: string;
  error?: string;
}

const VASTERAS_CENTER = { lat: 59.6099, lng: 16.5448 };

let optionsSet = false;

export function PlacesAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Sök plats...",
  error,
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [outOfBoundsError, setOutOfBoundsError] = useState<string | null>(null);

  useEffect(() => {
    if (!optionsSet) {
      setOptions({
        key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
        v: "weekly",
      });
      optionsSet = true;
    }
    importLibrary("places").then(() => {
      setMapLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!mapLoaded || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ["address_components", "formatted_address", "geometry", "name"],
      componentRestrictions: { country: "se" },
    });

    // Bias towards Västerås
    const bounds = new google.maps.LatLngBounds(
      { lat: VASTERAS_CENTER.lat - 0.15, lng: VASTERAS_CENTER.lng - 0.3 },
      { lat: VASTERAS_CENTER.lat + 0.15, lng: VASTERAS_CENTER.lng + 0.3 },
    );
    autocomplete.setBounds(bounds);

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        // Reject picks outside Västerås kommun before showing them as selected.
        // Clears any prior valid pick so the form can't submit with stale
        // Västerås coordinates under a non-Västerås address string.
        if (!isInVasteras(lat, lng)) {
          setOutOfBoundsError("Platsen måste ligga i Västerås kommun");
          setSelectedPlace(null);
          return;
        }

        // Build a local-focused address: street + city, skip postal code + country
        const components = place.address_components ?? [];
        const streetNumber = components.find((c) => c.types.includes("street_number"))?.long_name;
        const route = components.find((c) => c.types.includes("route"))?.long_name;
        const locality =
          components.find((c) => c.types.includes("postal_town"))?.long_name ??
          components.find((c) => c.types.includes("locality"))?.long_name;

        const streetPart = [route, streetNumber].filter(Boolean).join(" ");
        const addressParts: string[] = [];
        if (place.name) addressParts.push(place.name);
        if (streetPart && streetPart !== place.name) addressParts.push(streetPart);
        if (locality && locality !== place.name) addressParts.push(locality);

        const address = addressParts.length > 0
          ? addressParts.join(", ")
          : place.formatted_address ?? "";

        const result: PlaceResult = {
          address,
          lat,
          lng,
        };
        setOutOfBoundsError(null);
        setSelectedPlace(result);
        onChange(result.address);
        onPlaceSelect?.(result);
      }
    });

    autocompleteRef.current = autocomplete;
  }, [mapLoaded, onChange, onPlaceSelect]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      if (selectedPlace && e.target.value !== selectedPlace.address) {
        setSelectedPlace(null);
      }
      if (outOfBoundsError) setOutOfBoundsError(null);
    },
    [onChange, selectedPlace, outOfBoundsError],
  );

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
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`w-full pl-9 pr-3 py-2 min-h-touch-target rounded-control border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 transition-colors ${
            error || outOfBoundsError
              ? "border-error focus:border-error focus:ring-error"
              : "border-border focus:border-primary focus:ring-primary"
          }`}
        />
      </div>
      {(error || outOfBoundsError) && (
        <p className="text-sm text-error">{error ?? outOfBoundsError}</p>
      )}

      {selectedPlace && (
        <div className="mt-2 rounded-control overflow-hidden border border-border">
          <img
            src={`https://maps.googleapis.com/maps/api/staticmap?center=${selectedPlace.lat},${selectedPlace.lng}&zoom=15&size=600x200&scale=2&markers=color:0x3d6b5e%7C${selectedPlace.lat},${selectedPlace.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
            alt={`Karta: ${selectedPlace.address}`}
            className="w-full h-static-map object-cover"
          />
        </div>
      )}
    </div>
  );
}
