// Bounding box for Västerås kommun. Generous margins on each side so valid
// localities near the kommun border (Irsta, Tillberga, Dingtuna, Tortuna,
// Skultuna, Kärrbo) pass cleanly while Stockholm, Köping and Enköping are
// firmly outside. Swap for a polygon check if the kommun adds new fringe
// locations that the bbox cuts off.
export const VASTERAS_BOUNDS = {
  latMin: 59.45,
  latMax: 59.78,
  lngMin: 16.20,
  lngMax: 16.82,
} as const;

export function isInVasteras(lat: number, lng: number): boolean {
  return (
    lat >= VASTERAS_BOUNDS.latMin &&
    lat <= VASTERAS_BOUNDS.latMax &&
    lng >= VASTERAS_BOUNDS.lngMin &&
    lng <= VASTERAS_BOUNDS.lngMax
  );
}
