"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activityFeedback,
  activityParticipants,
  activities,
  analyticsEvents,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { log, errMsg } from "@/lib/logger";

export async function submitFeedback(
  activityId: string,
  rating: "positive" | "neutral" | "negative",
) {
  try {
    const user = await requireAuth();

    // Verify user was participant
    const participation = await db.query.activityParticipants.findFirst({
      where: and(
        eq(activityParticipants.activityId, activityId),
        eq(activityParticipants.userId, user.id!),
      ),
    });

    if (!participation) {
      return {
        success: false,
        error: "Du måste ha deltagit för att lämna feedback",
      };
    }

    // Verify activity startTime is in the past
    const activity = await db.query.activities.findFirst({
      where: eq(activities.id, activityId),
    });

    if (!activity) {
      return { success: false, error: "Aktiviteten hittades inte" };
    }

    if (new Date(activity.startTime) > new Date()) {
      return {
        success: false,
        error: "Du kan inte lämna feedback innan aktiviteten har börjat",
      };
    }

    // Upsert feedback
    await db
      .insert(activityFeedback)
      .values({
        activityId,
        userId: user.id!,
        rating,
      })
      .onConflictDoUpdate({
        target: [activityFeedback.activityId, activityFeedback.userId],
        set: { rating },
      });

    await db.insert(analyticsEvents).values({
      userId: user.id!,
      eventType: "feedback_submitted",
      metadata: { activityId, rating },
    });

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    log.error("submitFeedback error", { err: errMsg(error) });
    return {
      success: false,
      error: "Något gick fel vid inlämning av feedback",
    };
  }
}
