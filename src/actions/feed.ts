"use server";

import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, interestTags, userInterests } from "@/db/schema";
import {
  FEED_PAGE_SIZE,
  getMatchedActivities,
} from "@/lib/queries/activity-feed";
import {
  enrichFeedActivities,
  type EnrichedFeedActivity,
} from "@/lib/queries/activity-feed-enrich";
import { log, errAttrs } from "@/lib/logger";

export type LoadMoreFeedInput = {
  offset: number;
  intresse: string[]; // slugs
  alla: boolean;
};

export type LoadMoreFeedResult =
  | { ok: true; activities: EnrichedFeedActivity[]; hasMore: boolean }
  | { ok: false; error: string };

/**
 * Load the next page of the activity feed. Called from the client when the
 * sentinel element at the bottom of the list becomes visible. Matches the
 * first-page query on the server so filtering/sorting stays consistent.
 */
export async function loadMoreFeed(
  input: LoadMoreFeedInput,
): Promise<LoadMoreFeedResult> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { ok: false, error: "Inte inloggad" };

    const userProfile = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        gender: true,
        birthDate: true,
        isAdmin: true,
      },
    });
    if (!userProfile) return { ok: false, error: "Användare saknas" };

    let viewerAge: number | null = null;
    if (userProfile.birthDate) {
      viewerAge = Math.floor(
        (Date.now() - new Date(userProfile.birthDate).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      );
    }

    let tagFilterIds: number[] | undefined;
    if (input.intresse.length > 0) {
      const tags = await db
        .select({ id: interestTags.id, slug: interestTags.slug })
        .from(userInterests)
        .innerJoin(
          interestTags,
          eq(interestTags.id, userInterests.tagId),
        )
        .where(eq(userInterests.userId, userId));
      const ids = input.intresse
        .map((slug) => tags.find((t) => t.slug === slug)?.id)
        .filter((id): id is number => id !== undefined);
      if (ids.length > 0) tagFilterIds = ids;
    }

    // Mirror page.tsx rule: showAll is admin-only today.
    const showAll = userProfile.isAdmin && input.alla;

    const rows = await getMatchedActivities(
      userId,
      userProfile.gender,
      viewerAge,
      Math.max(0, input.offset),
      tagFilterIds,
      showAll,
    );

    const enriched = await enrichFeedActivities(rows, userId);

    return {
      ok: true,
      activities: enriched,
      hasMore: enriched.length === FEED_PAGE_SIZE,
    };
  } catch (err) {
    log.error("loadMoreFeed failed", errAttrs(err));
    return { ok: false, error: "Kunde inte hämta fler aktiviteter" };
  }
}
