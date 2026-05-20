import DOMPurify from "isomorphic-dompurify";

// Tillåtna taggar i aktivitetsbeskrivningar. Plain text utan taggar är
// också giltigt (befintliga beskrivningar har inga taggar och fungerar
// oförändrade). Emojis är unicode-tecken och behöver ingen tag.
const ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "li"];
const ALLOWED_ATTR: string[] = [];

export function sanitizeRichText(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

// Plockar ut ren text från HTML för OG-meta-tags och list-excerpts där
// taggar inte ska synas som rå text.
export function stripHtmlForExcerpt(html: string, maxLen = 160): string {
  if (!html) return "";
  const stripped = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
  const collapsed = stripped.replace(/\s+/g, " ").trim();
  return collapsed.length > maxLen
    ? collapsed.slice(0, maxLen).trim() + "…"
    : collapsed;
}

// Returnerar true om HTML:en inte innehåller någon meningsfull text.
// Använd för att avgöra om formulär-validering ska blockera tomt fält
// (TipTap producerar tex "<p></p>" för tomma editorer).
export function isRichTextEmpty(html: string): boolean {
  if (!html) return true;
  const stripped = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
  return stripped.trim().length === 0;
}
