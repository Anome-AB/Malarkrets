import { db } from "@/lib/db";
import {
  activities,
  activityTags,
  userInterests,
  userBlocks,
} from "@/db/schema";
import { sql, eq, and, gt, or, isNull, ne, count, desc, asc } from "drizzle-orm";

// Map user gender to activity restriction enum
// User gender: man/kvinna/ej_angett → Activity restriction: man/kvinnor/alla
function genderToRestriction(gender: string | null): string | null {
  if (gender === "man") return "man";
  if (gender === "kvinna") return "kvinnor";
  return null; // ej_angett or null can only see "alla"
}

export async function getMatchedActivities(
  userId: string,
  viewerGender: string | null,
  viewerAge: number | null,
  cursor?: string,
  tagFilter?: number,
) {
  const now = new Date();
  const viewerRestriction = genderToRestriction(viewerGender);

  // Subquery: activities where creator blocked the viewer
  const blockedByCreator = db
    .select({ blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerId, activities.creatorId!),
        eq(userBlocks.blockedId, userId),
      ),
    );

  // Subquery: activities where viewer blocked the creator
  const blockedByViewer = db
    .select({ blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerId, userId),
        eq(userBlocks.blockedId, activities.creatorId!),
      ),
    );

  const relevanceCount = sql<number>`count(${activityTags.tagId})`.as(
    "relevance",
  );

  let query = db
    .select({
      id: activities.id,
      title: activities.title,
      description: activities.description,
      location: activities.location,
      startTime: activities.startTime,
      endTime: activities.endTime,
      imageThumbUrl: activities.imageThumbUrl,
      maxParticipants: activities.maxParticipants,
      genderRestriction: activities.genderRestriction,
      minAge: activities.minAge,
      whatToExpect: activities.whatToExpect,
      creatorId: activities.creatorId,
      createdAt: activities.createdAt,
      relevance: relevanceCount,
    })
    .from(activities)
    .innerJoin(activityTags, eq(activityTags.activityId, activities.id))
    .innerJoin(
      userInterests,
      and(
        eq(userInterests.tagId, activityTags.tagId),
        eq(userInterests.userId, userId),
      ),
    )
    .where(
      and(
        // Exclude past activities
        gt(activities.startTime, now),
        // Exclude if creator blocked viewer
        sql`NOT EXISTS (${blockedByCreator})`,
        // Exclude if viewer blocked creator
        sql`NOT EXISTS (${blockedByViewer})`,
        // Gender restriction filter
        viewerRestriction
          ? or(
              eq(activities.genderRestriction, "alla"),
              eq(activities.genderRestriction, viewerRestriction as any),
            )
          : eq(activities.genderRestriction, "alla"),
        // Min age filter
        viewerAge !== null
          ? or(isNull(activities.minAge), sql`${activities.minAge} <= ${viewerAge}`)
          : isNull(activities.minAge),
        // Don't show own activities
        ne(activities.creatorId!, userId),
        // Specific tag filter
        ...(tagFilter !== undefined
          ? [eq(activityTags.tagId, tagFilter)]
          : []),
        // Cursor-based pagination
        ...(cursor
          ? [gt(activities.id, cursor)]
          : []),
      ),
    )
    .groupBy(activities.id)
    .orderBy(desc(relevanceCount), asc(activities.startTime))
    .limit(20);

  return query;
}
