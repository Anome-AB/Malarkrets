"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  userBlocks,
  activityParticipants,
  activities,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { log, errMsg } from "@/lib/logger";

export async function blockUser(blockedId: string) {
  try {
    const user = await requireAuth();

    if (user.id === blockedId) {
      return { success: false, error: "Du kan inte blockera dig själv" };
    }

    await db
      .insert(userBlocks)
      .values({
        blockerId: user.id!,
        blockedId,
      })
      .onConflictDoNothing();

    // Check if user is participating in any of blocked user's activities
    const blockedUserActivities = await db
      .select({
        activityId: activities.id,
        activityTitle: activities.title,
      })
      .from(activityParticipants)
      .innerJoin(
        activities,
        eq(activities.id, activityParticipants.activityId),
      )
      .where(
        and(
          eq(activityParticipants.userId, user.id!),
          eq(activities.creatorId, blockedId),
        ),
      );

    // Also check if blocked user is in any of current user's activities
    const myActivitiesWithBlocked = await db
      .select({
        activityId: activities.id,
        activityTitle: activities.title,
      })
      .from(activityParticipants)
      .innerJoin(
        activities,
        eq(activities.id, activityParticipants.activityId),
      )
      .where(
        and(
          eq(activityParticipants.userId, blockedId),
          eq(activities.creatorId, user.id!),
        ),
      );

    const affectedActivities = [
      ...blockedUserActivities,
      ...myActivitiesWithBlocked,
    ];

    revalidatePath("/");

    return {
      success: true,
      affectedActivities:
        affectedActivities.length > 0 ? affectedActivities : undefined,
    };
  } catch (error) {
    log.error("blockUser error", { err: errMsg(error) });
    return { success: false, error: "Något gick fel vid blockering" };
  }
}

export async function unblockUser(blockedId: string) {
  try {
    const user = await requireAuth();

    await db
      .delete(userBlocks)
      .where(
        and(
          eq(userBlocks.blockerId, user.id!),
          eq(userBlocks.blockedId, blockedId),
        ),
      );

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    log.error("unblockUser error", { err: errMsg(error) });
    return { success: false, error: "Något gick fel vid avblockering" };
  }
}
