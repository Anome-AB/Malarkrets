import { auth, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  userInterests,
  userBlocks,
  interestTags,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const user = await requireAuth();
  const userId = user.id!;

  // Get user profile
  const profile = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
        <p className="text-[#666666]">Profilen kunde inte laddas.</p>
      </div>
    );
  }

  // Get user interests
  const interests = await db
    .select({
      id: interestTags.id,
      name: interestTags.name,
      slug: interestTags.slug,
    })
    .from(userInterests)
    .innerJoin(interestTags, eq(interestTags.id, userInterests.tagId))
    .where(eq(userInterests.userId, userId));

  // Get all available tags
  const allTags = await db
    .select({
      id: interestTags.id,
      name: interestTags.name,
      slug: interestTags.slug,
      category: interestTags.category,
    })
    .from(interestTags)
    .orderBy(interestTags.name);

  // Get blocked users
  const blockedUsers = await db
    .select({
      blockedId: userBlocks.blockedId,
      displayName: users.displayName,
      email: users.email,
    })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedId))
    .where(eq(userBlocks.blockerId, userId));

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      <header className="bg-[#3d6b5e] text-white">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold">Min profil</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <ProfileClient
          profile={{
            displayName: profile.displayName ?? "",
            email: profile.email,
            emailVerified: profile.emailVerified ?? false,
            birthDate: profile.birthDate ?? "",
            gender: profile.gender ?? "ej_angett",
            location: profile.location ?? "",
          }}
          currentInterestIds={interests.map((i) => i.id)}
          allTags={allTags}
          blockedUsers={blockedUsers.map((b) => ({
            id: b.blockedId,
            displayName: b.displayName ?? "Anonym",
          }))}
        />
      </main>
    </div>
  );
}
