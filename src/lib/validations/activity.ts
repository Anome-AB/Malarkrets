import { z } from "zod";
import { isInVasteras } from "@/lib/geo";

const baseActivitySchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  location: z.string().min(2).max(500),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  imageThumbUrl: z.string().max(1000).optional().nullable(),
  imageMediumUrl: z.string().max(1000).optional().nullable(),
  imageOgUrl: z.string().max(1000).optional().nullable(),
  imageAccentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  colorTheme: z.string().max(20).optional().nullable(),
  startTime: z.string().min(1, "Starttid krävs"),
  endTime: z.string().optional(),
  maxParticipants: z.number().int().min(2).max(500).optional(),
  genderRestriction: z.enum(["alla", "kvinnor", "man"]).default("alla"),
  minAge: z.number().int().min(0).max(120).optional(),
  tags: z.array(z.number().int()).min(1, "Valj minst en intressetagg"),
  whatToExpect: z.object({
    audience: z.enum(["alla", "par", "familj"]),
    experienceLevel: z.enum(["nyborjare", "medel", "avancerad", "alla"]),
    whoComes: z.string().max(500).optional(),
    latePolicy: z.string().max(200).optional(),
    courageMessage: z.string().max(200).optional(),
  }),
});

// Activities must sit inside Västerås kommun. We enforce this in two layers:
// the client shows an inline error when the autocomplete pick is outside,
// and the server rejects any submission without coordinates or with
// coordinates outside the bbox. Coordinates must be present (a typed-only
// location with no place pick is not enough to verify anchoring).
const vasterasLocationCheck = {
  message: "Platsen måste ligga i Västerås kommun",
  path: ["location"],
};

// Vid skapande måste startTime ligga i framtiden. Liten tolerans (60 sek)
// för klock-skew mellan klient och server samt för långsamma form-flöden
// där servern kan hinna passera valt klockslag medan användaren submit:ar.
const PAST_TIME_TOLERANCE_MS = 60 * 1000;

export const createActivitySchema = baseActivitySchema
  .refine(
    (data) => !!data.imageThumbUrl || !!data.colorTheme,
    {
      message: "Välj en bild eller en bakgrundsfärg för aktiviteten",
      path: ["colorTheme"],
    },
  )
  .refine(
    (data) =>
      typeof data.latitude === "number" &&
      typeof data.longitude === "number" &&
      isInVasteras(data.latitude, data.longitude),
    vasterasLocationCheck,
  )
  .refine(
    (data) => {
      const start = new Date(data.startTime).getTime();
      if (Number.isNaN(start)) return false;
      return start >= Date.now() - PAST_TIME_TOLERANCE_MS;
    },
    {
      message: "Aktivitetens starttid måste ligga i framtiden",
      path: ["startTime"],
    },
  );

export const updateActivitySchema = baseActivitySchema
  .partial()
  .extend({
    id: z.string().uuid(),
    // When a non-creator admin edits, an explanation is required.
    // Ignored when the creator edits their own activity.
    adminReason: z
      .string()
      .min(10, "Ange en anledning (minst 10 tecken)")
      .max(500, "Max 500 tecken")
      .optional(),
  })
  .refine(
    (data) => {
      // On update, only validate when both coordinates are explicitly provided.
      // Partial updates that don't touch location skip this check.
      if (data.latitude === undefined && data.longitude === undefined) return true;
      if (typeof data.latitude !== "number" || typeof data.longitude !== "number") return false;
      return isInVasteras(data.latitude, data.longitude);
    },
    vasterasLocationCheck,
  );

// Lös validering för utkast. Title måste finnas (annars är utkastet
// meningslöst). Allt annat är optionellt eller får default-värden i
// createActivity-actionet. Plats-i-Västerås-checken gäller fortfarande
// om koordinater anges - vi vill aldrig spara koordinater utanför kommunen.
export const draftActivitySchema = z.object({
  title: z.string().min(1, "Titel krävs (minst 1 tecken)").max(200),
  description: z.string().max(5000).optional().default(""),
  location: z.string().max(500).optional().default(""),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  imageThumbUrl: z.string().max(1000).optional().nullable(),
  imageMediumUrl: z.string().max(1000).optional().nullable(),
  imageOgUrl: z.string().max(1000).optional().nullable(),
  imageAccentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  colorTheme: z.string().max(20).optional().nullable(),
  startTime: z.string().min(1, "Starttid krävs"),
  endTime: z.string().optional(),
  maxParticipants: z.number().int().min(2).max(500).optional(),
  genderRestriction: z.enum(["alla", "kvinnor", "man"]).default("alla"),
  minAge: z.number().int().min(0).max(120).optional(),
  tags: z.array(z.number().int()).optional().default([]),
  whatToExpect: z
    .object({
      audience: z.enum(["alla", "par", "familj"]).optional().default("alla"),
      experienceLevel: z
        .enum(["nyborjare", "medel", "avancerad", "alla"])
        .optional()
        .default("alla"),
      whoComes: z.string().max(500).optional(),
      latePolicy: z.string().max(200).optional(),
      courageMessage: z.string().max(200).optional(),
    })
    .optional()
    .default({ audience: "alla", experienceLevel: "alla" }),
}).refine(
  (data) => {
    // Om koordinater anges på utkast måste de ligga i Västerås.
    if (data.latitude === undefined && data.longitude === undefined) return true;
    if (typeof data.latitude !== "number" || typeof data.longitude !== "number") return false;
    return isInVasteras(data.latitude, data.longitude);
  },
  vasterasLocationCheck,
);

export const whatToExpectSchema = baseActivitySchema.shape.whatToExpect;
export type WhatToExpect = z.infer<typeof whatToExpectSchema>;

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type DraftActivityInput = z.infer<typeof draftActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
