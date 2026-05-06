import { db } from "@/lib/db";
import { users, userInterests, interestTags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getNotificationCount } from "./notifications";

export async function getUserShellData(userId: string) {
  const userProfile = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  const interests = await db
    .select({
      id: interestTags.id,
      name: interestTags.name,
      slug: interestTags.slug,
    })
    .from(userInterests)
    .innerJoin(interestTags, eq(interestTags.id, userInterests.tagId))
    .where(eq(userInterests.userId, userId));

  // Sortera i JS med svenskt locale så å/ä/ö hamnar sist. Postgres
  // default-collation i dev (C/POSIX) sorterar dem efter ASCII vilket
  // ger fel ordning för svenska. Konsekvent med API-endpoints.
  interests.sort((a, b) => a.name.localeCompare(b.name, "sv"));

  const unreadCount = await getNotificationCount(userId);

  const initials = userProfile?.displayName
    ? userProfile.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : userProfile?.email?.slice(0, 2).toUpperCase() ?? "??";

  return {
    userProfile,
    interests,
    unreadCount,
    initials,
    avatarUrl: userProfile?.avatarUrl ?? null,
    isAdmin: userProfile?.isAdmin ?? false,
  };
}
