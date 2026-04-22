"use server";

import { requireAdmin as requireAdminFromAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  userInterests,
  userBlocks,
  notifications,
  analyticsEvents,
  interestTags,
  activities,
  activityParticipants,
  courageMessages,
} from "@/db/schema";
import { eq, and, gt, isNull, or, ilike, count, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { log, errAttrs } from "@/lib/logger";

async function requireAdmin() {
  const { user } = await requireAdminFromAuth();
  return user;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

export async function anonymizeUser(userId: string) {
  try {
    await requireAdmin();

    await db
      .update(users)
      .set({
        firstName: null,
        lastName: null,
        displayName: "Borttagen användare",
        birthDate: null,
        gender: null,
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await db.delete(userInterests).where(eq(userInterests.userId, userId));
    await db.delete(userBlocks).where(eq(userBlocks.blockerId, userId));
    await db.delete(notifications).where(eq(notifications.userId, userId));
    await db
      .delete(analyticsEvents)
      .where(eq(analyticsEvents.userId, userId));

    revalidatePath("/admin");

    return { success: true };
  } catch (error) {
    log.error("anonymizeUser error", errAttrs(error));
    const msg = error instanceof Error ? error.message : "Något gick fel";
    return { success: false, error: msg };
  }
}

export async function banUser(userId: string, reason: string) {
  try {
    const admin = await requireAdmin();

    const target = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!target) return { success: false, error: "Användaren hittades inte" };
    if (target.isAdmin) return { success: false, error: "Kan inte blockera en administratör" };

    await db
      .update(users)
      .set({
        isBanned: true,
        bannedAt: new Date(),
        banReason: reason.trim(),
        bannedBy: admin.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    const now = new Date();
    const futureActivities = await db
      .select({ id: activities.id, title: activities.title })
      .from(activities)
      .where(
        and(
          eq(activities.creatorId, userId),
          gt(activities.startTime, now),
          isNull(activities.cancelledAt),
        ),
      );

    for (const activity of futureActivities) {
      await db
        .update(activities)
        .set({
          cancelledAt: now,
          cancelledReason: "Arrangören har blockerats av en administratör",
          updatedAt: now,
        })
        .where(eq(activities.id, activity.id));

      const participants = await db
        .select({ userId: activityParticipants.userId })
        .from(activityParticipants)
        .where(eq(activityParticipants.activityId, activity.id));

      const recipients = participants.filter((p) => p.userId !== admin.id);
      if (recipients.length > 0) {
        await db.insert(notifications).values(
          recipients.map((p) => ({
            userId: p.userId,
            type: "activity_cancelled" as const,
            activityId: activity.id,
            params: {
              activityTitle: activity.title,
              reason: "Arrangören har blockerats av en administratör",
            },
          })),
        );
      }
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    log.error("banUser error", errAttrs(error));
    const msg = error instanceof Error ? error.message : "Något gick fel";
    return { success: false, error: msg };
  }
}

export async function unbanUser(userId: string) {
  try {
    await requireAdmin();

    await db
      .update(users)
      .set({
        isBanned: false,
        bannedAt: null,
        banReason: null,
        bannedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    log.error("unbanUser error", errAttrs(error));
    const msg = error instanceof Error ? error.message : "Något gick fel";
    return { success: false, error: msg };
  }
}

export async function deleteTag(tagId: number) {
  try {
    await requireAdmin();

    await db.delete(interestTags).where(eq(interestTags.id, tagId));

    revalidatePath("/admin");

    return { success: true };
  } catch (error) {
    log.error("deleteTag error", errAttrs(error));
    const msg = error instanceof Error ? error.message : "Något gick fel";
    return { success: false, error: msg };
  }
}

const PAGE_SIZE = 25;

export async function searchUsers(query: string, page: number) {
  try {
    await requireAdmin();

    const offset = (page - 1) * PAGE_SIZE;
    const searchConditions = query.trim()
      ? or(
          ilike(users.email, `%${query.trim()}%`),
          ilike(users.displayName, `%${query.trim()}%`),
        )
      : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          isAdmin: users.isAdmin,
          isBanned: users.isBanned,
          bannedAt: users.bannedAt,
          banReason: users.banReason,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(searchConditions)
        .orderBy(desc(users.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset),
      db
        .select({ count: count() })
        .from(users)
        .where(searchConditions),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return {
      users: rows.map((u) => ({
        ...u,
        createdAt: u.createdAt?.toISOString() ?? null,
        bannedAt: u.bannedAt?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    };
  } catch (error) {
    log.error("searchUsers error", errAttrs(error));
    return { users: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 };
  }
}

export async function addTag(name: string) {
  try {
    await requireAdmin();

    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: "Namn krävs" };
    }

    // Check for duplicate slug
    const slug = slugify(trimmed);
    const existing = await db.query.interestTags.findFirst({
      where: eq(interestTags.slug, slug),
    });
    if (existing) {
      return { success: false, error: `En tagg med liknande namn finns redan: "${existing.name}"` };
    }

    await db.insert(interestTags).values({ name: trimmed, slug });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    log.error("addTag error", errAttrs(error));
    const msg = error instanceof Error ? error.message : "Något gick fel";
    return { success: false, error: msg };
  }
}

// ─── Courage messages ────────────────────────────────────────────────────

export async function getCourageMessages() {
  try {
    await requireAdmin();
    const rows = await db
      .select()
      .from(courageMessages)
      .orderBy(courageMessages.audience, courageMessages.id);
    return { success: true as const, messages: rows };
  } catch (error) {
    log.error("getCourageMessages error", errAttrs(error));
    return { success: false as const, messages: [] };
  }
}

export async function addCourageMessage(audience: string, message: string) {
  try {
    await requireAdmin();
    const trimmed = message.trim();
    if (!trimmed) return { success: false, error: "Meddelandet får inte vara tomt" };
    if (!["alla", "par", "familj"].includes(audience)) {
      return { success: false, error: "Ogiltig målgrupp" };
    }

    await db.insert(courageMessages).values({ audience, message: trimmed });
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    log.error("addCourageMessage error", errAttrs(error));
    const msg = error instanceof Error ? error.message : "Något gick fel";
    return { success: false, error: msg };
  }
}

export async function updateCourageMessage(id: number, message: string) {
  try {
    await requireAdmin();
    const trimmed = message.trim();
    if (!trimmed) return { success: false, error: "Meddelandet får inte vara tomt" };

    await db
      .update(courageMessages)
      .set({ message: trimmed, updatedAt: new Date() })
      .where(eq(courageMessages.id, id));
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    log.error("updateCourageMessage error", errAttrs(error));
    const msg = error instanceof Error ? error.message : "Något gick fel";
    return { success: false, error: msg };
  }
}

export async function deleteCourageMessage(id: number) {
  try {
    await requireAdmin();
    await db.delete(courageMessages).where(eq(courageMessages.id, id));
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    log.error("deleteCourageMessage error", errAttrs(error));
    const msg = error instanceof Error ? error.message : "Något gick fel";
    return { success: false, error: msg };
  }
}
