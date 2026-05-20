"use server";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  feedbackTips,
  feedbackTipComments,
  feedbackTipViews,
  feedbackTipInterestSuggestions,
  interestTags,
  userInterests,
  users,
  type FeedbackTip,
} from "@/db/schema";
import { eq, desc, and, or, gt, isNull, inArray, sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { log, errAttrs } from "@/lib/logger";
import { z } from "zod";
import type { TipComment } from "./feedback-tips";

const updateStatusSchema = z.object({
  tipId: z.string().uuid(),
  status: z.enum([
    "open",
    "triaged",
    "in_progress",
    "done",
    "wont_fix",
    "duplicate",
  ]),
});

const updateSeveritySchema = z.object({
  tipId: z.string().uuid(),
  severity: z.enum(["blocker", "high", "medium", "low"]),
});

const FINAL_STATUSES: ReadonlySet<string> = new Set([
  "done",
  "wont_fix",
  "duplicate",
]);

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function updateTipStatus(
  input: z.infer<typeof updateStatusSchema>,
): Promise<ActionResult> {
  try {
    const { user } = await requireAdmin();
    const parsed = updateStatusSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Ogiltig statusändring" };
    }

    const { tipId, status } = parsed.data;
    const isFinal = FINAL_STATUSES.has(status);

    await db
      .update(feedbackTips)
      .set({
        status,
        resolvedAt: isFinal ? new Date() : null,
        resolvedBy: isFinal ? user.id : null,
        updatedAt: new Date(),
      })
      .where(eq(feedbackTips.id, tipId));

    log.info("feedback tip status updated", {
      tipId,
      status,
      adminId: user.id,
    });

    revalidatePath("/admin/feedback");
    revalidatePath("/mina-tips");
    return { success: true };
  } catch (error) {
    log.error("updateTipStatus error", errAttrs(error));
    return { success: false, error: "Något gick fel" };
  }
}

export async function updateTipSeverity(
  input: z.infer<typeof updateSeveritySchema>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = updateSeveritySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Ogiltig severity" };
    }

    await db
      .update(feedbackTips)
      .set({ severity: parsed.data.severity, updatedAt: new Date() })
      .where(eq(feedbackTips.id, parsed.data.tipId));

    revalidatePath("/admin/feedback");
    return { success: true };
  } catch (error) {
    log.error("updateTipSeverity error", errAttrs(error));
    return { success: false, error: "Något gick fel" };
  }
}


export interface AdminTipRow extends FeedbackTip {
  reporterEmail: string | null;
  reporterDisplayName: string | null;
  commentCount: number;
  hasUnread: boolean;
}

export type AdminStatusFilter =
  | "open"
  | "triaged"
  | "in_progress"
  | "done"
  | "wont_fix"
  | "duplicate"
  | "all"
  | "unread";

export interface ListTipsFilters {
  status?: AdminStatusFilter;
  kind?: "bug" | "idea" | "interest" | "all";
}

export async function listFeedbackTips(
  filters: ListTipsFilters = {},
): Promise<AdminTipRow[]> {
  const { user } = await requireAdmin();

  const whereClauses: SQL[] = [];
  if (
    filters.status &&
    filters.status !== "all" &&
    filters.status !== "unread"
  ) {
    whereClauses.push(eq(feedbackTips.status, filters.status));
  }
  if (filters.kind && filters.kind !== "all") {
    whereClauses.push(eq(feedbackTips.kind, filters.kind));
  }
  if (filters.status === "unread") {
    // Olästa: ingen view-rad alls för denna admin ELLER tipset har rörts
    // sen senaste besöket.
    whereClauses.push(
      or(
        isNull(feedbackTipViews.lastViewedAt),
        gt(feedbackTips.lastActivityAt, feedbackTipViews.lastViewedAt),
      )!,
    );
  }
  const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

  const rows = await db
    .select({
      tip: feedbackTips,
      reporterEmail: users.email,
      reporterDisplayName: users.displayName,
      lastViewedAt: feedbackTipViews.lastViewedAt,
    })
    .from(feedbackTips)
    .leftJoin(users, eq(feedbackTips.reporterId, users.id))
    .leftJoin(
      feedbackTipViews,
      and(
        eq(feedbackTipViews.tipId, feedbackTips.id),
        eq(feedbackTipViews.userId, user.id),
      ),
    )
    .where(where)
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
        rows.map((r) => r.tip.id),
      ),
    )
    .groupBy(feedbackTipComments.tipId);

  const countMap = new Map(counts.map((c) => [c.tipId, c.count]));

  return rows.map((r) => ({
    ...r.tip,
    reporterEmail: r.reporterEmail,
    reporterDisplayName: r.reporterDisplayName,
    commentCount: countMap.get(r.tip.id) ?? 0,
    hasUnread:
      r.lastViewedAt === null ||
      r.tip.lastActivityAt.getTime() > r.lastViewedAt.getTime(),
  }));
}

// Laddas av admin-modalen on-demand när en rad öppnas. Snabbare än att
// joina alla kommentarer i listan. Sidoeffekt: markerar tipset som läst
// för adminens räkning, så badge:n släcks.
export async function getTipCommentsForAdmin(
  tipId: string,
): Promise<TipComment[]> {
  const { user } = await requireAdmin();

  const tip = await db.query.feedbackTips.findFirst({
    where: eq(feedbackTips.id, tipId),
  });
  if (!tip) return [];

  await db
    .insert(feedbackTipViews)
    .values({ userId: user.id, tipId })
    .onConflictDoUpdate({
      target: [feedbackTipViews.userId, feedbackTipViews.tipId],
      set: { lastViewedAt: new Date() },
    });
  revalidatePath("/admin/feedback");

  const rows = await db
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

  return rows.map((c) => ({
    ...c,
    authorIsAdmin: c.authorIsAdmin ?? false,
    isReporter: c.authorId === tip.reporterId,
  }));
}

// ─── Intresseförslag ────────────────────────────────────────────────────

export interface AdminInterestSuggestion {
  id: string;
  tipId: string;
  reporterId: string;
  name: string;
  status: "pending" | "approved" | "rejected" | "duplicate";
  decisionReason: string | null;
  decidedAt: Date | null;
  approvedAsTagId: number | null;
  approvedAsTagName: string | null;
}

export async function getInterestSuggestionsForAdmin(
  tipId: string,
): Promise<AdminInterestSuggestion[]> {
  await requireAdmin();

  const rows = await db
    .select({
      id: feedbackTipInterestSuggestions.id,
      tipId: feedbackTipInterestSuggestions.tipId,
      reporterId: feedbackTips.reporterId,
      name: feedbackTipInterestSuggestions.name,
      status: feedbackTipInterestSuggestions.status,
      decisionReason: feedbackTipInterestSuggestions.decisionReason,
      decidedAt: feedbackTipInterestSuggestions.decidedAt,
      approvedAsTagId: feedbackTipInterestSuggestions.approvedAsTagId,
      approvedAsTagName: interestTags.name,
    })
    .from(feedbackTipInterestSuggestions)
    .innerJoin(
      feedbackTips,
      eq(feedbackTipInterestSuggestions.tipId, feedbackTips.id),
    )
    .leftJoin(
      interestTags,
      eq(feedbackTipInterestSuggestions.approvedAsTagId, interestTags.id),
    )
    .where(eq(feedbackTipInterestSuggestions.tipId, tipId))
    .orderBy(feedbackTipInterestSuggestions.createdAt);

  return rows;
}

const updateSuggestionNameSchema = z.object({
  suggestionId: z.string().uuid(),
  name: z.string().trim().min(2).max(60),
});

export async function updateSuggestionName(
  input: z.infer<typeof updateSuggestionNameSchema>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = updateSuggestionNameSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Ogiltigt namn" };
    }

    await db
      .update(feedbackTipInterestSuggestions)
      .set({ name: parsed.data.name })
      .where(eq(feedbackTipInterestSuggestions.id, parsed.data.suggestionId));

    revalidatePath("/admin/feedback");
    revalidatePath("/mina-tips");
    return { success: true };
  } catch (error) {
    log.error("updateSuggestionName error", errAttrs(error));
    return { success: false, error: "Något gick fel" };
  }
}

// Slugifierar svensk-vänligt: lowercase + å/ä → a, ö → o, övriga
// non-alphanumeric → bindestreck, trim. "Motion & Träning" → "motion-traning".
function slugifyInterest(name: string): string {
  return name
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[éè]/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const approveSuggestionSchema = z.object({
  suggestionId: z.string().uuid(),
});

export async function approveInterestSuggestion(
  input: z.infer<typeof approveSuggestionSchema>,
): Promise<ActionResult> {
  try {
    const { user } = await requireAdmin();
    const parsed = approveSuggestionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Ogiltigt förslag" };
    }

    const suggestion = await db.query.feedbackTipInterestSuggestions.findFirst({
      where: eq(feedbackTipInterestSuggestions.id, parsed.data.suggestionId),
    });
    if (!suggestion) return { success: false, error: "Förslaget hittades inte" };
    if (suggestion.status !== "pending") {
      return { success: false, error: "Förslaget är redan hanterat" };
    }

    const trimmedName = suggestion.name.trim();
    if (trimmedName.length < 2) {
      return { success: false, error: "Namnet är för kort" };
    }
    const slug = slugifyInterest(trimmedName);
    if (slug.length === 0) {
      return { success: false, error: "Kunde inte skapa slug från namnet" };
    }

    // ON CONFLICT (slug) DO NOTHING returnerar inget vid konflikt, så vi
    // letar upp existerande raden separat om insert inte gav någon rad.
    const inserted = await db
      .insert(interestTags)
      .values({ name: trimmedName, slug })
      .onConflictDoNothing({ target: interestTags.slug })
      .returning({ id: interestTags.id });

    let tagId: number;
    let wasNew = false;
    if (inserted.length > 0) {
      tagId = inserted[0].id;
      wasNew = true;
    } else {
      const existing = await db.query.interestTags.findFirst({
        where: eq(interestTags.slug, slug),
      });
      if (!existing) {
        return { success: false, error: "Kunde inte hitta tagg efter konflikt" };
      }
      tagId = existing.id;
    }

    await db
      .update(feedbackTipInterestSuggestions)
      .set({
        status: wasNew ? "approved" : "duplicate",
        approvedAsTagId: tagId,
        decidedAt: new Date(),
        decidedBy: user.id,
      })
      .where(eq(feedbackTipInterestSuggestions.id, parsed.data.suggestionId));

    // Lägg automatiskt till taggen i rapportörens egna intressen, så de
    // ser den direkt nästa gång de filtrerar. user_interests har composite
    // PK på (user_id, tag_id), så ON CONFLICT DO NOTHING fångar dubbletter.
    const tip = await db.query.feedbackTips.findFirst({
      where: eq(feedbackTips.id, suggestion.tipId),
    });
    if (tip) {
      await db
        .insert(userInterests)
        .values({ userId: tip.reporterId, tagId })
        .onConflictDoNothing();
    }

    log.info("interest suggestion approved", {
      suggestionId: parsed.data.suggestionId,
      tagId,
      wasNew,
      adminId: user.id,
    });

    revalidatePath("/admin/feedback");
    revalidatePath("/mina-tips");
    return { success: true };
  } catch (error) {
    log.error("approveInterestSuggestion error", errAttrs(error));
    return { success: false, error: "Något gick fel" };
  }
}

const rejectSuggestionSchema = z.object({
  suggestionId: z.string().uuid(),
  reason: z.string().max(400).optional(),
});

export async function rejectInterestSuggestion(
  input: z.infer<typeof rejectSuggestionSchema>,
): Promise<ActionResult> {
  try {
    const { user } = await requireAdmin();
    const parsed = rejectSuggestionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Ogiltigt förslag" };
    }

    await db
      .update(feedbackTipInterestSuggestions)
      .set({
        status: "rejected",
        decisionReason: parsed.data.reason ?? null,
        decidedAt: new Date(),
        decidedBy: user.id,
      })
      .where(eq(feedbackTipInterestSuggestions.id, parsed.data.suggestionId));

    revalidatePath("/admin/feedback");
    revalidatePath("/mina-tips");
    return { success: true };
  } catch (error) {
    log.error("rejectInterestSuggestion error", errAttrs(error));
    return { success: false, error: "Något gick fel" };
  }
}
