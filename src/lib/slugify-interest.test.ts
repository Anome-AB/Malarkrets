import { describe, it, expect } from "vitest";
import {
  slugifyInterest,
  findExistingInterestMatch,
} from "./slugify-interest";

describe("slugifyInterest", () => {
  it("lowercase + svenska bokstäver mappas", () => {
    expect(slugifyInterest("Motion & Träning")).toBe("motion-traning");
    expect(slugifyInterest("Yoga på stranden")).toBe("yoga-pa-stranden");
    expect(slugifyInterest("Brädspel")).toBe("bradspel");
  });

  it("trimmar bindestreck i kanterna", () => {
    expect(slugifyInterest("  Hej!  ")).toBe("hej");
    expect(slugifyInterest("&&&Yoga&&&")).toBe("yoga");
  });
});

const tags = [
  { name: "Motorcykel", slug: "motorcykel" },
  { name: "Vandring", slug: "vandring" },
  { name: "Bowling", slug: "bowling" },
  { name: "Motion & Träning", slug: "motion-traning" },
  { name: "Yoga", slug: "yoga" },
];

describe("findExistingInterestMatch", () => {
  it("returnerar exact när slug matchar exakt", () => {
    const m = findExistingInterestMatch("Motorcykel", tags);
    expect(m?.kind).toBe("exact");
    expect(m?.name).toBe("Motorcykel");
  });

  it("fångar plural som fuzzy", () => {
    const m = findExistingInterestMatch("Motorcyklar", tags);
    expect(m?.kind).toBe("fuzzy");
    expect(m?.name).toBe("Motorcykel");
  });

  it("fångar typo som fuzzy", () => {
    const m = findExistingInterestMatch("Vandrign", tags);
    expect(m?.kind).toBe("fuzzy");
    expect(m?.name).toBe("Vandring");
  });

  it("ignorerar helt olika ord", () => {
    expect(findExistingInterestMatch("Schack", tags)).toBeNull();
    expect(findExistingInterestMatch("Akvarell", tags)).toBeNull();
  });

  it("ignorerar ord som råkar dela ändelse men inte är samma sak", () => {
    // Bowling vs Curling: båda slutar på 'ing' men är olika sporter.
    // Dice på bigram ska EJ matcha eftersom resten av strängen skiljer.
    expect(findExistingInterestMatch("Curling", tags)).toBeNull();
  });

  it("returnerar null för tom eller alltför kort input", () => {
    expect(findExistingInterestMatch("", tags)).toBeNull();
    expect(findExistingInterestMatch(" ", tags)).toBeNull();
    expect(findExistingInterestMatch("x", tags)).toBeNull();
  });
});
