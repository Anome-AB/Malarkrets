import { z } from "zod";

// Reasonable reason length: 10-500 chars, Swedish text
export const reasonSchema = z
  .string()
  .min(10, "Ange en anledning (minst 10 tecken)")
  .max(500, "Max 500 tecken");

export const banReasonSchema = z
  .string()
  .min(10, "Ange en anledning för avstängning (minst 10 tecken)")
  .max(500, "Max 500 tecken");

// Diff shape stored in admin_actions.diff for activity_edited
// { title: { before: "Old", after: "New" }, ... }
const fieldDiffValue = z.object({
  before: z.unknown(),
  after: z.unknown(),
});

export const adminActionDiffSchema = z.object({
  changedFields: z.record(z.string(), fieldDiffValue),
});

export type AdminActionDiff = z.infer<typeof adminActionDiffSchema>;

// Fields that can be edited by admin. Narrower than full activity edit: admin
// should only touch content that causes the moderation issue.
export const adminEditActivitySchema = z.object({
  activityId: z.string().uuid(),
  reason: reasonSchema,
  patch: z
    .object({
      title: z.string().min(3).max(200).optional(),
      description: z.string().min(10).max(5000).optional(),
      location: z.string().min(2).max(500).optional(),
      startTime: z.string().optional(), // ISO
      endTime: z.string().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, {
      message: "Inga ändringar att spara",
    }),
});

export const adminCancelActivitySchema = z.object({
  activityId: z.string().uuid(),
  reason: reasonSchema,
});

export const adminDeleteActivitySchema = z.object({
  activityId: z.string().uuid(),
  reason: reasonSchema,
  banCreator: z.boolean().default(false),
  banReason: banReasonSchema.optional(),
}).refine(
  (d) => !d.banCreator || !!d.banReason,
  { message: "Anledning för avstängning krävs", path: ["banReason"] },
);

export type AdminEditActivityInput = z.infer<typeof adminEditActivitySchema>;
export type AdminCancelActivityInput = z.infer<typeof adminCancelActivitySchema>;
export type AdminDeleteActivityInput = z.infer<typeof adminDeleteActivitySchema>;
