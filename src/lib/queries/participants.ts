import { db } from "@/lib/db";
import { activityParticipants, users } from "@/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";

export interface ParticipantPreview {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

/**
 * Hämta upp till `limitPerActivity` (default 5) attending-deltagare per
 * aktivitets-id, sorterat på join-tid i stigande ordning (tidigast först).
 * Resultatet returneras som en Map keyed på activityId så list-vyer enkelt
 * kan slå upp förhandsvisningen per kort.
 *
 * Vi hämtar alla attending för uppslagna IDn i en query och delar upp i JS
 * istället för att köra en window-function-query - för rimliga listor (max
 * 50 aktiviteter * ca 10 deltagare) blir det helt OK i ett anrop.
 */
export async function getAttendingPreviews(
  activityIds: string[],
  limitPerActivity = 5,
): Promise<Map<string, ParticipantPreview[]>> {
  const map = new Map<string, ParticipantPreview[]>();
  if (activityIds.length === 0) return map;

  const rows = await db
    .select({
      activityId: activityParticipants.activityId,
      userId: activityParticipants.userId,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      createdAt: activityParticipants.createdAt,
    })
    .from(activityParticipants)
    .innerJoin(users, eq(users.id, activityParticipants.userId))
    .where(
      and(
        inArray(activityParticipants.activityId, activityIds),
        eq(activityParticipants.status, "attending"),
      ),
    )
    .orderBy(asc(activityParticipants.createdAt));

  for (const row of rows) {
    const current = map.get(row.activityId) ?? [];
    if (current.length < limitPerActivity) {
      current.push({
        id: row.userId,
        displayName: row.displayName ?? "Anonym",
        avatarUrl: row.avatarUrl,
      });
      map.set(row.activityId, current);
    }
  }

  return map;
}
