// Slugifierar svensk-vänligt: lowercase + å/ä → a, ö → o, övriga
// non-alphanumeric → bindestreck, trim.
// Exempel: "Motion & Träning" → "motion-traning".
//
// Delas mellan klient (live-duplicate-koll på /tipsa) och server
// (approveInterestSuggestion-konflikt-detektering).
export function slugifyInterest(name: string): string {
  return name
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[éè]/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
