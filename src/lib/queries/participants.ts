import { db } from "@/lib/db";
import { activityParticipants, users } from "@/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";

export interface ParticipantPreview {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /**
   * Markerar att den aktuella betraktaren (viewer) har blockerat just denna
   * användare. Används av UI:t för att visa "Blockerad"-chip och byta
   * blockera-knappen mot avblockera-knappen.
   */
  isBlockedByViewer?: boolean;
  /**
   * Markerar att personen är aktivitetens arrangör (creator). UI:t lägger
   * dem först i stacken och visar "Arrangör"-chip i popovern.
   */
  isCreator?: boolean;
}

interface CreatorProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

/**
 * Hämtar creator-profiler för en uppsättning aktiviteter. Returneras keyed
 * på creatorId så list-vyer enkelt kan slå upp arrangören per aktivitet.
 * null-creators (raderade konton) hoppas över - aktiviteten visas då bara
 * med deltagare i listan.
 */
export async function getCreatorProfiles(
  creatorIds: string[],
): Promise<Map<string, CreatorProfile>> {
  const map = new Map<string, CreatorProfile>();
  if (creatorIds.length === 0) return map;
  const uniqueIds = Array.from(new Set(creatorIds));
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.id, uniqueIds));
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      displayName: row.displayName ?? "Anonym",
      avatarUrl: row.avatarUrl,
    });
  }
  return map;
}

/**
 * Slår in arrangören som första rad i deltagar-listan. Om arrangören redan
 * finns bland attending markeras den befintliga raden istället; annars
 * prepend:as en ny. Returnerar dessutom hur mycket participantCount ska
 * justeras för att hålla räknaren konsistent med listan.
 */
export function mergeCreatorIntoPreview(
  attending: ParticipantPreview[],
  creator: CreatorProfile | null,
): { participants: ParticipantPreview[]; countDelta: number } {
  if (!creator) return { participants: attending, countDelta: 0 };
  const existingIndex = attending.findIndex((p) => p.id === creator.id);
  if (existingIndex >= 0) {
    const updated = [...attending];
    updated[existingIndex] = { ...updated[existingIndex], isCreator: true };
    // Lyft creator-raden till första plats för konsistent layout.
    const [creatorRow] = updated.splice(existingIndex, 1);
    return { participants: [creatorRow, ...updated], countDelta: 0 };
  }
  return {
    participants: [{ ...creator, isCreator: true }, ...attending],
    countDelta: 1,
  };
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
