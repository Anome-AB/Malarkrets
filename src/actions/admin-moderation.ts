"use server";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activities,
  activityParticipants,
  adminActions,
  notifications,
  users,
  reports,
} from "@/db/schema";
import {
  adminEditActivitySchema,
  adminCancelActivitySchema,
  adminDeleteActivitySchema,
  type AdminActionDiff,
} from "@/lib/validations/admin-actions";
import { eq, and, gt, count, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const RATE_LIMIT_PER_HOUR = 20;

async function checkRateLimit(adminId: string) {
  const [{ count: recent }] = await db
    .select({ count: count() })
    .from(adminActions)
    .where(
      and(
        eq(adminActions.adminId, adminId),
        gt(adminActions.createdAt, sql`now() - interval '1 hour'`),
      ),
    );

  if (recent >= RATE_LIMIT_PER_HOUR) {
    throw new Error(
      `Tak på ${RATE_LIMIT_PER_HOUR} admin-handlingar per timme nått. Ta en paus.`,
    );
  }
}

function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AdminActionDiff {
  const changedFields: AdminActionDiff["changedFields"] = {};
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      changedFields[key] = { before: before[key], after: after[key] };
    }
  }
  return { changedFields };
}

const FIELD_LABELS_SV: Record<string, string> = {
  title: "Titel",
  description: "Beskrivning",
  location: "Plats",
  startTime: "Starttid",
  endTime: "Sluttid",
};

function formatChangedFieldsSv(diff: AdminActionDiff): string {
  return Object.keys(diff.changedFields)
    .map((f) => FIELD_LABELS_SV[f] ?? f)
    .join(", ");
}

// ─── Edit ────────────────────────────────────────────────────────────────────

export async function adminEditActivity(input: unknown, sourceReportId?: string) {
  const parsed = adminEditActivitySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  const { activityId, reason, patch } = parsed.data;

  try {
    const { user: admin } = await requireAdmin();
    await checkRateLimit(admin.id);

    const activity = await db.query.activities.findFirst({
      where: eq(activities.id, activityId),
    });
    if (!activity) {
      return { success: false as const, error: "Aktivitet hittades inte" };
    }
    if (activity.creatorId === admin.id) {
      return {
        success: false as const,
        error: "Använd vanlig redigering för dina egna aktiviteter",
      };
    }
    if (activity.deletedAt) {
      return { success: false as const, error: "Aktiviteten är borttagen" };
    }

    // Build patch with proper Date coercion for timestamps
    const updates: Partial<typeof activities.$inferInsert> = {};
    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.location !== undefined) updates.location = patch.location;
    if (patch.startTime !== undefined) updates.startTime = new Date(patch.startTime);
    if (patch.endTime !== undefined) {
      updates.endTime = patch.endTime ? new Date(patch.endTime) : null;
    }

    // Compute diff using raw values
    const beforeRaw: Record<string, unknown> = {
      ...(patch.title !== undefined && { title: activity.title }),
      ...(patch.description !== undefined && { description: activity.description }),
      ...(patch.location !== undefined && { location: activity.location }),
      ...(patch.startTime !== undefined && {
        startTime: activity.startTime?.toISOString(),
      }),
      ...(patch.endTime !== undefined && {
        endTime: activity.endTime?.toISOString() ?? null,
      }),
    };
    const afterRaw: Record<string, unknown> = {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.location !== undefined && { location: patch.location }),
      ...(patch.startTime !== undefined && { startTime: patch.startTime }),
      ...(patch.endTime !== undefined && { endTime: patch.endTime ?? null }),
    };
    const diff = computeDiff(beforeRaw, afterRaw);
    if (Object.keys(diff.changedFields).length === 0) {
      return { success: false as const, error: "Inga faktiska ändringar" };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(activities)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(activities.id, activityId));

      await tx.insert(adminActions).values({
        adminId: admin.id,
        actionType: "activity_edited",
        targetActivityId: activityId,
        targetUserId: activity.creatorId,
        sourceReportId: sourceReportId ?? null,
        reason,
        diff,
      });

      if (activity.creatorId) {
        await tx.insert(notifications).values({
          userId: activity.creatorId,
          type: "activity_edited_by_admin",
          activityId,
          params: {
            reason,
            changedFields: formatChangedFieldsSv(diff),
          },
        });
      }

      if (sourceReportId) {
        await tx
          .update(reports)
          .set({ status: "reviewed", reviewedAt: new Date() })
          .where(eq(reports.id, sourceReportId));
      }
    });

    revalidatePath(`/activity/${activityId}`);
    revalidatePath("/");
    return { success: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Något gick fel";
    return { success: false as const, error: message };
  }
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

export async function adminCancelActivity(input: unknown, sourceReportId?: string) {
  const parsed = adminCancelActivitySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  const { activityId, reason } = parsed.data;

  try {
    const { user: admin } = await requireAdmin();
    await checkRateLimit(admin.id);

    const activity = await db.query.activities.findFirst({
      where: eq(activities.id, activityId),
    });
    if (!activity) {
      return { success: false as const, error: "Aktivitet hittades inte" };
    }
    if (activity.creatorId === admin.id) {
      return {
        success: false as const,
        error: "Använd vanlig avbokning för dina egna aktiviteter",
      };
    }
    if (activity.deletedAt) {
      return { success: false as const, error: "Aktiviteten är borttagen" };
    }
    if (activity.cancelledAt) {
      return { success: false as const, error: "Aktiviteten är redan avbokad" };
    }

    const participants = await db
      .select({ userId: activityParticipants.userId })
      .from(activityParticipants)
      .where(eq(activityParticipants.activityId, activityId));

    await db.transaction(async (tx) => {
      await tx
        .update(activities)
        .set({
          cancelledAt: new Date(),
          cancelledReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(activities.id, activityId));

      await tx.insert(adminActions).values({
        adminId: admin.id,
        actionType: "activity_cancelled",
        targetActivityId: activityId,
        targetUserId: activity.creatorId,
        sourceReportId: sourceReportId ?? null,
        reason,
      });

      // Notify creator + all participants, excluding the acting admin if they happen
      // to be a participant on the activity.
      const recipientIds = new Set<string>();
      if (activity.creatorId) recipientIds.add(activity.creatorId);
      for (const p of participants) recipientIds.add(p.userId);
      recipientIds.delete(admin.id);

      if (recipientIds.size > 0) {
        await tx.insert(notifications).values(
          Array.from(recipientIds).map((userId) => ({
            userId,
            type: "activity_cancelled" as const,
            activityId,
            params: { reason },
          })),
        );
      }

      if (sourceReportId) {
        await tx
          .update(reports)
          .set({ status: "reviewed", reviewedAt: new Date() })
          .where(eq(reports.id, sourceReportId));
      }
    });

    revalidatePath(`/activity/${activityId}`);
    revalidatePath("/");
    return { success: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Något gick fel";
    return { success: false as const, error: message };
  }
}

// ─── Delete (soft) ───────────────────────────────────────────────────────────

export async function adminDeleteActivity(input: unknown, sourceReportId?: string) {
  const parsed = adminDeleteActivitySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  const { activityId, reason, banCreator, banReason } = parsed.data;

  try {
    const { user: admin } = await requireAdmin();
    await checkRateLimit(admin.id);

    const activity = await db.query.activities.findFirst({
      where: eq(activities.id, activityId),
    });
    if (!activity) {
      return { success: false as const, error: "Aktivitet hittades inte" };
    }
    if (activity.creatorId === admin.id) {
      return {
        success: false as const,
        error: "Använd vanlig borttagning för dina egna aktiviteter",
      };
    }
    if (activity.deletedAt) {
      return { success: false as const, error: "Aktiviteten är redan borttagen" };
    }

    // A4b: admins cannot ban other admins via moderation
    let creatorProfile: typeof users.$inferSelect | undefined;
    if (activity.creatorId) {
      creatorProfile = await db.query.users.findFirst({
        where: eq(users.id, activity.creatorId),
      });
    }
    if (banCreator && creatorProfile?.isAdmin) {
      return {
        success: false as const,
        error:
          "Admin-konton kan inte bannas via moderation. En annan admin behöver först demota användaren via databasen.",
      };
    }
    if (banCreator && !activity.creatorId) {
      return {
        success: false as const,
        error: "Aktiviteten har ingen arrangör att stänga av",
      };
    }

    const participants = await db
      .select({ userId: activityParticipants.userId })
      .from(activityParticipants)
      .where(eq(activityParticipants.activityId, activityId));

    await db.transaction(async (tx) => {
      const now = new Date();

      await tx
        .update(activities)
        .set({
          deletedAt: now,
          deletedBy: admin.id,
          deletedReason: reason,
          updatedAt: now,
        })
        .where(eq(activities.id, activityId));

      await tx.insert(adminActions).values({
        adminId: admin.id,
        actionType: "activity_deleted",
        targetActivityId: activityId,
        targetUserId: activity.creatorId,
        sourceReportId: sourceReportId ?? null,
        reason,
      });

      // Notify creator + all participants, excluding the acting admin.
      const creatorId = activity.creatorId;
      const recipientIds = new Set<string>();
      if (creatorId) recipientIds.add(creatorId);
      for (const p of participants) recipientIds.add(p.userId);
      recipientIds.delete(admin.id);

      if (recipientIds.size > 0) {
        await tx.insert(notifications).values(
          Array.from(recipientIds).map((userId) => ({
            userId,
            type: "activity_deleted" as const,
            activityId,
            params: { reason, isForCreator: userId === creatorId },
          })),
        );
      }

      if (banCreator && creatorId && banReason && !creatorProfile?.isBanned) {
        await tx
          .update(users)
          .set({
            isBanned: true,
            bannedAt: now,
            bannedBy: admin.id,
            banReason,
          })
          .where(eq(users.id, creatorId));

        await tx.insert(adminActions).values({
          adminId: admin.id,
          actionType: "user_banned",
          targetUserId: creatorId,
          sourceReportId: sourceReportId ?? null,
          reason: banReason,
        });
      }

      if (sourceReportId) {
        await tx
          .update(reports)
          .set({ status: "reviewed", reviewedAt: new Date() })
          .where(eq(reports.id, sourceReportId));
      }
    });

    revalidatePath(`/activity/${activityId}`);
    revalidatePath("/");
    revalidatePath("/my-activities");
    return { success: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Något gick fel";
    return { success: false as const, error: message };
  }
}
