import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getUserShellData } from "@/lib/queries/user-shell-data";
import { AppShell } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import {
  activities,
  activityTags,
  activityParticipants,
  interestTags,
} from "@/db/schema";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import { MyActivitiesClient } from "./my-activities-client";

export const metadata: Metadata = {
  title: "Mina aktiviteter - Malarkrets",
};

async function getCreatedActivities(userId: string) {
  const rows = await db
    .select({
      id: activities.id,
      title: activities.title,
      description: activities.description,
      location: activities.location,
      startTime: activities.startTime,
      imageThumbUrl: activities.imageThumbUrl,
      maxParticipants: activities.maxParticipants,
      whatToExpect: activities.whatToExpect,
      cancelledAt: activities.cancelledAt,
      cancelledReason: activities.cancelledReason,
    })
    .from(activities)
    .where(eq(activities.creatorId, userId))
    .orderBy(desc(activities.startTime));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  // Tags
  const tagRows = await db
    .select({
      activityId: activityTags.activityId,
      tagId: interestTags.id,
      tagName: interestTags.name,
      tagSlug: interestTags.slug,
    })
    .from(activityTags)
    .innerJoin(interestTags, eq(interestTags.id, activityTags.tagId))
    .where(
      sql`${activityTags.activityId} IN (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );

  // Participant counts (only attending)
  const participantRows = await db
    .select({
      activityId: activityParticipants.activityId,
      count: count(),
    })
    .from(activityParticipants)
    .where(
      and(
        sql`${activityParticipants.activityId} IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})`,
        eq(activityParticipants.status, "attending"),
      ),
    )
    .groupBy(activityParticipants.activityId);

  const tagsByActivity = new Map<
    string,
    Array<{ id: number; name: string; slug: string }>
  >();
  for (const row of tagRows) {
    const existing = tagsByActivity.get(row.activityId) ?? [];
    existing.push({ id: row.tagId, name: row.tagName, slug: row.tagSlug });
    tagsByActivity.set(row.activityId, existing);
  }

  const countByActivity = new Map<string, number>();
  for (const row of participantRows) {
    countByActivity.set(row.activityId, row.count);
  }

  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    location: a.location,
    startTime: a.startTime,
    imageThumbUrl: a.imageThumbUrl,
    maxParticipants: a.maxParticipants,
    whatToExpect: a.whatToExpect as {
      okAlone?: boolean;
      experienceLevel?: string;
      whoComes?: string;
      latePolicy?: string;
      groupSize?: string;
    } | null,
    tags: tagsByActivity.get(a.id) ?? [],
    participantCount: countByActivity.get(a.id) ?? 0,
    cancelledAt: a.cancelledAt,
    cancelledReason: a.cancelledReason,
  }));
}

async function getParticipatingActivities(userId: string) {
  const rows = await db
    .select({
      id: activities.id,
      title: activities.title,
      description: activities.description,
      location: activities.location,
      startTime: activities.startTime,
      imageThumbUrl: activities.imageThumbUrl,
      maxParticipants: activities.maxParticipants,
      whatToExpect: activities.whatToExpect,
      cancelledAt: activities.cancelledAt,
      cancelledReason: activities.cancelledReason,
      status: activityParticipants.status,
    })
    .from(activityParticipants)
    .innerJoin(activities, eq(activities.id, activityParticipants.activityId))
    .where(eq(activityParticipants.userId, userId))
    .orderBy(asc(activities.startTime));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  // Tags
  const tagRows = await db
    .select({
      activityId: activityTags.activityId,
      tagId: interestTags.id,
      tagName: interestTags.name,
      tagSlug: interestTags.slug,
    })
    .from(activityTags)
    .innerJoin(interestTags, eq(interestTags.id, activityTags.tagId))
    .where(
      sql`${activityTags.activityId} IN (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );

  // Participant counts (only attending)
  const participantRows = await db
    .select({
      activityId: activityParticipants.activityId,
      count: count(),
    })
    .from(activityParticipants)
    .where(
      and(
        sql`${activityParticipants.activityId} IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})`,
        eq(activityParticipants.status, "attending"),
      ),
    )
    .groupBy(activityParticipants.activityId);

  const tagsByActivity = new Map<
    string,
    Array<{ id: number; name: string; slug: string }>
  >();
  for (const row of tagRows) {
    const existing = tagsByActivity.get(row.activityId) ?? [];
    existing.push({ id: row.tagId, name: row.tagName, slug: row.tagSlug });
    tagsByActivity.set(row.activityId, existing);
  }

  const countByActivity = new Map<string, number>();
  for (const row of participantRows) {
    countByActivity.set(row.activityId, row.count);
  }

  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    location: a.location,
    startTime: a.startTime,
    imageThumbUrl: a.imageThumbUrl,
    maxParticipants: a.maxParticipants,
    whatToExpect: a.whatToExpect as {
      okAlone?: boolean;
      experienceLevel?: string;
      whoComes?: string;
      latePolicy?: string;
      groupSize?: string;
    } | null,
    tags: tagsByActivity.get(a.id) ?? [],
    participantCount: countByActivity.get(a.id) ?? 0,
    cancelledAt: a.cancelledAt,
    cancelledReason: a.cancelledReason,
    status: a.status as "interested" | "attending",
  }));
}

export default async function MyActivitiesPage() {
  const user = await requireAuth();
  const shellData = await getUserShellData(user.id);

  if (!shellData.userProfile) {
    redirect("/api/auth/signout");
  }

  const [createdActivities, participatingActivities] = await Promise.all([
    getCreatedActivities(user.id),
    getParticipatingActivities(user.id),
  ]);

  return (
    <AppShell
      interests={shellData.interests}
      unreadCount={shellData.unreadCount}
      userInitials={shellData.initials}
      isAdmin={shellData.isAdmin}
    >
      <MyActivitiesClient
        createdActivities={createdActivities}
        participatingActivities={participatingActivities}
      />
    </AppShell>
  );
}
