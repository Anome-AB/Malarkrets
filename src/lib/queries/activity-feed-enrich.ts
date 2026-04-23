import { db } from "@/lib/db";
import {
  activityParticipants,
  activityTags,
  interestTags,
} from "@/db/schema";
import { and, count, eq, sql } from "drizzle-orm";

export interface EnrichedFeedActivity {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date | null;
  imageThumbUrl: string | null;
  imageAccentColor: string | null;
  colorTheme: string | null;
  genderRestriction: "alla" | "kvinnor" | "man" | null;
  maxParticipants: number | null;
  whatToExpect: unknown;
  tags: Array<{ id: number; name: string; slug: string }>;
  participantCount: number;
  creatorId: string | null;
  userStatus: "interested" | "attending" | null;
}

// Shape the feed-query rows arrive in.
interface RawFeedActivity {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date | null;
  imageThumbUrl: string | null;
  imageAccentColor: string | null;
  colorTheme: string | null;
  genderRestriction: "alla" | "kvinnor" | "man" | null;
  maxParticipants: number | null;
  minAge: number | null;
  whatToExpect: unknown;
  creatorId: string | null;
}

/**
 * Attach tags, attending-participant-count, and the viewer's participation
 * status to a batch of feed-query rows. Same logic the home page used
 * inline; extracted so the lazy-load server action can reuse it.
 *
 * Expects `activities` already filtered/sorted by the caller.
 */
export async function enrichFeedActivities(
  rawActivities: RawFeedActivity[],
  viewerUserId: string,
): Promise<EnrichedFeedActivity[]> {
  if (rawActivities.length === 0) return [];

  const activityIds = rawActivities.map((a) => a.id);

  const inIds = sql`${activityTags.activityId} IN (${sql.join(activityIds.map((id) => sql`${id}`), sql`, `)})`;

  const tagRows = await db
    .select({
      activityId: activityTags.activityId,
      tagId: interestTags.id,
      tagName: interestTags.name,
      tagSlug: interestTags.slug,
    })
    .from(activityTags)
    .innerJoin(interestTags, eq(interestTags.id, activityTags.tagId))
    .where(inIds);

  const inParticipantIds = sql`${activityParticipants.activityId} IN (${sql.join(activityIds.map((id) => sql`${id}`), sql`, `)})`;

  const participantRows = await db
    .select({
      activityId: activityParticipants.activityId,
      count: count(),
    })
    .from(activityParticipants)
    .where(
      and(
        inParticipantIds,
        eq(activityParticipants.status, "attending"),
      ),
    )
    .groupBy(activityParticipants.activityId);

  const userParticipationRows = await db
    .select({
      activityId: activityParticipants.activityId,
      status: activityParticipants.status,
    })
    .from(activityParticipants)
    .where(
      and(
        inParticipantIds,
        eq(activityParticipants.userId, viewerUserId),
      ),
    );

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

  const userStatusByActivity = new Map<string, "interested" | "attending">();
  for (const row of userParticipationRows) {
    userStatusByActivity.set(
      row.activityId,
      row.status as "interested" | "attending",
    );
  }

  return rawActivities.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    location: a.location,
    startTime: a.startTime,
    endTime: a.endTime,
    imageThumbUrl: a.imageThumbUrl,
    imageAccentColor: a.imageAccentColor,
    colorTheme: a.colorTheme,
    genderRestriction: a.genderRestriction,
    maxParticipants: a.maxParticipants,
    whatToExpect: a.whatToExpect,
    tags: tagsByActivity.get(a.id) ?? [],
    participantCount: countByActivity.get(a.id) ?? 0,
    creatorId: a.creatorId,
    userStatus: userStatusByActivity.get(a.id) ?? null,
  }));
}
