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

// Tröskelvärde för "ganska likt": Sørensen-Dice på bigram. Empiriskt
// kalibrerat:
//   motorcykel ↔ motorcyklar → 0.71  (fångas)
//   yoga ↔ joga              → 0.67  (fångas, typos)
//   motion ↔ motioner        → 0.83  (fångas, plural)
//   yoga ↔ pilates           → 0.00  (fångas EJ, olika saker)
//   bowling ↔ curling        → 0.17  (fångas EJ, olika saker som råkar
//                                     dela ändelse)
const FUZZY_THRESHOLD = 0.65;

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    out.add(s.slice(i, i + 2));
  }
  return out;
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const aSet = bigrams(a);
  const bSet = bigrams(b);
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let intersection = 0;
  for (const g of aSet) {
    if (bSet.has(g)) intersection++;
  }
  return (2 * intersection) / (aSet.size + bSet.size);
}

export type InterestMatch =
  | { kind: "exact"; slug: string; name: string }
  | { kind: "fuzzy"; slug: string; name: string; score: number }
  | null;

// Plockar ut bästa matchning för ett föreslaget intresse mot en lista av
// befintliga taggar. Exakt slug-match vinner alltid; annars Dice-coef över
// FUZZY_THRESHOLD, det högsta poängvärdet vinner.
export function findExistingInterestMatch(
  candidateName: string,
  existing: Array<{ name: string; slug: string }>,
): InterestMatch {
  const slug = slugifyInterest(candidateName);
  if (slug.length < 2) return null;

  const exact = existing.find((t) => t.slug === slug);
  if (exact) return { kind: "exact", slug: exact.slug, name: exact.name };

  let best: { name: string; slug: string; score: number } | null = null;
  for (const tag of existing) {
    const score = diceCoefficient(slug, tag.slug);
    if (score >= FUZZY_THRESHOLD && (best === null || score > best.score)) {
      best = { name: tag.name, slug: tag.slug, score };
    }
  }
  if (best) return { kind: "fuzzy", ...best };
  return null;
}
