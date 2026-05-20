"use server";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  feedbackTips,
  users,
  type FeedbackTip,
} from "@/db/schema";
import { eq, desc, and, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { log, errAttrs } from "@/lib/logger";
import { z } from "zod";

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
  adminNotes: z.string().max(4000).optional(),
});

const updateSeveritySchema = z.object({
  tipId: z.string().uuid(),
  severity: z.enum(["blocker", "high", "medium", "low"]),
});

const updateNotesSchema = z.object({
  tipId: z.string().uuid(),
  adminNotes: z.string().max(4000),
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

    const { tipId, status, adminNotes } = parsed.data;
    const isFinal = FINAL_STATUSES.has(status);

    await db
      .update(feedbackTips)
      .set({
        status,
        adminNotes,
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

export async function updateTipNotes(
  input: z.infer<typeof updateNotesSchema>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = updateNotesSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Ogiltig anteckning" };
    }

    await db
      .update(feedbackTips)
      .set({ adminNotes: parsed.data.adminNotes, updatedAt: new Date() })
      .where(eq(feedbackTips.id, parsed.data.tipId));

    revalidatePath("/admin/feedback");
    revalidatePath("/mina-tips");
    return { success: true };
  } catch (error) {
    log.error("updateTipNotes error", errAttrs(error));
    return { success: false, error: "Något gick fel" };
  }
}

export interface AdminTipRow extends FeedbackTip {
  reporterEmail: string | null;
  reporterDisplayName: string | null;
}

export interface ListTipsFilters {
  status?: "open" | "triaged" | "in_progress" | "done" | "wont_fix" | "duplicate" | "all";
  kind?: "bug" | "idea" | "all";
}

export async function listFeedbackTips(
  filters: ListTipsFilters = {},
): Promise<AdminTipRow[]> {
  await requireAdmin();

  const whereClauses: SQL[] = [];
  if (filters.status && filters.status !== "all") {
    whereClauses.push(eq(feedbackTips.status, filters.status));
  }
  if (filters.kind && filters.kind !== "all") {
    whereClauses.push(eq(feedbackTips.kind, filters.kind));
  }
  const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

  const rows = await db
    .select({
      tip: feedbackTips,
      reporterEmail: users.email,
      reporterDisplayName: users.displayName,
    })
    .from(feedbackTips)
    .leftJoin(users, eq(feedbackTips.reporterId, users.id))
    .where(where)
    .orderBy(desc(feedbackTips.createdAt));

  return rows.map((r) => ({
    ...r.tip,
    reporterEmail: r.reporterEmail,
    reporterDisplayName: r.reporterDisplayName,
  }));
}
