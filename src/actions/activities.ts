"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activities,
  activityTags,
  activityParticipants,
  activityComments,
  activityFeedback,
  notifications,
  analyticsEvents,
  interestTags,
  users,
  userBlocks,
} from "@/db/schema";
import {
  createActivitySchema,
  updateActivitySchema,
} from "@/lib/validations/activity";
import { eq, and, count, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createActivity(formData: FormData) {
  try {
    const user = await requireAuth();

    // Rate limit: 5 activities per day
    const todayStr = new Date().toISOString().slice(0, 10); // "2026-03-31"
    const [{ count: todayCount }] = await db
      .select({ count: count() })
      .from(activities)
      .where(
        and(
          eq(activities.creatorId, user.id!),
          sql`${activities.createdAt}::date >= ${todayStr}`,
        ),
      );

    if (todayCount >= 5) {
      return {
        success: false,
        error: "Du kan skapa max 5 aktiviteter per dag",
      };
    }

    const raw = {
      title: formData.get("title"),
      description: formData.get("description"),
      location: formData.get("location"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime") || undefined,
      maxParticipants: formData.get("maxParticipants")
        ? Number(formData.get("maxParticipants"))
        : undefined,
      genderRestriction: formData.get("genderRestriction") || "alla",
      minAge: formData.get("minAge")
        ? Number(formData.get("minAge"))
        : undefined,
      tags: JSON.parse((formData.get("tags") as string) || "[]"),
      whatToExpect: JSON.parse(
        (formData.get("whatToExpect") as string) || "{}",
      ),
    };

    const parsed = createActivitySchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const data = parsed.data;

    // Fetch creator profile for restriction checks
    const creator = await db.query.users.findFirst({
      where: eq(users.id, user.id!),
    });

    if (!creator) {
      return { success: false, error: "Användaren hittades inte" };
    }

    // Gender restriction rules
    if (creator.gender === "man" && !["alla", "man"].includes(data.genderRestriction)) {
      return {
        success: false,
        error: "Du kan bara skapa aktiviteter för alla eller män",
      };
    }
    if (creator.gender === "kvinna" && !["alla", "kvinnor"].includes(data.genderRestriction)) {
      return {
        success: false,
        error: "Du kan bara skapa aktiviteter för alla eller kvinnor",
      };
    }
    if (creator.gender === "ej_angett" && data.genderRestriction !== "alla") {
      return {
        success: false,
        error: "Du måste ange kön för att skapa könsbegränsade aktiviteter",
      };
    }

    // Age restriction rules
    if (data.minAge !== undefined) {
      if (!creator.birthDate) {
        return {
          success: false,
          error: "Du måste ange födelsedatum för att sätta åldersgräns",
        };
      }
      const creatorAge = Math.floor(
        (Date.now() - new Date(creator.birthDate).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      );
      if (data.minAge > creatorAge) {
        return {
          success: false,
          error: "Minimiåldern kan inte vara högre än din egen ålder",
        };
      }
    }

    const { tags, whatToExpect, startTime, endTime, genderRestriction, ...rest } = data;

    const [newActivity] = await db
      .insert(activities)
      .values({
        title: rest.title,
        description: rest.description,
        location: rest.location,
        maxParticipants: rest.maxParticipants,
        minAge: rest.minAge,
        creatorId: user.id!,
        whatToExpect,
        genderRestriction: genderRestriction as "alla" | "kvinnor" | "man",
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
      })
      .returning({ id: activities.id });

    if (tags.length > 0) {
      await db.insert(activityTags).values(
        tags.map((tagId) => ({
          activityId: newActivity.id,
          tagId,
        })),
      );
    }

    await db.insert(analyticsEvents).values({
      userId: user.id!,
      eventType: "activity_created",
      metadata: { activityId: newActivity.id },
    });

    revalidatePath("/");

    return { success: true, activityId: newActivity.id };
  } catch (error) {
    console.error("createActivity error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Fel: ${msg}` };
  }
}

export async function updateActivity(formData: FormData) {
  try {
    const user = await requireAuth();

    const raw = {
      id: formData.get("id"),
      title: formData.get("title") || undefined,
      description: formData.get("description") || undefined,
      location: formData.get("location") || undefined,
      startTime: formData.get("startTime") || undefined,
      endTime: formData.get("endTime") || undefined,
      maxParticipants: formData.get("maxParticipants")
        ? Number(formData.get("maxParticipants"))
        : undefined,
      genderRestriction: formData.get("genderRestriction") || undefined,
      minAge: formData.get("minAge")
        ? Number(formData.get("minAge"))
        : undefined,
      tags: formData.get("tags")
        ? JSON.parse(formData.get("tags") as string)
        : undefined,
      whatToExpect: formData.get("whatToExpect")
        ? JSON.parse(formData.get("whatToExpect") as string)
        : undefined,
    };

    const parsed = updateActivitySchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const data = parsed.data;

    // Verify creator
    const activity = await db.query.activities.findFirst({
      where: eq(activities.id, data.id),
    });

    if (!activity || activity.creatorId !== user.id!) {
      return { success: false, error: "Du kan bara redigera dina egna aktiviteter" };
    }

    const creator = await db.query.users.findFirst({
      where: eq(users.id, user.id!),
    });

    if (!creator) {
      return { success: false, error: "Användaren hittades inte" };
    }

    // Gender restriction rules
    if (data.genderRestriction) {
      if (creator.gender === "man" && !["alla", "man"].includes(data.genderRestriction)) {
        return {
          success: false,
          error: "Du kan bara skapa aktiviteter för alla eller män",
        };
      }
      if (creator.gender === "kvinna" && !["alla", "kvinnor"].includes(data.genderRestriction)) {
        return {
          success: false,
          error: "Du kan bara skapa aktiviteter för alla eller kvinnor",
        };
      }
      if (creator.gender === "ej_angett" && data.genderRestriction !== "alla") {
        return {
          success: false,
          error: "Du måste ange kön för att skapa könsbegränsade aktiviteter",
        };
      }
    }

    // Age restriction rules
    if (data.minAge !== undefined) {
      if (!creator.birthDate) {
        return {
          success: false,
          error: "Du måste ange födelsedatum för att sätta åldersgräns",
        };
      }
      const creatorAge = Math.floor(
        (Date.now() - new Date(creator.birthDate).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      );
      if (data.minAge > creatorAge) {
        return {
          success: false,
          error: "Minimiåldern kan inte vara högre än din egen ålder",
        };
      }
    }

    const { id, tags, whatToExpect, startTime, endTime, ...updateData } = data;

    await db
      .update(activities)
      .set({
        ...updateData,
        ...(whatToExpect !== undefined && { whatToExpect }),
        ...(startTime !== undefined && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: new Date(endTime) }),
        updatedAt: new Date(),
      })
      .where(eq(activities.id, id));

    if (tags !== undefined) {
      await db.delete(activityTags).where(eq(activityTags.activityId, id));
      if (tags.length > 0) {
        await db.insert(activityTags).values(
          tags.map((tagId) => ({
            activityId: id,
            tagId,
          })),
        );
      }
    }

    // Notify all participants
    const participants = await db
      .select({ userId: activityParticipants.userId })
      .from(activityParticipants)
      .where(eq(activityParticipants.activityId, id));

    if (participants.length > 0) {
      await db.insert(notifications).values(
        participants.map((p) => ({
          userId: p.userId,
          type: "activity_updated" as const,
          activityId: id,
        })),
      );
    }

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("updateActivity error:", error);
    return { success: false, error: "Något gick fel vid uppdatering av aktivitet" };
  }
}

export async function deleteActivity(activityId: string) {
  try {
    const user = await requireAuth();

    const activity = await db.query.activities.findFirst({
      where: eq(activities.id, activityId),
    });

    if (!activity || activity.creatorId !== user.id!) {
      return { success: false, error: "Du kan bara ta bort dina egna aktiviteter" };
    }

    // Notify participants before deletion
    const participants = await db
      .select({ userId: activityParticipants.userId })
      .from(activityParticipants)
      .where(eq(activityParticipants.activityId, activityId));

    if (participants.length > 0) {
      await db.insert(notifications).values(
        participants.map((p) => ({
          userId: p.userId,
          type: "activity_deleted" as const,
          activityId: null,
          params: { activityTitle: activity.title },
        })),
      );
    }

    await db.delete(activities).where(eq(activities.id, activityId));

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("deleteActivity error:", error);
    return { success: false, error: "Något gick fel vid borttagning av aktivitet" };
  }
}

export async function cancelOrDeleteActivity(
  activityId: string,
  reason?: string,
) {
  try {
    const user = await requireAuth();

    const activity = await db.query.activities.findFirst({
      where: eq(activities.id, activityId),
    });

    if (!activity || activity.creatorId !== user.id!) {
      return {
        success: false,
        error: "Du kan bara ställa in dina egna aktiviteter",
      };
    }

    // Count participants (excluding creator)
    const participantRows = await db
      .select({ userId: activityParticipants.userId })
      .from(activityParticipants)
      .where(eq(activityParticipants.activityId, activityId));

    const participants = participantRows.filter(
      (p) => p.userId !== user.id!,
    );

    if (participants.length === 0) {
      // No participants: delete completely
      await db.delete(activities).where(eq(activities.id, activityId));

      revalidatePath("/");
      return { success: true, deleted: true };
    }

    // Has participants: require reason
    if (!reason || reason.trim().length === 0) {
      return {
        success: false,
        error: "Du måste ange en anledning när det finns anmälda deltagare",
      };
    }

    // Mark as cancelled
    await db
      .update(activities)
      .set({
        cancelledAt: new Date(),
        cancelledReason: reason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(activities.id, activityId));

    // Notify ALL participants (including creator-participants)
    if (participantRows.length > 0) {
      await db.insert(notifications).values(
        participantRows.map((p) => ({
          userId: p.userId,
          type: "activity_cancelled" as const,
          activityId,
          params: {
            activityTitle: activity.title,
            reason: reason.trim(),
          },
        })),
      );
    }

    revalidatePath("/");
    return { success: true, cancelled: true };
  } catch (error) {
    console.error("cancelOrDeleteActivity error:", error);
    return { success: false, error: "Något gick fel" };
  }
}

export async function joinActivity(
  activityId: string,
  status: "interested" | "attending",
) {
  try {
    const user = await requireAuth();

    const activity = await db.query.activities.findFirst({
      where: eq(activities.id, activityId),
    });

    if (!activity) {
      return { success: false, error: "Aktiviteten hittades inte" };
    }

    if (activity.cancelledAt) {
      return { success: false, error: "Aktiviteten är inställd" };
    }

    const joiner = await db.query.users.findFirst({
      where: eq(users.id, user.id!),
    });

    if (!joiner) {
      return { success: false, error: "Användaren hittades inte" };
    }

    // Gender eligibility
    if (activity.genderRestriction === "kvinnor" && joiner.gender !== "kvinna") {
      return { success: false, error: "Denna aktivitet är bara för kvinnor" };
    }
    if (activity.genderRestriction === "man" && joiner.gender !== "man") {
      return { success: false, error: "Denna aktivitet är bara för män" };
    }

    // Age eligibility
    if (activity.minAge !== null) {
      if (!joiner.birthDate) {
        return {
          success: false,
          error: "Du måste ange födelsedatum för att gå med i denna aktivitet",
        };
      }
      const joinerAge = Math.floor(
        (Date.now() - new Date(joiner.birthDate).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      );
      if (joinerAge < activity.minAge) {
        return {
          success: false,
          error: `Du måste vara minst ${activity.minAge} år för att gå med`,
        };
      }
    }

    // Check max participants
    if (activity.maxParticipants !== null && status === "attending") {
      const [{ currentCount }] = await db
        .select({ currentCount: count() })
        .from(activityParticipants)
        .where(
          and(
            eq(activityParticipants.activityId, activityId),
            eq(activityParticipants.status, "attending"),
          ),
        );

      if (currentCount >= activity.maxParticipants) {
        return { success: false, error: "Aktiviteten är full" };
      }
    }

    await db
      .insert(activityParticipants)
      .values({
        activityId,
        userId: user.id!,
        status,
      })
      .onConflictDoUpdate({
        target: [activityParticipants.activityId, activityParticipants.userId],
        set: { status },
      });

    // Check for blocked users among participants
    let blockedWarning: string | undefined;
    const blockedByMe = await db
      .select({ blockedId: userBlocks.blockedId })
      .from(userBlocks)
      .where(eq(userBlocks.blockerId, user.id!));

    if (blockedByMe.length > 0) {
      const blockedIds = blockedByMe.map((b) => b.blockedId);
      const blockedParticipants = await db
        .select({
          userId: activityParticipants.userId,
          displayName: users.displayName,
        })
        .from(activityParticipants)
        .innerJoin(users, eq(users.id, activityParticipants.userId))
        .where(
          and(
            eq(activityParticipants.activityId, activityId),
            inArray(activityParticipants.userId, blockedIds),
          ),
        );

      if (blockedParticipants.length > 0) {
        const names = blockedParticipants
          .map((p) => p.displayName || "Anonym")
          .join(", ");
        blockedWarning = `Blockerade användare deltar redan: ${names}`;
      }
    }

    // Notify creator
    if (activity.creatorId && activity.creatorId !== user.id!) {
      await db.insert(notifications).values({
        userId: activity.creatorId,
        type: "participant_joined",
        activityId,
        params: { participantName: joiner.displayName || "Anonym" },
      });
    }

    await db.insert(analyticsEvents).values({
      userId: user.id!,
      eventType: "activity_joined",
      metadata: { activityId, status },
    });

    revalidatePath("/");

    return { success: true, blockedWarning };
  } catch (error) {
    console.error("joinActivity error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Fel: ${msg}` };
  }
}

export async function leaveActivity(activityId: string) {
  try {
    const user = await requireAuth();

    const activity = await db.query.activities.findFirst({
      where: eq(activities.id, activityId),
    });

    await db
      .delete(activityParticipants)
      .where(
        and(
          eq(activityParticipants.activityId, activityId),
          eq(activityParticipants.userId, user.id!),
        ),
      );

    // Notify creator
    if (activity?.creatorId && activity.creatorId !== user.id!) {
      const leaver = await db.query.users.findFirst({
        where: eq(users.id, user.id!),
      });

      await db.insert(notifications).values({
        userId: activity.creatorId,
        type: "participant_left",
        activityId,
        params: { participantName: leaver?.displayName || "Anonym" },
      });
    }

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("leaveActivity error:", error);
    return { success: false, error: "Något gick fel vid avregistrering" };
  }
}

export async function getActivityDetail(activityId: string) {
  const user = await requireAuth();

  const activity = await db.query.activities.findFirst({
    where: eq(activities.id, activityId),
  });

  if (!activity) return null;

  const creator = activity.creatorId
    ? await db.query.users.findFirst({
        where: eq(users.id, activity.creatorId),
      })
    : null;

  const tags = await db
    .select({ id: interestTags.id, name: interestTags.name, slug: interestTags.slug })
    .from(activityTags)
    .innerJoin(interestTags, eq(interestTags.id, activityTags.tagId))
    .where(eq(activityTags.activityId, activityId));

  const [{ count: participantCount }] = await db
    .select({ count: count() })
    .from(activityParticipants)
    .where(eq(activityParticipants.activityId, activityId));

  const comments = await db
    .select({
      id: activityComments.id,
      userId: activityComments.userId,
      authorName: users.displayName,
      content: activityComments.content,
      createdAt: activityComments.createdAt,
    })
    .from(activityComments)
    .leftJoin(users, eq(users.id, activityComments.userId))
    .where(eq(activityComments.activityId, activityId))
    .orderBy(activityComments.createdAt);

  const feedbackRows = await db
    .select({ rating: activityFeedback.rating, count: count() })
    .from(activityFeedback)
    .where(eq(activityFeedback.activityId, activityId))
    .groupBy(activityFeedback.rating);

  let feedbackTotal = 0;
  let feedbackPositive = 0;
  for (const row of feedbackRows) {
    feedbackTotal += row.count;
    if (row.rating === "positive") feedbackPositive = row.count;
  }

  const participation = await db.query.activityParticipants.findFirst({
    where: and(
      eq(activityParticipants.activityId, activityId),
      eq(activityParticipants.userId, user.id!),
    ),
  });

  const wte = activity.whatToExpect as Record<string, unknown> | null;

  return {
    id: activity.id,
    title: activity.title,
    description: activity.description,
    location: activity.location,
    startTime: activity.startTime,
    endTime: activity.endTime,
    maxParticipants: activity.maxParticipants,
    cancelledAt: activity.cancelledAt,
    imageMediumUrl: activity.imageMediumUrl,
    whatToExpect: wte,
    creatorId: activity.creatorId,
    creatorName: creator?.displayName ?? "Anonym",
    tags,
    participantCount,
    comments: comments.map((c) => ({
      id: c.id,
      userId: c.userId,
      authorName: c.authorName ?? "Anonym",
      content: c.content,
      createdAt: c.createdAt!,
    })),
    feedbackTotal,
    feedbackPositive,
    isParticipant: !!participation,
    isCreator: activity.creatorId === user.id,
    currentUserId: user.id!,
  };
}
