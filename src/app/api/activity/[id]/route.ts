import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activities,
  activityTags,
  activityParticipants,
  interestTags,
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

  if (activity.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
      startTime: activity.startTime,
      endTime: activity.endTime,
      maxParticipants: activity.maxParticipants,
      genderRestriction: activity.genderRestriction,
      minAge: activity.minAge,
      whatToExpect,
      tags: tags.map((t) => t.id),
      participantCount,
    },
  });
}
