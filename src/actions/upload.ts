"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { images } from "@/db/schema";
import sharp from "sharp";
import { log, errAttrs } from "@/lib/logger";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface UploadResult {
  success: true;
  thumbUrl: string;
  mediumUrl: string;
  ogUrl: string;
}

interface UploadError {
  success: false;
  error: string;
}

async function saveToDb(data: Buffer, contentType: string): Promise<string> {
  const [row] = await db
    .insert(images)
    .values({ data, contentType })
    .returning({ id: images.id });
  return `/api/images/${row.id}`;
}

export async function uploadActivityImage(
  formData: FormData,
): Promise<UploadResult | UploadError> {
  try {
    await requireAuth();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, error: "Ingen fil vald" };
    }

    if (file.size > MAX_BYTES) {
      return { success: false, error: "Filen är för stor (max 10 MB)" };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return { success: false, error: "Endast JPG, PNG eller WebP stöds" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate 3 sizes with Sharp — cover crop, 16:9 aspect
    const [thumbBuffer, mediumBuffer, ogBuffer] = await Promise.all([
      sharp(buffer).resize(400, 225, { fit: "cover" }).webp({ quality: 80 }).toBuffer(),
      sharp(buffer).resize(800, 450, { fit: "cover" }).webp({ quality: 85 }).toBuffer(),
      sharp(buffer).resize(1200, 675, { fit: "cover" }).webp({ quality: 85 }).toBuffer(),
    ]);

    const [thumbUrl, mediumUrl, ogUrl] = await Promise.all([
      saveToDb(thumbBuffer, "image/webp"),
      saveToDb(mediumBuffer, "image/webp"),
      saveToDb(ogBuffer, "image/webp"),
    ]);

    return { success: true, thumbUrl, mediumUrl, ogUrl };
  } catch (error) {
    log.error("uploadActivityImage error", errAttrs(error));
    const msg = error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Okänt fel";
    const fullMsg = msg || "Kunde inte bearbeta bilden";
    return { success: false, error: `Uppladdning misslyckades: ${fullMsg}` };
  }
}
