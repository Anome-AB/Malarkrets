"use server";

import { requireAuth } from "@/lib/auth";
import { getS3Client, S3_BUCKET, getPublicUrl } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

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

async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

async function uploadToFilesystem(
  key: string,
  body: Buffer,
): Promise<string> {
  const filePath = join(process.cwd(), "public", "uploads", key);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
  return `/uploads/${key}`;
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

    const id = randomUUID();
    const thumbKey = `activities/${id}/thumb.webp`;
    const mediumKey = `activities/${id}/medium.webp`;
    const ogKey = `activities/${id}/og.webp`;

    // Try S3 first, fall back to filesystem for local dev
    let thumbUrl: string;
    let mediumUrl: string;
    let ogUrl: string;

    try {
      await Promise.all([
        uploadToS3(thumbKey, thumbBuffer, "image/webp"),
        uploadToS3(mediumKey, mediumBuffer, "image/webp"),
        uploadToS3(ogKey, ogBuffer, "image/webp"),
      ]);
      thumbUrl = getPublicUrl(thumbKey);
      mediumUrl = getPublicUrl(mediumKey);
      ogUrl = getPublicUrl(ogKey);
    } catch (s3Error) {
      console.warn("S3 upload failed, falling back to filesystem:", s3Error);
      [thumbUrl, mediumUrl, ogUrl] = await Promise.all([
        uploadToFilesystem(thumbKey, thumbBuffer),
        uploadToFilesystem(mediumKey, mediumBuffer),
        uploadToFilesystem(ogKey, ogBuffer),
      ]);
    }

    return { success: true, thumbUrl, mediumUrl, ogUrl };
  } catch (error) {
    console.error("uploadActivityImage error:", error);
    const msg = error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Okänt fel";
    const fullMsg = msg || "Kunde inte bearbeta bilden";
    return { success: false, error: `Uppladdning misslyckades: ${fullMsg}` };
  }
}
