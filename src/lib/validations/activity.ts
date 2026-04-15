import { z } from "zod";

const baseActivitySchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  location: z.string().min(2).max(500),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  imageThumbUrl: z.string().max(1000).optional().nullable(),
  imageMediumUrl: z.string().max(1000).optional().nullable(),
  imageOgUrl: z.string().max(1000).optional().nullable(),
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
  }),
});

export const createActivitySchema = baseActivitySchema.refine(
  (data) => !!data.imageThumbUrl || !!data.colorTheme,
  {
    message: "Välj en bild eller en bakgrundsfärg för aktiviteten",
    path: ["colorTheme"],
  },
);

export const updateActivitySchema = baseActivitySchema
  .partial()
  .extend({ id: z.string().uuid() });

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
