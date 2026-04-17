import { db } from "@/lib/db";
import {
  activities,
  activityTags,
  userInterests,
  userBlocks,
  users,
} from "@/db/schema";
import {
  sql,
  eq,
  and,
  gt,
  or,
  isNull,
  inArray,
  count,
  desc,
  asc,
} from "drizzle-orm";

// Map user gender to activity restriction enum
// User gender: man/kvinna/ej_angett → Activity restriction: man/kvinnor/alla
function genderToRestriction(gender: string | null): "man" | "kvinnor" | null {
  if (gender === "man") return "man";
  if (gender === "kvinna") return "kvinnor";
  return null; // ej_angett or null can only see "alla"
}

export async function getMatchedActivities(
  userId: string,
  viewerGender: string | null,
  viewerAge: number | null,
  cursor?: string,
  tagFilter?: number[],
  showAll?: boolean,
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

  const selectFields = {
    id: activities.id,
    title: activities.title,
    description: activities.description,
    location: activities.location,
    startTime: activities.startTime,
    endTime: activities.endTime,
    imageThumbUrl: activities.imageThumbUrl,
    colorTheme: activities.colorTheme,
    maxParticipants: activities.maxParticipants,
    genderRestriction: activities.genderRestriction,
    minAge: activities.minAge,
    whatToExpect: activities.whatToExpect,
    creatorId: activities.creatorId,
    createdAt: activities.createdAt,
    relevance: relevanceCount,
  };

  const baseConditions = [
    isNull(activities.deletedAt),
    isNull(activities.cancelledAt),
    gt(activities.startTime, now),
    sql`NOT EXISTS (${blockedByCreator})`,
    sql`NOT EXISTS (${blockedByViewer})`,
    // Hide activities from banned creators
    sql`NOT EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${activities.creatorId} AND ${users.isBanned} = true)`,
    ...(cursor ? [gt(activities.id, cursor)] : []),
  ];

  // When showAll (admin mode), skip interest matching and gender/age restrictions
  if (showAll) {
    const tagFilterConditions = tagFilter
      ? [inArray(activityTags.tagId, tagFilter)]
      : [];

    return db
      .select(selectFields)
      .from(activities)
      .innerJoin(activityTags, eq(activityTags.activityId, activities.id))
      .where(and(...baseConditions, ...tagFilterConditions))
      .groupBy(activities.id)
      .orderBy(asc(activities.startTime))
      .limit(20);
  }

  return db
    .select(selectFields)
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
        ...baseConditions,
        // Gender restriction filter
        viewerRestriction
          ? or(
              eq(activities.genderRestriction, "alla"),
              eq(activities.genderRestriction, viewerRestriction),
            )
          : eq(activities.genderRestriction, "alla"),
        // Min age filter
        viewerAge !== null
          ? or(isNull(activities.minAge), sql`${activities.minAge} <= ${viewerAge}`)
          : isNull(activities.minAge),
        // Specific tag filter
        ...(tagFilter
          ? [inArray(activityTags.tagId, tagFilter)]
          : []),
      ),
    )
    .groupBy(activities.id)
    .orderBy(desc(relevanceCount), asc(activities.startTime))
    .limit(20);
}
