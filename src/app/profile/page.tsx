import { auth, requireAuth } from "@/lib/auth";
import { getUserShellData } from "@/lib/queries/user-shell-data";
import { db } from "@/lib/db";
import {
  users,
  userInterests,
  userBlocks,
  interestTags,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { AppShell } from "@/components/layout/app-shell";
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-secondary">Profilen kunde inte laddas.</p>
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

  // Get shell data for AppShell
  const shellData = await getUserShellData(userId);

  return (
    <AppShell
      interests={shellData.interests}
      unreadCount={shellData.unreadCount}
      userInitials={shellData.initials}
      isAdmin={shellData.isAdmin}
    >
      <div className="px-6 py-8">
        <h1 className="text-2xl font-bold text-heading mb-6">Min profil</h1>
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
      </div>
    </AppShell>
  );
}
