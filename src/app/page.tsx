import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activities,
  activityParticipants,
  activityTags,
  interestTags,
  userInterests,
  users,
} from "@/db/schema";
import { eq, gt, count, desc, sql } from "drizzle-orm";
import { getMatchedActivities } from "@/lib/queries/activity-feed";
import { getNotificationCount } from "@/lib/queries/notifications";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "./activity-feed-client";

async function getPopularActivities() {
  const now = new Date();
  const results = await db
    .select({
      id: activities.id,
      title: activities.title,
      description: activities.description,
      location: activities.location,
      startTime: activities.startTime,
      imageThumbUrl: activities.imageThumbUrl,
      participantCount: count(activityParticipants.userId),
    })
    .from(activities)
    .leftJoin(
      activityParticipants,
      eq(activityParticipants.activityId, activities.id),
    )
    .where(gt(activities.startTime, now))
    .groupBy(activities.id)
    .orderBy(desc(count(activityParticipants.userId)))
    .limit(3);

  return results;
}

function LandingPage({
  popularActivities,
}: {
  popularActivities: Awaited<ReturnType<typeof getPopularActivities>>;
}) {
  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      <header className="bg-[#3d6b5e] text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl font-bold mb-3">Mälarkrets</h1>
          <p className="text-xl text-white/80 mb-8">
            Hitta ditt sammanhang
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-[#3d6b5e] font-semibold rounded-lg hover:bg-white/90 transition-colors"
            >
              Logga in
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              Registrera dig
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-[#2d2d2d] mb-6">
          Populära aktiviteter i Västerås
        </h2>
        {popularActivities.length === 0 ? (
          <p className="text-[#666666]">
            Inga kommande aktiviteter just nu. Bli den första att skapa en!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {popularActivities.map((activity) => (
              <Link
                key={activity.id}
                href={`/activity/${activity.id}`}
                className="bg-white border border-[#dddddd] rounded-[10px] p-4 hover:shadow-md hover:border-[#3d6b5e] transition block"
              >
                {activity.imageThumbUrl && (
                  <img
                    src={activity.imageThumbUrl}
                    alt=""
                    className="w-full h-40 object-cover rounded-lg mb-3"
                  />
                )}
                <h3 className="text-base font-semibold text-[#2d2d2d]">
                  {activity.title}
                </h3>
                <p className="text-sm text-[#666666] mt-1 line-clamp-2">
                  {activity.description}
                </p>
                <p className="text-sm text-[#666666] mt-2">
                  {new Date(activity.startTime).toLocaleDateString("sv-SE", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  &middot; {activity.location}
                </p>
                <p className="text-xs text-[#3d6b5e] mt-2 font-medium">
                  {activity.participantCount} deltagare
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="p-6">
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-[10px]" />
        ))}
      </div>
    </div>
  );
}

async function AuthenticatedFeed({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = (await auth())!;
  const userId = session.user!.id!;
  const params = await searchParams;

  // Get user profile for filtering
  const userProfile = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!userProfile) {
    return null;
  }

  // Calculate age
  let viewerAge: number | null = null;
  if (userProfile.birthDate) {
    viewerAge = Math.floor(
      (Date.now() - new Date(userProfile.birthDate).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000),
    );
  }

  // Get user interests for sidebar
  const userInterestsList = await db
    .select({
      id: interestTags.id,
      name: interestTags.name,
      slug: interestTags.slug,
    })
    .from(userInterests)
    .innerJoin(interestTags, eq(interestTags.id, userInterests.tagId))
    .where(eq(userInterests.userId, userId));

  // Determine active tag filter
  const interestParam = typeof params.intresse === "string" ? params.intresse : null;
  let tagFilter: number | undefined;
  if (interestParam) {
    const matchedTag = userInterestsList.find((t) => t.slug === interestParam);
    if (matchedTag) tagFilter = matchedTag.id;
  }

  // Cursor pagination
  const cursor = typeof params.cursor === "string" ? params.cursor : undefined;

  // Get matched activities
  const matchedActivities = await getMatchedActivities(
    userId,
    userProfile.gender,
    viewerAge,
    cursor,
    tagFilter,
  );

  // Enrich with tags and participant counts
  const activityIds = matchedActivities.map((a) => a.id);
  let enrichedActivities: Array<{
    id: string;
    title: string;
    description: string;
    location: string;
    startTime: Date;
    imageThumbUrl: string | null;
    maxParticipants: number | null;
    whatToExpect: unknown;
    tags: Array<{ id: number; name: string; slug: string }>;
    participantCount: number;
    creatorId: string | null;
  }> = [];

  if (activityIds.length > 0) {
    // Get tags per activity
    const tagRows = await db
      .select({
        activityId: activityTags.activityId,
        tagId: interestTags.id,
        tagName: interestTags.name,
        tagSlug: interestTags.slug,
      })
      .from(activityTags)
      .innerJoin(interestTags, eq(interestTags.id, activityTags.tagId))
      .where(sql`${activityTags.activityId} IN (${sql.join(activityIds.map((id) => sql`${id}`), sql`, `)})`);

    // Get participant counts
    const participantRows = await db
      .select({
        activityId: activityParticipants.activityId,
        count: count(),
      })
      .from(activityParticipants)
      .where(sql`${activityParticipants.activityId} IN (${sql.join(activityIds.map((id) => sql`${id}`), sql`, `)})`)
      .groupBy(activityParticipants.activityId);

    const tagsByActivity = new Map<string, Array<{ id: number; name: string; slug: string }>>();
    for (const row of tagRows) {
      const existing = tagsByActivity.get(row.activityId) ?? [];
      existing.push({ id: row.tagId, name: row.tagName, slug: row.tagSlug });
      tagsByActivity.set(row.activityId, existing);
    }

    const countByActivity = new Map<string, number>();
    for (const row of participantRows) {
      countByActivity.set(row.activityId, row.count);
    }

    enrichedActivities = matchedActivities.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      location: a.location,
      startTime: a.startTime,
      imageThumbUrl: a.imageThumbUrl,
      maxParticipants: a.maxParticipants,
      whatToExpect: a.whatToExpect,
      tags: tagsByActivity.get(a.id) ?? [],
      participantCount: countByActivity.get(a.id) ?? 0,
      creatorId: a.creatorId,
    }));
  }

  const unreadCount = await getNotificationCount(userId);
  const userInitials =
    userProfile.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  const lastId =
    enrichedActivities.length > 0
      ? enrichedActivities[enrichedActivities.length - 1].id
      : null;

  return (
    <AppShell
      interests={userInterestsList}
      activeFilter={interestParam}
      unreadCount={unreadCount}
      userInitials={userInitials}
      isAdmin={userProfile.isAdmin}
    >
      <ActivityFeed
        initialActivities={enrichedActivities}
        userInterests={userInterestsList}
        activeFilter={interestParam}
        nextCursor={enrichedActivities.length === 20 ? lastId : null}
        userId={userId}
      />
    </AppShell>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (!session?.user) {
    const popularActivities = await getPopularActivities();
    return <LandingPage popularActivities={popularActivities} />;
  }

  return (
    <Suspense fallback={<FeedSkeleton />}>
      <AuthenticatedFeed searchParams={searchParams} />
    </Suspense>
  );
}
