/**
 * Tar fram 1-2 initialer från ett displayName för att rendera tomma avatarer
 * när användaren saknar avatarbild. "Erik Persson" -> "EP", "Anna" -> "A".
 * Fallback: två frågetecken så vi alltid har något att rita ut.
 */
export function computeInitials(displayName: string | null | undefined): string {
  if (!displayName) return "??";
  const trimmed = displayName.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
