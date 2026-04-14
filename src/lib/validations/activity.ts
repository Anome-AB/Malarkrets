import { z } from "zod";

export const createActivitySchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  location: z.string().min(2).max(500),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  startTime: z.string().min(1, "Starttid krävs"),
  endTime: z.string().optional(),
  maxParticipants: z.number().int().min(2).max(500).optional(),
  genderRestriction: z.enum(["alla", "kvinnor", "man"]).default("alla"),
  minAge: z.number().int().min(0).max(120).optional(),
  tags: z.array(z.number().int()).min(1, "Valj minst en intressetagg"),
  whatToExpect: z.object({
    okAlone: z.boolean(),
    experienceLevel: z.enum(["nyborjare", "medel", "avancerad", "alla"]),
    whoComes: z.string().max(500).optional(),
    latePolicy: z.string().max(200).optional(),
  }),
});

export const updateActivitySchema = createActivitySchema
  .partial()
  .extend({ id: z.string().uuid() });

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
