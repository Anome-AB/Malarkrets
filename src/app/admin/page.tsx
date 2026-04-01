import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, interestTags } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { AdminClient } from "./admin-client";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  // Check admin
  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!currentUser?.isAdmin) {
    redirect("/");
  }

  // Get all users
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  // Get all interest tags
  const allTags = await db
    .select({
      id: interestTags.id,
      name: interestTags.name,
      slug: interestTags.slug,
      category: interestTags.category,
    })
    .from(interestTags)
    .orderBy(interestTags.name);

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-bold text-[#2d2d2d] mb-8">Adminpanel</h1>

      <AdminClient
        users={allUsers.map((u) => ({
          ...u,
          createdAt: u.createdAt?.toISOString() ?? null,
        }))}
        tags={allTags}
      />
    </div>
  );
}
