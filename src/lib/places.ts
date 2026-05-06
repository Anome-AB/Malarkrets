// Plats-helpers som delas av sök-by-address och drop-pin-paths i
// LocationPicker-komponenten. Båda flöden producerar samma form av
// LocationValue-objekt och använder samma composeAddress() / reverseGeocode().

export type LocationValue = {
  address: string;
  lat: number | null;
  lng: number | null;
};

export const EMPTY_LOCATION: LocationValue = {
  address: "",
  lat: null,
  lng: null,
};

/**
 * Bygger en lokal-fokuserad adress från ett Places-resultat. Plockar gata +
 * husnummer + locality, hoppar över postnummer och land. Faller tillbaka på
 * formatted_address om addresskomponenter saknas (vanligt för POIs som
 * "Asköviken naturreservat").
 *
 * Exempel:
 *   { name: "Stadsbiblioteket", route: "Biskopsgatan", street_number: "2", postal_town: "Västerås" }
 *   → "Stadsbiblioteket, Biskopsgatan 2, Västerås"
 */
export function composeAddress(
  place: google.maps.places.PlaceResult,
): string {
  const components = place.address_components ?? [];
  const streetNumber = components.find((c) =>
    c.types.includes("street_number"),
  )?.long_name;
  const route = components.find((c) => c.types.includes("route"))?.long_name;
  const locality =
    components.find((c) => c.types.includes("postal_town"))?.long_name ??
    components.find((c) => c.types.includes("locality"))?.long_name;

  const streetPart = [route, streetNumber].filter(Boolean).join(" ");
  const addressParts: string[] = [];
  if (place.name) addressParts.push(place.name);
  if (streetPart && streetPart !== place.name) addressParts.push(streetPart);
  if (locality && locality !== place.name) addressParts.push(locality);

  return addressParts.length > 0
    ? addressParts.join(", ")
    : (place.formatted_address ?? "");
}

/**
 * Bygger en kort plats-beskrivning från ett GeocoderResult. Används för
 * drop-pin-fallet där användaren inte har valt en specifik POI utan bara
 * släppt en pin på kartan. Plockar mest specifika tillgängliga delen
 * (gatuadress om finns, annars locality, annars sublocality).
 */
export function composeReverseAddress(
  result: google.maps.GeocoderResult,
): string {
  const components = result.address_components ?? [];
  const streetNumber = components.find((c) =>
    c.types.includes("street_number"),
  )?.long_name;
  const route = components.find((c) => c.types.includes("route"))?.long_name;
  const locality =
    components.find((c) => c.types.includes("postal_town"))?.long_name ??
    components.find((c) => c.types.includes("locality"))?.long_name ??
    components.find((c) => c.types.includes("sublocality"))?.long_name;

  const streetPart = [route, streetNumber].filter(Boolean).join(" ");
  const parts: string[] = [];
  if (streetPart) parts.push(streetPart);
  if (locality && locality !== streetPart) parts.push(locality);

  return parts.length > 0 ? parts.join(", ") : (result.formatted_address ?? "");
}

/**
 * Reverse geocode en koordinat till en mänsklig adress. Returnerar null vid
 * fel eller tom svar — anroparen får då lämna textfältet oförändrat istället
 * för att skriva över med en gissning.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    if (typeof google === "undefined" || !google.maps?.Geocoder) {
      return null;
    }
    const geocoder = new google.maps.Geocoder();
    const response = await geocoder.geocode({ location: { lat, lng } });
    const first = response.results[0];
    if (!first) return null;
    return composeReverseAddress(first);
  } catch {
    return null;
  }
}
