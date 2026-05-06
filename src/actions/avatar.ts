"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { images, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { isValidPresetFilename, presetUrl } from "@/lib/avatar-presets";
import { log, errAttrs } from "@/lib/logger";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_SIZE = 256;

const UPLOADED_URL_RE = /^\/api\/images\/([0-9a-f-]{36})$/;

async function cleanupUploadedAvatar(userId: string, currentUrl: string | null) {
  if (!currentUrl) return;
  const match = UPLOADED_URL_RE.exec(currentUrl);
  if (!match) return;
  try {
    await db.delete(images).where(eq(images.id, match[1]));
  } catch (err) {
    log.warn("avatar image cleanup failed", { userId, ...errAttrs(err) });
  }
}

async function setUserAvatar(userId: string, newUrl: string | null) {
  const [current] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId));

  await db
    .update(users)
    .set({ avatarUrl: newUrl, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await cleanupUploadedAvatar(userId, current?.avatarUrl ?? null);
}

export async function uploadProfileAvatar(formData: FormData) {
  try {
    const user = await requireAuth();
    const userId = user.id!;

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false as const, error: "Ingen fil vald" };
    }
    if (file.size > MAX_BYTES) {
      return { success: false as const, error: "Filen är för stor (max 10 MB)" };
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { success: false as const, error: "Endast JPG, PNG eller WebP stöds" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const resized = await sharp(buffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .webp({ quality: 88 })
      .toBuffer();

    const [row] = await db
      .insert(images)
      .values({ data: resized, contentType: "image/webp" })
      .returning({ id: images.id });

    const url = `/api/images/${row.id}`;
    await setUserAvatar(userId, url);
    revalidatePath("/profile");
    revalidatePath("/");

    return { success: true as const, url };
  } catch (error) {
    log.error("uploadProfileAvatar error", errAttrs(error));
    return {
      success: false as const,
      error: "Uppladdning misslyckades. Försök igen eller välj en annan bild.",
    };
  }
}

export async function setPresetAvatar(filename: string) {
  try {
    const user = await requireAuth();
    if (!isValidPresetFilename(filename)) {
      return { success: false as const, error: "Ogiltig profilbild" };
    }
    const url = presetUrl(filename);
    await setUserAvatar(user.id!, url);
    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true as const, url };
  } catch (error) {
    log.error("setPresetAvatar error", errAttrs(error));
    return { success: false as const, error: "Något gick fel" };
  }
}

export async function removeAvatar() {
  try {
    const user = await requireAuth();
    await setUserAvatar(user.id!, null);
    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true as const };
  } catch (error) {
    log.error("removeAvatar error", errAttrs(error));
    return { success: false as const, error: "Något gick fel" };
  }
}
