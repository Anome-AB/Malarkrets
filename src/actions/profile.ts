"use server";

import { requireAuth } from "@/lib/auth";
import { signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  userInterests,
  userBlocks,
  notifications,
  analyticsEvents,
} from "@/db/schema";
import {
  updateProfileSchema,
  updateInterestsSchema,
} from "@/lib/validations/profile";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { log, errAttrs } from "@/lib/logger";

type UpdateProfilePatch = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  birthDate?: string;
  gender?: "man" | "kvinna" | "ej_angett";
};

// Auto-save-vänligt server-action: tar emot ett patch-objekt med bara
// förändrade fält. Validerar partial schema, uppdaterar bara de kolumner
// som finns i payload. Kallas från useAutoSave-hooken.
//
// revalidatePath skippas medvetet - auto-save fires många gånger per
// editing-session och cache-invalidering är onödig (lokal UI är optimistisk,
// nästa page-load hämtar färskt).
export async function updateProfile(patch: UpdateProfilePatch) {
  try {
    const user = await requireAuth();

    const parsed = updateProfileSchema.safeParse(patch);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return { success: true as const };
    }

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

    return { success: true as const };
  } catch (error) {
    log.error("updateProfile error", errAttrs(error));
    return {
      success: false as const,
      error: "Något gick fel vid uppdatering av profil",
    };
  }
}

export async function updateInterests(tagIds: number[]) {
  try {
    const user = await requireAuth();

    const parsed = updateInterestsSchema.safeParse({ tagIds });
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const validTagIds = parsed.data.tagIds;

    await db.delete(userInterests).where(eq(userInterests.userId, user.id!));

    if (validTagIds.length > 0) {
      await db.insert(userInterests).values(
        validTagIds.map((tagId) => ({
          userId: user.id!,
          tagId,
        })),
      );
    }

    return { success: true as const };
  } catch (error) {
    log.error("updateInterests error", errAttrs(error));
    return {
      success: false as const,
      error: "Något gick fel vid uppdatering av intressen",
    };
  }
}

export async function deleteAccount() {
  try {
    const user = await requireAuth();
    const userId = user.id!;

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

    await signOut({ redirectTo: "/" });
  } catch (error) {
    log.error("deleteAccount error", errAttrs(error));
    return {
      success: false as const,
      error: "Något gick fel vid radering av konto",
    };
  }
}
