import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activities,
  activityTags,
  activityParticipants,
  interestTags,
  userInterests,
  users,
} from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const activity = await db.query.activities.findFirst({
    where: eq(activities.id, id),
  });

  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const viewer = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  const isCreator = activity.creatorId === session.user.id;
  const isAdmin = viewer?.isAdmin ?? false;

  if (!isCreator && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const creator = activity.creatorId
    ? await db.query.users.findFirst({ where: eq(users.id, activity.creatorId) })
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

  // When an admin edits someone else's activity the tag picker must show the
  // creator's chosen interests, not the admin's. Fetch them here so the client
  // doesn't need an extra round-trip (and so it can't leak an admin's tags
  // into the form).
  const creatorInterests = activity.creatorId
    ? await db
        .select({
          id: interestTags.id,
          name: interestTags.name,
          slug: interestTags.slug,
        })
        .from(userInterests)
        .innerJoin(interestTags, eq(interestTags.id, userInterests.tagId))
        .where(eq(userInterests.userId, activity.creatorId))
    : [];

  // Get participant count (excluding creator)
  const [{ count: participantCount }] = await db
    .select({ count: count() })
    .from(activityParticipants)
    .where(eq(activityParticipants.activityId, id));

  const whatToExpect = activity.whatToExpect as Record<string, unknown> | null;

  return NextResponse.json({
    activity: {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      location: activity.location,
      latitude: activity.latitude,
      longitude: activity.longitude,
      imageThumbUrl: activity.imageThumbUrl,
      imageMediumUrl: activity.imageMediumUrl,
      imageOgUrl: activity.imageOgUrl,
      imageAccentColor: activity.imageAccentColor,
      colorTheme: activity.colorTheme,
      startTime: activity.startTime,
      endTime: activity.endTime,
      maxParticipants: activity.maxParticipants,
      genderRestriction: activity.genderRestriction,
      minAge: activity.minAge,
      whatToExpect,
      tags: tags.map((t) => t.id),
      participantCount,
      creatorId: activity.creatorId,
      creatorDisplayName: creator?.displayName ?? null,
      creatorGender: creator?.gender ?? "ej_angett",
      creatorInterests,
      viewerIsAdmin: isAdmin,
      viewerIsCreator: isCreator,
    },
  });
}
