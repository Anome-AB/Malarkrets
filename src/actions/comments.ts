"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activityComments,
  activityParticipants,
  activities,
  users,
} from "@/db/schema";
import {
  createCommentSchema,
  editCommentSchema,
} from "@/lib/validations/comment";
import { eq, and, count, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { log, errAttrs } from "@/lib/logger";

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
    log.error("createComment error", errAttrs(error));
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
    if (comment.deletedAt) {
      return { success: false, error: "Kommentaren är redan borttagen" };
    }

    const isAuthor = comment.userId === user.id!;

    // Slå upp aktören för att veta admin-status och creator-relation.
    const actor = await db.query.users.findFirst({
      where: eq(users.id, user.id!),
    });
    const isAdmin = actor?.isAdmin ?? false;

    let isActivityCreator = false;
    if (!isAuthor) {
      const activity = await db.query.activities.findFirst({
        where: eq(activities.id, comment.activityId),
      });
      isActivityCreator = activity?.creatorId === user.id!;
    }

    if (!isAuthor && !isActivityCreator && !isAdmin) {
      return {
        success: false,
        error: "Du har inte rätt att ta bort kommentaren",
      };
    }

    // Alla borttagningar är soft-delete - tombstone lämnas så det syns att
    // en kommentar funnits på platsen. Tombstone-text differentieras via
    // vilken roll-flagga som sätts:
    //   - deletedByAdminId: admin tog bort någon annans kommentar
    //   - deletedByCreatorId: arrangör tog bort en deltagar-kommentar
    //   - (ingen flagga): författaren själv tog bort
    // Admin tar precedens om personen är både admin och arrangör.
    const moderationMarker: Partial<typeof activityComments.$inferInsert> =
      !isAuthor && isAdmin
        ? { deletedByAdminId: user.id! }
        : !isAuthor && isActivityCreator
          ? { deletedByCreatorId: user.id! }
          : {};

    await db
      .update(activityComments)
      .set({
        deletedAt: new Date(),
        ...moderationMarker,
      })
      .where(eq(activityComments.id, commentId));

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    log.error("deleteComment error", errAttrs(error));
    return { success: false, error: "Något gick fel vid borttagning av kommentar" };
  }
}

export async function editComment(commentId: string, content: string) {
  try {
    const user = await requireAuth();

    const parsed = editCommentSchema.safeParse({ commentId, content });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const comment = await db.query.activityComments.findFirst({
      where: eq(activityComments.id, commentId),
    });

    if (!comment) {
      return { success: false, error: "Kommentaren hittades inte" };
    }
    if (comment.deletedAt) {
      return { success: false, error: "Kommentaren är borttagen" };
    }
    if (comment.userId !== user.id!) {
      // Bara författaren får redigera. Arrangörer + admins har bara
      // delete-mandat, inte rewrite-mandat - då skulle de kunna sätta
      // ord i någons mun.
      return { success: false, error: "Du kan bara redigera dina egna kommentarer" };
    }

    await db
      .update(activityComments)
      .set({
        content: parsed.data.content,
        editedAt: new Date(),
      })
      .where(eq(activityComments.id, commentId));

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    log.error("editComment error", errAttrs(error));
    return { success: false, error: "Något gick fel vid redigering av kommentar" };
  }
}
