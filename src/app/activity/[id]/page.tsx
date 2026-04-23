import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { FeedLink } from "@/components/layout/feed-link";
import { getUserShellData } from "@/lib/queries/user-shell-data";
import { db } from "@/lib/db";
import {
  activities,
  activityTags,
  activityParticipants,
  activityComments,
  activityFeedback,
  interestTags,
  users,
} from "@/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { CourageSection } from "@/components/activity/courage-section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getColorHex } from "@/lib/color-themes";
import { AppShell } from "@/components/layout/app-shell";
import { ActivityDetailClient } from "./activity-detail-client";
import { AdminActivityControls } from "@/components/activity/admin-activity-controls";

interface WhatToExpect {
  okAlone?: boolean;
  experienceLevel?: string;
  whoComes?: string;
  latePolicy?: string;
}

async function getActivity(id: string) {
  const activity = await db.query.activities.findFirst({
    where: eq(activities.id, id),
  });

  if (!activity) return null;

  // Get creator
  const creator = activity.creatorId
    ? await db.query.users.findFirst({
        where: eq(users.id, activity.creatorId),
      })
    : null;

  // Get tags
  const tags = await db
    .select({
      id: interestTags.id,
      name: interestTags.name,
      slug: interestTags.slug,
    })
    .from(activityTags)
    .innerJoin(interestTags, eq(interestTags.id, activityTags.tagId))
    .where(eq(activityTags.activityId, id));

  // Get participant count (only attending)
  const [{ count: participantCount }] = await db
    .select({ count: count() })
    .from(activityParticipants)
    .where(and(
      eq(activityParticipants.activityId, id),
      eq(activityParticipants.status, "attending"),
    ));

  // Get interested count
  const [{ count: interestedCount }] = await db
    .select({ count: count() })
    .from(activityParticipants)
    .where(and(
      eq(activityParticipants.activityId, id),
      eq(activityParticipants.status, "interested"),
    ));

  // Get comments with author info
  const comments = await db
    .select({
      id: activityComments.id,
      userId: activityComments.userId,
      authorName: users.displayName,
      content: activityComments.content,
      createdAt: activityComments.createdAt,
    })
    .from(activityComments)
    .leftJoin(users, eq(users.id, activityComments.userId))
    .where(eq(activityComments.activityId, id))
    .orderBy(activityComments.createdAt);

  // Get feedback stats
  const feedbackRows = await db
    .select({
      rating: activityFeedback.rating,
      count: count(),
    })
    .from(activityFeedback)
    .where(eq(activityFeedback.activityId, id))
    .groupBy(activityFeedback.rating);

  let feedbackTotal = 0;
  let feedbackPositive = 0;
  for (const row of feedbackRows) {
    feedbackTotal += row.count;
    if (row.rating === "positive") feedbackPositive = row.count;
  }

  return {
    ...activity,
    creator,
    tags,
    participantCount,
    interestedCount,
    comments: comments.map((c) => ({
      id: c.id,
      userId: c.userId,
      authorName: c.authorName ?? "Anonym",
      content: c.content,
      createdAt: c.createdAt!,
    })),
    feedbackTotal,
    feedbackPositive,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const activity = await getActivity(id);

  if (!activity) {
    return { title: "Aktivitet hittades inte - Mälarkrets" };
  }

  return {
    title: `${activity.title} - Mälarkrets`,
    description: activity.description.slice(0, 160),
    openGraph: {
      title: activity.title,
      description: activity.description.slice(0, 160),
      images: activity.imageOgUrl
        ? [activity.imageOgUrl]
        : activity.imageMediumUrl
          ? [activity.imageMediumUrl]
          : undefined,
    },
  };
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = await getActivity(id);

  if (!activity) {
    notFound();
  }

  const session = await auth();
  const currentUserId = session?.user?.id ?? null;

  // Check if current user is a participant
  let isParticipant = false;
  let isCreator = false;
  let participationStatus: "interested" | "attending" | null = null;
  if (currentUserId) {
    isCreator = activity.creatorId === currentUserId;
    const participation = await db.query.activityParticipants.findFirst({
      where: and(
        eq(activityParticipants.activityId, id),
        eq(activityParticipants.userId, currentUserId),
      ),
    });
    isParticipant = !!participation;
    participationStatus = (participation?.status as "interested" | "attending" | undefined) ?? null;
  }

  const wte = activity.whatToExpect as WhatToExpect | null;

  const feedbackText =
    activity.feedbackTotal > 0
      ? `${activity.feedbackPositive} av ${activity.feedbackTotal} tyckte det var bra!`
      : null;

  // Fetch shell data for authenticated users
  const shellData = currentUserId
    ? await getUserShellData(currentUserId)
    : null;

  const isAdmin = shellData?.isAdmin ?? false;

  // Soft-delete handling: non-admins without context get 404. Creator/participant
  // see a tombstone. Admin sees full view with a red banner at the top.
  if (activity.deletedAt) {
    const canSeeTombstone = isCreator || isParticipant;
    if (!isAdmin && !canSeeTombstone) {
      notFound();
    }
    if (!isAdmin && canSeeTombstone) {
      const tombstone = (
        <div className="px-6 py-8">
          <Card variant="danger" className="max-w-2xl">
            <h2 className="text-lg font-semibold text-heading mb-2">
              Aktiviteten har tagits bort av en moderator
            </h2>
            {activity.deletedReason && (
              <p className="text-sm text-secondary mb-3">
                <span className="font-medium text-heading">Anledning:</span>{" "}
                {activity.deletedReason}
              </p>
            )}
            <p className="text-sm text-secondary">
              Kontakta en administratör om du har frågor om beslutet.
            </p>
            <div className="mt-4">
              <FeedLink className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Tillbaka till start
              </FeedLink>
            </div>
          </Card>
        </div>
      );
      return shellData ? (
        <AppShell
          interests={shellData.interests}
          unreadCount={shellData.unreadCount}
          userInitials={shellData.initials}
          isAdmin={shellData.isAdmin}
        >
          {tombstone}
        </AppShell>
      ) : (
        tombstone
      );
    }
  }

  const pageContent = (
    <div className={currentUserId ? "" : "min-h-screen bg-background"}>
      {/* Header - only show for unauthenticated (AppShell provides topnav) */}
      {!currentUserId && (
        <header className="bg-primary text-white">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
            <FeedLink className="text-white/80 hover:text-white transition-colors">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label="Tillbaka"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </FeedLink>
            <h1 className="text-lg font-semibold truncate">
              {activity.title}
            </h1>
          </div>
        </header>
      )}

      <div className="px-6 py-8 pb-detail-mobile-footer lg:pb-8">
        {/* Deleted banner — only visible to admins since other viewers are already
            routed to the tombstone above. */}
        {activity.deletedAt && (
          <div className="bg-red-50 border border-red-300 rounded-card p-4 mb-6">
            <p className="text-sm font-semibold text-red-700">
              BORTTAGEN — modererad av admin
            </p>
            {activity.deletedReason && (
              <p className="text-sm text-red-600 mt-1">
                {activity.deletedReason}
              </p>
            )}
          </div>
        )}

        {/* Cancelled banner */}
        {activity.cancelledAt && (
          <div className="bg-red-50 border border-red-200 rounded-card p-4 mb-6">
            <p className="text-sm font-semibold text-red-700">
              Denna aktivitet är inställd
            </p>
            {activity.cancelledReason && (
              <p className="text-sm text-red-600 mt-1">
                {activity.cancelledReason}
              </p>
            )}
          </div>
        )}

        {/* Back link for authenticated users */}
        {currentUserId && (
          <FeedLink className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mb-6">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Tillbaka
          </FeedLink>
        )}

        <div className="max-w-5xl space-y-6">
            {/* Image — shown only if uploaded */}
            {activity.imageMediumUrl && (
              <img
                src={activity.imageMediumUrl}
                alt=""
                className="w-full aspect-video max-h-80 object-cover rounded-lg"
              />
            )}

            {/* Card: Activity info */}
            <Card>
              {(isCreator || (currentUserId && participationStatus)) && (
                <div className="flex justify-end mb-2">
                  {isCreator && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-bg text-success-text font-semibold text-xs">
                      Du arrangerar
                    </span>
                  )}
                  {!isCreator && participationStatus === "attending" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-light text-primary font-semibold text-xs">
                      Kommer &#10003;
                    </span>
                  )}
                  {!isCreator && participationStatus === "interested" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-alert-bg text-alert-text font-semibold text-xs">
                      Intresserad
                    </span>
                  )}
                </div>
              )}

              {/* Top row: metadata + map side by side */}
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-heading">
                    {activity.title}
                  </h2>

                  <div className="mt-3 space-y-1 text-sm text-secondary">
                    <p>
                      {new Date(activity.startTime).toLocaleDateString("sv-SE", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {activity.endTime && (
                        <>
                          {" "}
                          &ndash;{" "}
                          {new Date(activity.endTime).toLocaleTimeString("sv-SE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      )}
                    </p>
                    <p>{activity.location}</p>
                    {activity.creator && (
                      <p>
                        Skapad av{" "}
                        <span className="font-medium text-heading">
                          {activity.creator.displayName ?? "Anonym"}
                        </span>
                      </p>
                    )}
                    <p>
                      Deltagare:{" "}
                      <span className="font-medium text-heading">
                        {activity.participantCount}
                        {activity.maxParticipants ? ` / ${activity.maxParticipants}` : ""}
                      </span>
                      {activity.interestedCount > 0 && (
                        <>
                          <span className="mx-2 text-dimmed">·</span>
                          Intresserade:{" "}
                          <span className="font-medium text-heading">
                            {activity.interestedCount}
                          </span>
                        </>
                      )}
                    </p>
                    {feedbackText && (
                      <p className="text-primary font-medium">{feedbackText}</p>
                    )}
                  </div>

                  {activity.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {activity.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="text-xs px-3 py-1 rounded-full bg-primary-light text-primary font-medium"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {activity.latitude && activity.longitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${activity.latitude},${activity.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 w-full sm:w-64 h-fit rounded-control overflow-hidden border border-border hover:shadow-md transition-shadow"
                  >
                    <img
                      src={`https://maps.googleapis.com/maps/api/staticmap?center=${activity.latitude},${activity.longitude}&zoom=15&size=400x300&scale=2&markers=color:0x3d6b5e%7C${activity.latitude},${activity.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                      alt={`Karta: ${activity.location}`}
                      className="w-full h-detail-map object-cover block"
                    />
                    <div className="px-3 py-2 bg-white text-xs text-primary font-medium flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      Öppna i Google Maps
                    </div>
                  </a>
                )}
              </div>

              {/* Description — full width below */}
              <p className="mt-6 text-heading whitespace-pre-wrap leading-relaxed">
                {activity.description}
              </p>

              {/* Action buttons — desktop only, mobile uses floating bar.
                  Creators get their Edit button in a sticky card at the end of the
                  content column instead of here. */}
              {!isCreator && (
                <div className="mt-6 pt-4 border-t border-border-light hidden lg:flex items-center justify-end gap-2 flex-wrap">
                  <ActivityDetailClient
                    activityId={id}
                    isAuthenticated={!!currentUserId}
                    isParticipant={isParticipant}
                    participationStatus={participationStatus}
                    isCreator={isCreator}
                    currentUserId={currentUserId}
                    comments={activity.comments}
                    isCancelled={!!activity.cancelledAt}
                    actionsOnly
                  />
                </div>
              )}
            </Card>

            {/* Card: Courage section */}
            {wte && (
              <Card>
                <CourageSection whatToExpect={wte} />
              </Card>
            )}

            {/* Card: Comments & actions */}
            <Card>
              <ActivityDetailClient
                activityId={id}
                isAuthenticated={!!currentUserId}
                isParticipant={isParticipant}
                participationStatus={participationStatus}
                isCreator={isCreator}
                currentUserId={currentUserId}
                comments={activity.comments}
                isCancelled={!!activity.cancelledAt}
              />
            </Card>

            {/* Admin moderation — placed last so it naturally sits at the bottom of the
                content column, and sticks to the viewport bottom on desktop while scrolling
                back up through the page. Mobile stays inline to avoid colliding with the
                floating join/leave action bar. */}
            {isAdmin && !isCreator && !activity.deletedAt && (
              <Card className="!bg-info-light border-info/30 lg:sticky lg:bottom-4 lg:z-20 shadow-admin-footer">
                <AdminActivityControls
                  activity={{
                    id: activity.id,
                    title: activity.title,
                    creatorDisplayName: activity.creator?.displayName ?? null,
                  }}
                  creatorIsAdmin={activity.creator?.isAdmin ?? false}
                />
              </Card>
            )}

            {/* Creator tools — sticky footer mirroring the admin card pattern. Only the
                edit action lives here; cancel/delete stay on the edit page. */}
            {currentUserId && isCreator && !activity.deletedAt && (
              <Card className="!bg-primary-light border-primary/20 lg:sticky lg:bottom-4 lg:z-20 shadow-admin-footer">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Din aktivitet
                  </span>
                  <Link href={`/activity/${id}/edit`}>
                    <Button variant="secondary" size="compact" type="button">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Redigera
                    </Button>
                  </Link>
                </div>
              </Card>
            )}
        </div>
      </div>
    </div>
  );

  if (currentUserId && shellData) {
    return (
      <AppShell
        interests={shellData.interests}
        unreadCount={shellData.unreadCount}
        userInitials={shellData.initials}
        isAdmin={shellData.isAdmin}
      >
        {pageContent}
      </AppShell>
    );
  }

  return pageContent;
}
