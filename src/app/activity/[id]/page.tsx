import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
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
import { AppShell } from "@/components/layout/app-shell";
import { ActivityDetailClient } from "./activity-detail-client";

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

  const pageContent = (
    <div className={currentUserId ? "" : "min-h-screen bg-background"}>
      {/* Header - only show for unauthenticated (AppShell provides topnav) */}
      {!currentUserId && (
        <header className="bg-primary text-white">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link
              href="/"
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Tillbaka"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold truncate">
              {activity.title}
            </h1>
          </div>
        </header>
      )}

      <div className="px-6 py-8 pb-[140px] lg:pb-8">
        {/* Cancelled banner */}
        {activity.cancelledAt && (
          <div className="bg-red-50 border border-red-200 rounded-[10px] p-4 mb-6">
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
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mb-6"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Tillbaka
          </Link>
        )}

        <div className="max-w-5xl space-y-6">
            {/* Image */}
            {activity.imageMediumUrl && (
              <img
                src={activity.imageMediumUrl}
                alt=""
                className="w-full h-64 object-cover rounded-lg"
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
                    className="flex-shrink-0 w-full sm:w-64 h-fit rounded-[8px] overflow-hidden border border-border hover:shadow-md transition-shadow"
                  >
                    <img
                      src={`https://maps.googleapis.com/maps/api/staticmap?center=${activity.latitude},${activity.longitude}&zoom=15&size=400x300&scale=2&markers=color:0x3d6b5e%7C${activity.latitude},${activity.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                      alt={`Karta: ${activity.location}`}
                      className="w-full h-[180px] object-cover block"
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

              {/* Action bar: participation + actions */}
              <div className="mt-6 pt-4 border-t border-border-light flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span className="text-secondary">Deltagare:</span>
                  <span className="font-semibold text-heading">
                    {activity.participantCount}
                    {activity.maxParticipants ? ` / ${activity.maxParticipants}` : ""}
                  </span>
                </div>

                {activity.interestedCount > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="text-secondary">Intresserade:</span>
                    <span className="font-semibold text-heading">{activity.interestedCount}</span>
                  </div>
                )}

                {feedbackText && (
                  <div className="text-sm text-primary font-medium">
                    {feedbackText}
                  </div>
                )}

                <div className="flex-1" />

                {!currentUserId && (
                  <Link
                    href="/auth/login"
                    className="text-sm text-primary font-semibold hover:underline"
                  >
                    Logga in för att delta
                  </Link>
                )}
                {currentUserId && isCreator && (
                  <Link
                    href={`/activity/${id}/edit`}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary bg-white border border-primary rounded-[8px] hover:bg-primary-light transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Redigera
                  </Link>
                )}
              </div>
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
