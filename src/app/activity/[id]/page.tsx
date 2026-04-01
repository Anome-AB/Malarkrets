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

  // Get participant count
  const [{ count: participantCount }] = await db
    .select({ count: count() })
    .from(activityParticipants)
    .where(eq(activityParticipants.activityId, id));

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
  if (currentUserId) {
    isCreator = activity.creatorId === currentUserId;
    const participation = await db.query.activityParticipants.findFirst({
      where: and(
        eq(activityParticipants.activityId, id),
        eq(activityParticipants.userId, currentUserId),
      ),
    });
    isParticipant = !!participation;
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
    <div className={currentUserId ? "" : "min-h-screen bg-[#f8f7f4]"}>
      {/* Header - only show for unauthenticated (AppShell provides topnav) */}
      {!currentUserId && (
        <header className="bg-[#3d6b5e] text-white">
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

      <div className="px-6 py-8">
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
            className="inline-flex items-center gap-1 text-sm font-medium text-[#3d6b5e] hover:underline mb-6"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Tillbaka
          </Link>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: main content, spans 2 cols on desktop */}
          <div className="lg:col-span-2 space-y-6">
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
              <h2 className="text-2xl font-bold text-[#2d2d2d]">
                {activity.title}
              </h2>

              <div className="mt-3 space-y-1 text-sm text-[#666666]">
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
                    <span className="font-medium text-[#2d2d2d]">
                      {activity.creator.displayName ?? "Anonym"}
                    </span>
                  </p>
                )}
              </div>

              {/* Tags */}
              {activity.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {activity.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="text-xs px-3 py-1 rounded-full bg-[#e8f0ec] text-[#3d6b5e] font-medium"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              <p className="mt-4 text-[#2d2d2d] whitespace-pre-wrap leading-relaxed">
                {activity.description}
              </p>
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
                isCreator={isCreator}
                currentUserId={currentUserId}
                comments={activity.comments}
                isCancelled={!!activity.cancelledAt}
              />
            </Card>
          </div>

          {/* Right column: sidebar */}
          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {/* Card: Participation status + actions */}
            <Card title="Delta" className="space-y-4">
              {/* Participation status */}
              {!currentUserId && (
                <div>
                  <Link
                    href="/auth/login"
                    className="text-[#3d6b5e] font-semibold hover:underline"
                  >
                    Logga in för att delta
                  </Link>
                </div>
              )}
              {currentUserId && isParticipant && (
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e8f0ec] text-[#3d6b5e] font-semibold text-sm">
                    Du är anmäld &#10003;
                  </span>
                </div>
              )}
              {currentUserId && isCreator && !isParticipant && (
                <div>
                  <span className="text-sm text-[#666666]">
                    Du skapade den här aktiviteten
                  </span>
                </div>
              )}
              {currentUserId && isCreator && (
                <Link
                  href={`/activity/${id}/edit`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#3d6b5e] border border-[#3d6b5e] rounded-lg hover:bg-[#e8f0ec] transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Redigera
                </Link>
              )}

              {/* Participant count */}
              <div className="text-sm">
                <span className="text-[#666666]">Deltagare: </span>
                <span className="font-semibold text-[#2d2d2d]">
                  {activity.participantCount}
                  {activity.maxParticipants
                    ? ` / ${activity.maxParticipants}`
                    : ""}
                </span>
              </div>

              {/* Feedback stats */}
              {feedbackText && (
                <div className="text-sm">
                  <span className="text-[#3d6b5e] font-medium">
                    {feedbackText}
                  </span>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );

  if (currentUserId && shellData) {
    return (
      <AppShell
        interests={shellData.interests}
        activeFilter={null}
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
