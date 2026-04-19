"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activityComments,
  activityParticipants,
  activities,
} from "@/db/schema";
import { createCommentSchema } from "@/lib/validations/comment";
import { eq, and, count, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { log, errMsg } from "@/lib/logger";

export async function createComment(formData: FormData) {
  try {
    const user = await requireAuth();

    const raw = {
      activityId: formData.get("activityId"),
      content: formData.get("content"),
    };

    const parsed = createCommentSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const data = parsed.data;

    // Verify user is participant (creator is also automatically a participant)
    const participation = await db.query.activityParticipants.findFirst({
      where: and(
        eq(activityParticipants.activityId, data.activityId),
        eq(activityParticipants.userId, user.id!),
      ),
    });

    if (!participation) {
      return {
        success: false,
        error: "Du måste vara deltagare för att kommentera",
      };
    }

    // Rate limit: 20 comments per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [{ count: todayCount }] = await db
      .select({ count: count() })
      .from(activityComments)
      .where(
        and(
          eq(activityComments.userId, user.id!),
          gte(activityComments.createdAt, today),
        ),
      );

    if (todayCount >= 20) {
      return {
        success: false,
        error: "Du kan skriva max 20 kommentarer per dag",
      };
    }

    await db.insert(activityComments).values({
      activityId: data.activityId,
      userId: user.id!,
      content: data.content,
    });

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    log.error("createComment error", { err: errMsg(error) });
    const msg = error instanceof Error ? error.message : "Okänt fel";
    return { success: false, error: `Något gick fel: ${msg}` };
  }
}

export async function deleteComment(commentId: string) {
  try {
    const user = await requireAuth();

    const comment = await db.query.activityComments.findFirst({
      where: eq(activityComments.id, commentId),
    });

    if (!comment) {
      return { success: false, error: "Kommentaren hittades inte" };
    }

    // Verify user is comment author OR activity creator
    const isAuthor = comment.userId === user.id!;

    if (!isAuthor) {
      const activity = await db.query.activities.findFirst({
        where: eq(activities.id, comment.activityId),
      });

      if (!activity || activity.creatorId !== user.id!) {
        return {
          success: false,
          error: "Du kan bara ta bort dina egna kommentarer",
        };
      }
    }

    await db
      .delete(activityComments)
      .where(eq(activityComments.id, commentId));

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    log.error("deleteComment error", { err: errMsg(error) });
    return { success: false, error: "Något gick fel vid borttagning av kommentar" };
  }
}
