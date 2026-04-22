import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  displayName: z.string().max(100).optional(),
  birthDate: z.string().pipe(z.coerce.date()).optional(),
  gender: z.enum(["man", "kvinna", "ej_angett"]).optional(),
});

export const updateInterestsSchema = z.object({
  tagIds: z.array(z.number().int()).min(3, "Valj minst 3 intressen"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateInterestsInput = z.infer<typeof updateInterestsSchema>;
