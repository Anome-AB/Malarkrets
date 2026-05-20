"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  feedbackTips,
  feedbackTipComments,
  images,
  users,
  type FeedbackTip,
} from "@/db/schema";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
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
  | "id"
  | "kind"
  | "status"
  | "description"
  | "createdAt"
  | "adminNotes"
  | "resolvedAt"
  | "lastActivityAt"
> & {
  commentCount: number;
  adminNotesAuthorName: string | null;
};

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
      lastActivityAt: feedbackTips.lastActivityAt,
      adminNotesAuthorName: users.displayName,
    })
    .from(feedbackTips)
    .leftJoin(users, eq(feedbackTips.adminNotesAuthorId, users.id))
    .where(eq(feedbackTips.reporterId, user.id))
    .orderBy(desc(feedbackTips.lastActivityAt));

  if (rows.length === 0) return [];

  const counts = await db
    .select({
      tipId: feedbackTipComments.tipId,
      count: sql<number>`count(*)::int`,
    })
    .from(feedbackTipComments)
    .where(
      inArray(
        feedbackTipComments.tipId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(feedbackTipComments.tipId);

  const countMap = new Map(counts.map((c) => [c.tipId, c.count]));
  return rows.map((r) => ({ ...r, commentCount: countMap.get(r.id) ?? 0 }));
}

// ─── Detalj + redigera + kommentera ────────────────────────────────────

export interface TipComment {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorDisplayName: string | null;
  authorIsAdmin: boolean;
  isReporter: boolean;
}

export interface MyTipDetail extends MyTip {
  comments: TipComment[];
  canEdit: boolean;
}

export async function getMyTipDetail(tipId: string): Promise<MyTipDetail | null> {
  const user = await requireAuth();

  const tip = await db.query.feedbackTips.findFirst({
    where: and(
      eq(feedbackTips.id, tipId),
      eq(feedbackTips.reporterId, user.id),
    ),
  });

  if (!tip) return null;

  let adminNotesAuthorName: string | null = null;
  if (tip.adminNotesAuthorId) {
    const author = await db.query.users.findFirst({
      where: eq(users.id, tip.adminNotesAuthorId),
    });
    adminNotesAuthorName = author?.displayName ?? null;
  }

  const comments = await db
    .select({
      id: feedbackTipComments.id,
      body: feedbackTipComments.body,
      createdAt: feedbackTipComments.createdAt,
      authorId: feedbackTipComments.authorId,
      authorDisplayName: users.displayName,
      authorIsAdmin: users.isAdmin,
    })
    .from(feedbackTipComments)
    .leftJoin(users, eq(feedbackTipComments.authorId, users.id))
    .where(eq(feedbackTipComments.tipId, tipId))
    .orderBy(feedbackTipComments.createdAt);

  return {
    id: tip.id,
    kind: tip.kind,
    status: tip.status,
    description: tip.description,
    createdAt: tip.createdAt,
    adminNotes: tip.adminNotes,
    resolvedAt: tip.resolvedAt,
    lastActivityAt: tip.lastActivityAt,
    commentCount: comments.length,
    adminNotesAuthorName,
    canEdit: tip.status === "open",
    comments: comments.map((c) => ({
      ...c,
      authorIsAdmin: c.authorIsAdmin ?? false,
      isReporter: c.authorId === tip.reporterId,
    })),
  };
}

const editMyTipSchema = z.object({
  tipId: z.string().uuid(),
  kind: z.enum(["bug", "idea"]),
  description: z
    .string()
    .min(10, "Berätta lite mer, minst 10 tecken")
    .max(MAX_DESCRIPTION_CHARS, "Beskrivningen är för lång"),
});

export async function editMyTip(
  input: z.infer<typeof editMyTipSchema>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const parsed = editMyTipSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Ogiltigt fält",
      };
    }

    const tip = await db.query.feedbackTips.findFirst({
      where: eq(feedbackTips.id, parsed.data.tipId),
    });
    if (!tip) {
      return { success: false, error: "Tipset hittades inte" };
    }
    if (tip.reporterId !== user.id) {
      return { success: false, error: "Du kan bara redigera dina egna tips" };
    }
    if (tip.status !== "open") {
      return {
        success: false,
        error: "Tipset har redan börjat hanteras och kan inte längre redigeras",
      };
    }

    await db
      .update(feedbackTips)
      .set({
        kind: parsed.data.kind,
        description: parsed.data.description.trim(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(feedbackTips.id, parsed.data.tipId));

    log.info("feedback tip edited", {
      tipId: parsed.data.tipId,
      reporterId: user.id,
    });

    revalidatePath("/mina-tips");
    revalidatePath(`/mina-tips/${parsed.data.tipId}`);
    revalidatePath("/admin/feedback");
    return { success: true };
  } catch (error) {
    log.error("editMyTip error", errAttrs(error));
    return { success: false, error: "Något gick fel" };
  }
}

const MAX_COMMENT_CHARS = 4000;

const addCommentSchema = z.object({
  tipId: z.string().uuid(),
  body: z
    .string()
    .min(1, "Skriv något")
    .max(MAX_COMMENT_CHARS, "Kommentaren är för lång"),
});

// Tråden är gemensam för rapportören och admins. Båda kan posta. Triggern
// på feedback_tip_comments bumpar feedback_tips.last_activity_at automatiskt.
export async function addTipComment(
  input: z.infer<typeof addCommentSchema>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const parsed = addCommentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Ogiltig kommentar",
      };
    }

    const tip = await db.query.feedbackTips.findFirst({
      where: eq(feedbackTips.id, parsed.data.tipId),
    });
    if (!tip) {
      return { success: false, error: "Tipset hittades inte" };
    }

    // Auth: rapportören själv eller en admin
    const profile = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    const isAdmin = profile?.isAdmin ?? false;
    const isReporter = tip.reporterId === user.id;
    if (!isAdmin && !isReporter) {
      return { success: false, error: "Du har inte tillgång till det här tipset" };
    }

    await db.insert(feedbackTipComments).values({
      tipId: parsed.data.tipId,
      authorId: user.id,
      body: parsed.data.body.trim(),
    });

    log.info("feedback tip comment added", {
      tipId: parsed.data.tipId,
      authorId: user.id,
      role: isAdmin ? "admin" : "reporter",
    });

    revalidatePath("/mina-tips");
    revalidatePath(`/mina-tips/${parsed.data.tipId}`);
    revalidatePath("/admin/feedback");
    return { success: true };
  } catch (error) {
    log.error("addTipComment error", errAttrs(error));
    return { success: false, error: "Något gick fel" };
  }
}
