import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  displayName: z.string().max(100).optional(),
  birthDate: z.string().pipe(z.coerce.date()).optional(),
  gender: z.enum(["man", "kvinna", "ej_angett"]).optional(),
});

// Inget min-krav på server. Onboarding-flödet sätter sin egen UX-grind (3 st
// för att komma vidare), men en etablerad användare ska kunna ta bort alla
// sina intressen via profilen utan att schema-valideringen säger nej.
export const updateInterestsSchema = z.object({
  tagIds: z.array(z.number().int()),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateInterestsInput = z.infer<typeof updateInterestsSchema>;
