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
  asc,
} from "drizzle-orm";

export const FEED_PAGE_SIZE = 50;

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
  offset: number = 0,
  tagFilter?: number[],
  showAll?: boolean,
  isAdmin?: boolean,
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

  const selectFields = {
    id: activities.id,
    title: activities.title,
    description: activities.description,
    location: activities.location,
    startTime: activities.startTime,
    endTime: activities.endTime,
    imageThumbUrl: activities.imageThumbUrl,
    imageAccentColor: activities.imageAccentColor,
    colorTheme: activities.colorTheme,
    genderRestriction: activities.genderRestriction,
    maxParticipants: activities.maxParticipants,
    minAge: activities.minAge,
    whatToExpect: activities.whatToExpect,
    creatorId: activities.creatorId,
    createdAt: activities.createdAt,
  };

  const baseConditions = [
    isNull(activities.deletedAt),
    isNull(activities.cancelledAt),
    gt(activities.startTime, now),
    sql`NOT EXISTS (${blockedByCreator})`,
    sql`NOT EXISTS (${blockedByViewer})`,
    // Hide activities from banned creators
    sql`NOT EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${activities.creatorId} AND ${users.isBanned} = true)`,
  ];

  // "Visa alla" modes:
  //  - Admin: bypass interest matching AND gender/age restrictions (moderation view).
  //  - Regular user: bypass interest matching only; gender/age are still enforced
  //    so a man does not see kvinnor-only activities and under-age viewers do not
  //    see minAge-gated activities.
  // Always sort chronologically by startTime so newly-created activities in
  // the future land where their date actually is, not at the top. Offset-based
  // pagination keeps this correct across lazy-loaded pages.
  if (showAll) {
    const tagFilterConditions = tagFilter
      ? [inArray(activityTags.tagId, tagFilter)]
      : [];

    const restrictionConditions = isAdmin
      ? []
      : [
          viewerRestriction
            ? or(
                eq(activities.genderRestriction, "alla"),
                eq(activities.genderRestriction, viewerRestriction),
              )
            : eq(activities.genderRestriction, "alla"),
          viewerAge !== null
            ? or(
                isNull(activities.minAge),
                sql`${activities.minAge} <= ${viewerAge}`,
              )
            : isNull(activities.minAge),
        ];

    return db
      .select(selectFields)
      .from(activities)
      .innerJoin(activityTags, eq(activityTags.activityId, activities.id))
      .where(and(...baseConditions, ...restrictionConditions, ...tagFilterConditions))
      .groupBy(activities.id)
      .orderBy(asc(activities.startTime), asc(activities.id))
      .limit(FEED_PAGE_SIZE)
      .offset(offset);
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
    .orderBy(asc(activities.startTime), asc(activities.id))
    .limit(FEED_PAGE_SIZE)
    .offset(offset);
}
