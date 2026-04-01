import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
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

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      {/* Header */}
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

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Image */}
        {activity.imageMediumUrl && (
          <img
            src={activity.imageMediumUrl}
            alt=""
            className="w-full h-64 object-cover rounded-lg"
          />
        )}

        {/* Title & meta */}
        <div>
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
        </div>

        {/* Tags */}
        {activity.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
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
        <div>
          <p className="text-[#2d2d2d] whitespace-pre-wrap leading-relaxed">
            {activity.description}
          </p>
        </div>

        {/* Courage section */}
        {wte && <CourageSection whatToExpect={wte} />}

        {/* Stats */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="bg-white border border-[#dddddd] rounded-lg px-4 py-3">
            <span className="text-[#666666]">Deltagare: </span>
            <span className="font-semibold text-[#2d2d2d]">
              {activity.participantCount}
              {activity.maxParticipants
                ? ` / ${activity.maxParticipants}`
                : ""}
            </span>
          </div>
          {feedbackText && (
            <div className="bg-white border border-[#dddddd] rounded-lg px-4 py-3">
              <span className="text-[#3d6b5e] font-medium">
                {feedbackText}
              </span>
            </div>
          )}
        </div>

        {/* Actions & comments */}
        <ActivityDetailClient
          activityId={id}
          isAuthenticated={!!currentUserId}
          isParticipant={isParticipant}
          isCreator={isCreator}
          currentUserId={currentUserId}
          comments={activity.comments}
        />
      </main>
    </div>
  );
}
