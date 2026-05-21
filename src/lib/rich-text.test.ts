import { describe, it, expect } from "vitest";
import {
  sanitizeRichText,
  stripHtmlForExcerpt,
  isRichTextEmpty,
} from "./rich-text";

describe("sanitizeRichText", () => {
  it("släpper igenom tillåtna taggar", () => {
    const html =
      "<p>Vandring <strong>i Mälaren</strong> på <em>söndag</em></p>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("släpper igenom punktlistor", () => {
    const html = "<ul><li>Vatten</li><li>Picknick</li></ul>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("strippar script-taggar", () => {
    const result = sanitizeRichText(
      "<p>Hej</p><script>alert(1)</script>",
    );
    expect(result).toBe("<p>Hej</p>");
  });

  it("strippar inline event handlers", () => {
    const result = sanitizeRichText('<p onclick="alert(1)">Hej</p>');
    expect(result).toBe("<p>Hej</p>");
  });

  it("strippar disallowed taggar men behåller text", () => {
    const result = sanitizeRichText("<h1>Stor</h1><p>liten</p>");
    expect(result).toBe("Stor<p>liten</p>");
  });

  it("hanterar emojis utan att röra dem", () => {
    const html = "<p>Yoga 🧘‍♀️ på stranden ☀️</p>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("returnerar tom sträng för falsy input", () => {
    expect(sanitizeRichText("")).toBe("");
  });
});

describe("stripHtmlForExcerpt", () => {
  it("plockar bort taggar och returnerar ren text", () => {
    expect(
      stripHtmlForExcerpt(
        "<p>Vandring <strong>med Erik</strong> på söndag</p>",
      ),
    ).toBe("Vandring med Erik på söndag");
  });

  it("kollapsar whitespace", () => {
    expect(stripHtmlForExcerpt("<p>Hej\n\n\n  världen</p>")).toBe("Hej världen");
  });

  it("trunkerar och lägger till ellips", () => {
    const long = "x".repeat(200);
    const result = stripHtmlForExcerpt(`<p>${long}</p>`, 50);
    expect(result.length).toBeLessThanOrEqual(51);
    expect(result.endsWith("…")).toBe(true);
  });

  it("trunkerar inte korta texter", () => {
    expect(stripHtmlForExcerpt("<p>Kort text</p>", 50)).toBe("Kort text");
  });
});

describe("isRichTextEmpty", () => {
  it("tomma TipTap-fragment räknas som tomma", () => {
    expect(isRichTextEmpty("")).toBe(true);
    expect(isRichTextEmpty("<p></p>")).toBe(true);
    expect(isRichTextEmpty("<p>   </p>")).toBe(true);
    expect(isRichTextEmpty("<ul><li></li></ul>")).toBe(true);
  });

  it("text räknas som icke-tom", () => {
    expect(isRichTextEmpty("<p>Hej</p>")).toBe(false);
    expect(isRichTextEmpty("Hej utan tagg")).toBe(false);
    expect(isRichTextEmpty("<ul><li>x</li></ul>")).toBe(false);
  });
});
