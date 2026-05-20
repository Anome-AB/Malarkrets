import { sanitizeRichText } from "@/lib/rich-text";

interface RichTextDisplayProps {
  html: string;
  className?: string;
}

// Renderar sanitiserad rich-text-HTML. Befintliga plain-text-
// beskrivningar (utan taggar) renderas som vanlig text.
// Styling av <strong>, <em>, <ul>, <li>, <p> via .rich-text-prose i
// globals.css.
export function RichTextDisplay({ html, className }: RichTextDisplayProps) {
  const clean = sanitizeRichText(html);
  return (
    <div
      className={`rich-text-prose ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
