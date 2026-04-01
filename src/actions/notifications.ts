"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function markAllRead() {
  try {
    const user = await requireAuth();

    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.userId, user.id!),
          eq(notifications.read, false),
        ),
      );

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("markAllRead error:", error);
    return {
      success: false,
      error: "Något gick fel vid markering av notiser",
    };
  }
}

export async function markRead(notificationId: string) {
  try {
    const user = await requireAuth();

    const notification = await db.query.notifications.findFirst({
      where: eq(notifications.id, notificationId),
    });

    if (!notification || notification.userId !== user.id!) {
      return { success: false, error: "Notisen hittades inte" };
    }

    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, notificationId));

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("markRead error:", error);
    return {
      success: false,
      error: "Något gick fel vid markering av notis",
    };
  }
}
