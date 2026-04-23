import { describe, it, expect } from "vitest";
import {
  toDateInput,
  toTimeInput,
  combineDateTime,
  combineEndDateTime,
} from "@/lib/datetime";

describe("toDateInput", () => {
  it("formats a Date to YYYY-MM-DD in local time", () => {
    const d = new Date(2026, 3, 25, 18, 30); // April 25
    expect(toDateInput(d)).toBe("2026-04-25");
  });

  it("parses ISO strings", () => {
    expect(toDateInput("2026-04-25T18:30:00")).toBe("2026-04-25");
  });

  it("returns empty string for null/undefined/invalid", () => {
    expect(toDateInput(null)).toBe("");
    expect(toDateInput(undefined)).toBe("");
    expect(toDateInput("not-a-date")).toBe("");
  });

  it("pads single-digit months and days", () => {
    const d = new Date(2026, 0, 5);
    expect(toDateInput(d)).toBe("2026-01-05");
  });
});

describe("toTimeInput", () => {
  it("formats a Date to HH:MM in local time", () => {
    const d = new Date(2026, 3, 25, 18, 30);
    expect(toTimeInput(d)).toBe("18:30");
  });

  it("pads single-digit hours and minutes", () => {
    const d = new Date(2026, 3, 25, 6, 5);
    expect(toTimeInput(d)).toBe("06:05");
  });

  it("returns empty string for null/invalid", () => {
    expect(toTimeInput(null)).toBe("");
    expect(toTimeInput("not-a-date")).toBe("");
  });
});

describe("combineDateTime", () => {
  it("combines date and time into datetime-local format", () => {
    expect(combineDateTime("2026-04-25", "18:30")).toBe("2026-04-25T18:30");
  });

  it("returns null when either input is empty", () => {
    expect(combineDateTime("", "18:30")).toBeNull();
    expect(combineDateTime("2026-04-25", "")).toBeNull();
  });

  it("rejects malformed inputs", () => {
    expect(combineDateTime("2026/04/25", "18:30")).toBeNull();
    expect(combineDateTime("2026-04-25", "18.30")).toBeNull();
  });
});

describe("combineEndDateTime", () => {
  it("returns null when endTimeOfDay is empty", () => {
    expect(combineEndDateTime("2026-04-25", "18:00", "")).toBeNull();
  });

  it("keeps same date when end is after start on same day", () => {
    expect(combineEndDateTime("2026-04-25", "18:00", "20:00")).toBe(
      "2026-04-25T20:00",
    );
  });

  it("keeps same date when end equals start (zero-length is user error, not our problem)", () => {
    expect(combineEndDateTime("2026-04-25", "18:00", "18:00")).toBe(
      "2026-04-25T18:00",
    );
  });

  it("rolls over to next day when end < start (overnight activity)", () => {
    expect(combineEndDateTime("2026-04-25", "22:00", "01:00")).toBe(
      "2026-04-26T01:00",
    );
  });

  it("handles end-of-month rollover", () => {
    expect(combineEndDateTime("2026-04-30", "23:00", "02:00")).toBe(
      "2026-05-01T02:00",
    );
  });

  it("handles year rollover", () => {
    expect(combineEndDateTime("2026-12-31", "22:00", "01:00")).toBe(
      "2027-01-01T01:00",
    );
  });

  it("returns null for invalid date", () => {
    expect(combineEndDateTime("invalid", "22:00", "01:00")).toBeNull();
  });
});
