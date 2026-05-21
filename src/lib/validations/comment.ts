import { z } from "zod";

export const createCommentSchema = z.object({
  activityId: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

export const editCommentSchema = z.object({
  commentId: z.string().uuid(),
  content: z.string().min(1, "Kommentaren kan inte vara tom").max(2000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type EditCommentInput = z.infer<typeof editCommentSchema>;
