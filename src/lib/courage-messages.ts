/**
 * Courage messages — fetched from the database via API.
 * Hardcoded fallbacks used only if the API call fails.
 */

const FALLBACK_MESSAGES: Record<string, string[]> = {
  alla: [
    "Du behöver inte känna någon för att komma — många som dyker upp gör det för första gången.",
    "Alla är välkomna oavsett erfarenhet. Vi ses där!",
    "Kom som du är. Det spelar ingen roll om du är nybörjare eller inte känner någon.",
  ],
  par: [
    "Kom med en partner, en vän, en kollega — alla sorts par är välkomna!",
    "Perfekt att göra något nytt ihop, oavsett om ni är bästisar eller partners.",
  ],
  familj: [
    "Alla familjer är välkomna — stora som små, en förälder eller två.",
    "Kom som er familj ser ut. Det enda som krävs är att ni vill ha kul tillsammans.",
  ],
};

/** Pick a random message from a list. */
function pickRandom(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

/** Pick a random courage message from the fallback pool. */
export function randomCourageMessage(audience: string): string {
  const pool = FALLBACK_MESSAGES[audience] ?? FALLBACK_MESSAGES.alla;
  return pickRandom(pool);
}

/** Pick a random message from a fetched list, with fallback. */
export function randomFromList(messages: string[], audience: string): string {
  if (messages.length > 0) return pickRandom(messages);
  return randomCourageMessage(audience);
}
