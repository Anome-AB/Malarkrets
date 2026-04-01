"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, userInterests } from "@/db/schema";
import {
  updateProfileSchema,
  updateInterestsSchema,
} from "@/lib/validations/profile";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  try {
    const user = await requireAuth();

    const raw = {
      displayName: formData.get("displayName") || undefined,
      birthDate: formData.get("birthDate") || undefined,
      gender: formData.get("gender") || undefined,
      location: formData.get("location") || undefined,
    };

    const parsed = updateProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const data = parsed.data;

    await db
      .update(users)
      .set({
        ...data,
        birthDate: data.birthDate
          ? new Date(data.birthDate).toISOString().split("T")[0]
          : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id!));

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("updateProfile error:", error);
    return { success: false, error: "Något gick fel vid uppdatering av profil" };
  }
}

export async function updateInterests(formData: FormData) {
  try {
    const user = await requireAuth();

    const raw = {
      tagIds: JSON.parse((formData.get("tagIds") as string) || "[]"),
    };

    const parsed = updateInterestsSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { tagIds } = parsed.data;

    // Delete all existing interests
    await db.delete(userInterests).where(eq(userInterests.userId, user.id!));

    // Insert new ones
    if (tagIds.length > 0) {
      await db.insert(userInterests).values(
        tagIds.map((tagId) => ({
          userId: user.id!,
          tagId,
        })),
      );
    }

    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("updateInterests error:", error);
    return {
      success: false,
      error: "Något gick fel vid uppdatering av intressen",
    };
  }
}
