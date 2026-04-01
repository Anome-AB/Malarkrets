import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().max(100).optional(),
  birthDate: z.string().pipe(z.coerce.date()).optional(),
  gender: z.enum(["man", "kvinna", "ej_angett"]).optional(),
  location: z.string().max(500).optional(),
});

export const updateInterestsSchema = z.object({
  tagIds: z.array(z.number().int()).min(3, "Valj minst 3 intressen"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateInterestsInput = z.infer<typeof updateInterestsSchema>;
