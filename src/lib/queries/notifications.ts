import { db } from "@/lib/db";
import { notifications, activities } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";

const notificationSelect = {
  id: notifications.id,
  type: notifications.type,
  activityId: notifications.activityId,
  activityTitle: activities.title,
  params: notifications.params,
  read: notifications.read,
  createdAt: notifications.createdAt,
};

export async function getUnreadNotifications(userId: string) {
  return db
    .select(notificationSelect)
    .from(notifications)
    .leftJoin(activities, eq(notifications.activityId, activities.id))
    .where(
      and(eq(notifications.userId, userId), eq(notifications.read, false)),
    )
    .orderBy(desc(notifications.createdAt));
}

export async function getRecentNotifications(userId: string, limit = 50) {
  return db
    .select(notificationSelect)
    .from(notifications)
    .leftJoin(activities, eq(notifications.activityId, activities.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getNotificationCount(userId: string) {
  const result = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.read, false)),
    );

  return result[0]?.count ?? 0;
}

export async function markNotificationsRead(userId: string) {
  return db
    .update(notifications)
    .set({ read: true })
    .where(
      and(eq(notifications.userId, userId), eq(notifications.read, false)),
    );
}
