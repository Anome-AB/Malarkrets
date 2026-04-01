"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  userInterests,
  userBlocks,
  notifications,
  analyticsEvents,
  interestTags,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const user = await requireAuth();
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (!profile?.isAdmin) {
    throw new Error("Åtkomst nekad");
  }

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

    // Anonymize user profile
    await db
      .update(users)
      .set({
        displayName: "Borttagen användare",
        birthDate: null,
        gender: null,
        location: null,
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Delete related data
    await db.delete(userInterests).where(eq(userInterests.userId, userId));
    await db.delete(userBlocks).where(eq(userBlocks.blockerId, userId));
    await db.delete(notifications).where(eq(notifications.userId, userId));
    await db
      .delete(analyticsEvents)
      .where(eq(analyticsEvents.userId, userId));

    revalidatePath("/admin");

    return { success: true };
  } catch (error) {
    console.error("anonymizeUser error:", error);
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
    console.error("deleteTag error:", error);
    const msg = error instanceof Error ? error.message : "Något gick fel";
    return { success: false, error: msg };
  }
}

export async function addTags(names: string[]) {
  try {
    await requireAdmin();

    const trimmed = names
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (trimmed.length === 0) {
      return { success: false, error: "Inga taggar att lägga till" };
    }

    const values = trimmed.map((name) => ({
      name,
      slug: slugify(name),
    }));

    await db.insert(interestTags).values(values);

    revalidatePath("/admin");

    return { success: true, count: trimmed.length };
  } catch (error) {
    console.error("addTags error:", error);
    const msg = error instanceof Error ? error.message : "Något gick fel";
    return { success: false, error: msg };
  }
}
