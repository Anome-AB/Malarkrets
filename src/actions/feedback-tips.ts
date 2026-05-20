"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { feedbackTips, images, type FeedbackTip } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { log, errAttrs } from "@/lib/logger";
import sharp from "sharp";
import { z } from "zod";

// Max console-log som accepteras: 64 KB. 200 entries med medel ~100 chars
// per entry är ~20 KB. 64 KB cap räcker även för dump med långa stack traces.
const MAX_CONSOLE_LOG_BYTES = 64 * 1024;

// Max description: 8000 tecken (motsvarar ~1500 ord). Mer än någon testare
// kommer skriva, mindre än vad en bot kan spamma in.
const MAX_DESCRIPTION_CHARS = 8000;

// Screenshot: max 4 MB klient-sidan (innan resize). Lagras som ~150 KB WebP
// efter resize till 1280px bredd. Vi accepterar PNG från html2canvas.
const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;
const ALLOWED_SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];

const submitTipSchema = z.object({
  kind: z.enum(["bug", "idea"]),
  description: z
    .string()
    .min(10, "Berätta lite mer, minst 10 tecken")
    .max(MAX_DESCRIPTION_CHARS, "Beskrivningen är för lång"),
  pageUrl: z.string().max(2048).optional(),
  userAgent: z.string().max(1024).optional(),
  viewportWidth: z.number().int().min(0).max(20000).optional(),
  viewportHeight: z.number().int().min(0).max(20000).optional(),
  consoleLog: z.string().max(MAX_CONSOLE_LOG_BYTES).optional(),
  appVersion: z.string().max(64).optional(),
  screenshotImageId: z.string().uuid().optional(),
});

export type SubmitTipInput = z.infer<typeof submitTipSchema>;

interface SubmitTipResult {
  success: boolean;
  tipId?: string;
  error?: string;
}

export async function submitTip(input: SubmitTipInput): Promise<SubmitTipResult> {
  try {
    const user = await requireAuth();
    const parsed = submitTipSchema.safeParse(input);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        success: false,
        error: firstIssue?.message ?? "Ogiltigt fält",
      };
    }

    const data = parsed.data;

    const [inserted] = await db
      .insert(feedbackTips)
      .values({
        reporterId: user.id,
        kind: data.kind,
        description: data.description.trim(),
        pageUrl: data.pageUrl,
        userAgent: data.userAgent,
        viewportWidth: data.viewportWidth,
        viewportHeight: data.viewportHeight,
        consoleLog: data.consoleLog,
        appVersion: data.appVersion,
        screenshotImageId: data.screenshotImageId,
      })
      .returning({ id: feedbackTips.id });

    log.info("feedback tip submitted", {
      tipId: inserted.id,
      reporterId: user.id,
      kind: data.kind,
      hasScreenshot: !!data.screenshotImageId,
    });

    revalidatePath("/mina-tips");
    revalidatePath("/admin/feedback");

    return { success: true, tipId: inserted.id };
  } catch (error) {
    log.error("submitTip error", errAttrs(error));
    return {
      success: false,
      error: "Tipset gick inte att skicka. Försök igen om en stund.",
    };
  }
}

interface UploadScreenshotResult {
  success: boolean;
  imageId?: string;
  error?: string;
}

export async function uploadFeedbackScreenshot(
  formData: FormData,
): Promise<UploadScreenshotResult> {
  try {
    await requireAuth();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, error: "Ingen fil bifogad" };
    }

    if (file.size > MAX_SCREENSHOT_BYTES) {
      return { success: false, error: "Skärmdumpen är för stor" };
    }

    if (!ALLOWED_SCREENSHOT_TYPES.includes(file.type)) {
      return { success: false, error: "Filtypen stöds inte" };
    }

    const source = Buffer.from(await file.arrayBuffer());

    // Resize till max 1280px bredd, behåll aspect, WebP 80% för att hålla
    // images-tabellen liten. En typisk laptop-skärmdump (1920px) krymper
    // från 2-3 MB PNG till ~150 KB WebP.
    const resized = await sharp(source)
      .resize({ width: 1280, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const [row] = await db
      .insert(images)
      .values({ data: resized, contentType: "image/webp" })
      .returning({ id: images.id });

    return { success: true, imageId: row.id };
  } catch (error) {
    log.error("uploadFeedbackScreenshot error", errAttrs(error));
    return {
      success: false,
      error: "Skärmdumpen kunde inte sparas. Tipset funkar utan den.",
    };
  }
}

export type MyTip = Pick<
  FeedbackTip,
  "id" | "kind" | "status" | "description" | "createdAt" | "adminNotes" | "resolvedAt"
>;

export async function getMyTips(): Promise<MyTip[]> {
  const user = await requireAuth();

  const rows = await db
    .select({
      id: feedbackTips.id,
      kind: feedbackTips.kind,
      status: feedbackTips.status,
      description: feedbackTips.description,
      createdAt: feedbackTips.createdAt,
      adminNotes: feedbackTips.adminNotes,
      resolvedAt: feedbackTips.resolvedAt,
    })
    .from(feedbackTips)
    .where(eq(feedbackTips.reporterId, user.id))
    .orderBy(desc(feedbackTips.createdAt));

  return rows;
}
