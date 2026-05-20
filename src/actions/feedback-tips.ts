"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  feedbackTips,
  feedbackTipComments,
  feedbackTipViews,
  feedbackTipInterestSuggestions,
  images,
  interestTags,
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

const MAX_INTEREST_NAME_CHARS = 60;
const MAX_INTEREST_NAMES = 10;

const submitTipSchema = z
  .object({
    kind: z.enum(["bug", "idea", "interest"]),
    description: z.string().max(MAX_DESCRIPTION_CHARS).default(""),
    interestNames: z
      .array(z.string().trim().min(2).max(MAX_INTEREST_NAME_CHARS))
      .max(MAX_INTEREST_NAMES)
      .optional(),
    pageUrl: z.string().max(2048).optional(),
    userAgent: z.string().max(1024).optional(),
    viewportWidth: z.number().int().min(0).max(20000).optional(),
    viewportHeight: z.number().int().min(0).max(20000).optional(),
    consoleLog: z.string().max(MAX_CONSOLE_LOG_BYTES).optional(),
    appVersion: z.string().max(64).optional(),
    screenshotImageId: z.string().uuid().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.kind === "interest") {
      const names = d.interestNames ?? [];
      const cleaned = names.map((n) => n.trim()).filter((n) => n.length > 0);
      if (cleaned.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Föreslå minst ett intresse",
          path: ["interestNames"],
        });
      }
    } else if (d.description.trim().length < 10) {
      ctx.addIssue({
        code: "custom",
        message: "Berätta lite mer, minst 10 tecken",
        path: ["description"],
      });
    }
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

    // För kind=interest: lägg in en suggestion-rad per föreslaget intresse.
    if (data.kind === "interest" && data.interestNames) {
      const cleaned = data.interestNames
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
      if (cleaned.length > 0) {
        await db.insert(feedbackTipInterestSuggestions).values(
          cleaned.map((name) => ({ tipId: inserted.id, name })),
        );
      }
    }

    // Markera som "läst" för rapportören direkt så deras nyss-skickade
    // tips inte visas som oläst i deras egen lista.
    await db.insert(feedbackTipViews).values({
      userId: user.id,
      tipId: inserted.id,
    });

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

// ─── Befintliga intressetaggar (för duplicate-koll i Tipsa-formuläret) ──

export interface ExistingInterestTag {
  id: number;
  name: string;
  slug: string;
}

export async function getAllInterestTags(): Promise<ExistingInterestTag[]> {
  await requireAuth();
  return await db
    .select({
      id: interestTags.id,
      name: interestTags.name,
      slug: interestTags.slug,
    })
    .from(interestTags)
    .orderBy(interestTags.name);
}

export type MyTip = Pick<
  FeedbackTip,
  | "id"
  | "kind"
  | "status"
  | "description"
  | "createdAt"
  | "resolvedAt"
  | "lastActivityAt"
> & {
  commentCount: number;
  hasUnread: boolean;
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
      resolvedAt: feedbackTips.resolvedAt,
      lastActivityAt: feedbackTips.lastActivityAt,
      lastViewedAt: feedbackTipViews.lastViewedAt,
    })
    .from(feedbackTips)
    .leftJoin(
      feedbackTipViews,
      and(
        eq(feedbackTipViews.tipId, feedbackTips.id),
        eq(feedbackTipViews.userId, user.id),
      ),
    )
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
  return rows.map(({ lastViewedAt, ...r }) => ({
    ...r,
    commentCount: countMap.get(r.id) ?? 0,
    hasUnread:
      lastViewedAt === null || r.lastActivityAt.getTime() > lastViewedAt.getTime(),
  }));
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

export interface InterestSuggestionItem {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected" | "duplicate";
  decisionReason: string | null;
  decidedAt: Date | null;
  approvedAsTagId: number | null;
  approvedAsTagName: string | null;
}

export interface MyTipDetail extends MyTip {
  comments: TipComment[];
  interestSuggestions: InterestSuggestionItem[];
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

  // Sidoeffekt: markera tipset som läst för rapportören just nu. Triggar
  // revalidate på /mina-tips så badge:n släcks vid nästa besök på listan.
  await db
    .insert(feedbackTipViews)
    .values({ userId: user.id, tipId: tip.id })
    .onConflictDoUpdate({
      target: [feedbackTipViews.userId, feedbackTipViews.tipId],
      set: { lastViewedAt: new Date() },
    });
  revalidatePath("/mina-tips");

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

  const suggestions =
    tip.kind === "interest"
      ? await db
          .select({
            id: feedbackTipInterestSuggestions.id,
            name: feedbackTipInterestSuggestions.name,
            status: feedbackTipInterestSuggestions.status,
            decisionReason: feedbackTipInterestSuggestions.decisionReason,
            decidedAt: feedbackTipInterestSuggestions.decidedAt,
            approvedAsTagId: feedbackTipInterestSuggestions.approvedAsTagId,
            approvedAsTagName: interestTags.name,
          })
          .from(feedbackTipInterestSuggestions)
          .leftJoin(
            interestTags,
            eq(feedbackTipInterestSuggestions.approvedAsTagId, interestTags.id),
          )
          .where(eq(feedbackTipInterestSuggestions.tipId, tipId))
          .orderBy(feedbackTipInterestSuggestions.createdAt)
      : [];

  return {
    id: tip.id,
    kind: tip.kind,
    status: tip.status,
    description: tip.description,
    createdAt: tip.createdAt,
    resolvedAt: tip.resolvedAt,
    lastActivityAt: tip.lastActivityAt,
    commentCount: comments.length,
    hasUnread: false, // markerades just som läst i sidoeffekten ovan
    // Interest-tips redigeras via egna suggestion-handlers (admin
    // godkänner/avslår enstaka namn), inte via description-edit.
    canEdit: tip.status === "open" && tip.kind !== "interest",
    comments: comments.map((c) => ({
      ...c,
      authorIsAdmin: c.authorIsAdmin ?? false,
      isReporter: c.authorId === tip.reporterId,
    })),
    interestSuggestions: suggestions,
  };
}

const editMyTipSchema = z.object({
  tipId: z.string().uuid(),
  kind: z.enum(["bug", "idea", "interest"]),
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
