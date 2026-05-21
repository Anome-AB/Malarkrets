import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activities,
  activityParticipants,
  interestTags,
  userInterests,
  users,
} from "@/db/schema";
import { eq, gt, and, isNull, isNotNull, count, desc, sql } from "drizzle-orm";
import {
  getMatchedActivities,
  FEED_PAGE_SIZE,
} from "@/lib/queries/activity-feed";
import { enrichFeedActivities } from "@/lib/queries/activity-feed-enrich";
import { stripHtmlForExcerpt } from "@/lib/rich-text";
import { getColorHex } from "@/lib/color-themes";

const NEUTRAL_ACCENT = "#7a8088";
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
      imageAccentColor: activities.imageAccentColor,
      colorTheme: activities.colorTheme,
      participantCount: count(activityParticipants.userId),
    })
    .from(activities)
    .leftJoin(
      activityParticipants,
      and(
        eq(activityParticipants.activityId, activities.id),
        eq(activityParticipants.status, "attending"),
      ),
    )
    .where(and(
      gt(activities.startTime, now),
      isNull(activities.cancelledAt),
      // Utkast (publishedAt IS NULL) ska inte hamna i "populära" eftersom
      // /activity/[id] returnerar 404 för icke-creator/non-admin.
      isNotNull(activities.publishedAt),
      sql`NOT EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${activities.creatorId} AND ${users.isBanned} = true)`,
    ))
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
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden text-white">
        {/* Background image with Ken Burns animation. `fill` lets it cover
            the hero regardless of viewport size; `priority` tells Next.js
            to preload it so LCP stays fast. Image is decorative (alt=""). */}
        <div className="absolute inset-0 ken-burns">
          <Image
            src="/hero/landing.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
        {/* Dark gradient overlay - darker at top and bottom so white text
            stays legible regardless of what part of the image shows through. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-3 drop-shadow-lg">Mälarkrets</h1>
          <p className="text-xl text-white/95 mb-2 drop-shadow">
            Hitta ditt sammanhang
          </p>
          <p className="text-sm text-white/85 mb-8 drop-shadow">
            Aktiviteter, träffar och upplevelser i Västerås
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-white/90 transition-colors shadow-lg"
            >
              Logga in
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors backdrop-blur-sm"
            >
              Registrera dig
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-heading mb-6">
          Populära aktiviteter i Västerås
        </h2>
        {popularActivities.length === 0 ? (
          <p className="text-secondary">
            Inga kommande aktiviteter just nu. Bli den första att skapa en!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {popularActivities.map((activity) => {
              // Bild eller gradient-fallback: matchar ActivityCard så att
              // bildlösa aktiviteter inte ser tomma ut.
              const themeHex = getColorHex(activity.colorTheme);
              const accent =
                activity.imageAccentColor ?? themeHex ?? NEUTRAL_ACCENT;
              const heroStyle: React.CSSProperties = activity.imageThumbUrl
                ? {
                    backgroundImage: `url(${activity.imageThumbUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {
                    backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${accent} 60%, white) 0%, ${accent} 55%, color-mix(in srgb, ${accent} 80%, black) 100%)`,
                  };
              const startDate = new Date(activity.startTime);
              const weekday = startDate
                .toLocaleDateString("sv-SE", { weekday: "short" })
                .replace(".", "");
              const day = String(startDate.getDate()).padStart(2, "0");
              const month = startDate
                .toLocaleDateString("sv-SE", { month: "short" })
                .replace(".", "");
              return (
              <Link
                key={activity.id}
                href={`/activity/${activity.id}`}
                className="bg-white border border-border rounded-card p-4 hover:shadow-md hover:border-primary transition block"
              >
                <div
                  className="relative w-full h-40 rounded-lg mb-3 overflow-hidden"
                  style={heroStyle}
                  aria-hidden="true"
                >
                  {/* Datum-badge i övre vänstra hörnet, samma struktur
                      som ActivityCards datumblock (weekday / day / month
                      i vit display-typografi). Backdrop-overlay för att
                      datumet ska kunna läsas mot både bild och gradient. */}
                  <div
                    className="absolute top-3 left-3 flex flex-col items-center text-white px-3 py-2 rounded-control"
                    style={{
                      backgroundColor: "rgba(0, 0, 0, 0.28)",
                      textShadow: "0 1px 6px rgba(0,0,0,0.35)",
                    }}
                  >
                    <span className="text-[10px] font-display font-bold uppercase tracking-[0.2em] leading-none">
                      {weekday}
                    </span>
                    <span className="font-display font-black text-[32px] leading-none my-1">
                      {day}
                    </span>
                    <span className="text-[10px] font-display font-bold uppercase tracking-[0.2em] leading-none">
                      {month}
                    </span>
                  </div>
                </div>
                <h3 className="text-base font-semibold text-heading">
                  {activity.title}
                </h3>
                <p className="text-sm text-secondary mt-1 line-clamp-2">
                  {stripHtmlForExcerpt(activity.description, 200)}
                </p>
                <p className="text-sm text-secondary mt-2">
                  {startDate.toLocaleTimeString("sv-SE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  &middot; {activity.location}
                </p>
                <p className="text-xs text-secondary mt-2">
                  {activity.participantCount} deltagare
                </p>
              </Link>
              );
            })}
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
      <div className="grid grid-cols-activity-feed gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-card" />
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
    // User was deleted or reseeded - stale session. Sign out.
    const { redirect } = await import("next/navigation");
    redirect("/api/auth/signout");
    return null; // unreachable, but satisfies TypeScript
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

  // "Visa alla" mode: available to all users; admins get full bypass,
  // regular users still respect gender and minAge constraints.
  // Användare utan valda intressen får automatiskt "Visa alla" som default,
  // annars skulle feeden vara nästan tom (bara egna aktiviteter + de man
  // anmält sig till).
  const showAll = params.alla === "1" || userInterestsList.length === 0;

  // Determine active tag filters (comma-separated slugs)
  const interestParam = typeof params.intresse === "string" ? params.intresse : null;
  const activeFilters = interestParam ? interestParam.split(",").filter(Boolean) : [];
  const tagFilterIds = activeFilters
    .map((slug) => userInterestsList.find((t) => t.slug === slug)?.id)
    .filter((id): id is number => id !== undefined);

  // First page of the feed (lazy-loaded pagination happens client-side
  // via the loadMoreFeed server action).
  const matchedActivities = await getMatchedActivities(
    userId,
    userProfile.gender,
    viewerAge,
    0,
    tagFilterIds.length > 0 ? tagFilterIds : undefined,
    showAll,
    userProfile.isAdmin,
  );

  const enrichedActivities = await enrichFeedActivities(
    matchedActivities,
    userId,
  );

  const unreadCount = await getNotificationCount(userId);
  const userInitials =
    userProfile.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  const hasMore = enrichedActivities.length === FEED_PAGE_SIZE;

  return (
    <AppShell
      interests={userInterestsList}
      activeFilters={activeFilters}
      showAll={showAll}
      unreadCount={unreadCount}
      userInitials={userInitials}
      userAvatarUrl={userProfile.avatarUrl}
      isAdmin={userProfile.isAdmin}
    >
      <ActivityFeed
        initialActivities={enrichedActivities}
        userInterests={userInterestsList}
        activeFilters={activeFilters}
        initialHasMore={hasMore}
        userId={userId}
        showAll={showAll}
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
