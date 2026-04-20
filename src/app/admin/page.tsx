import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, interestTags, courageMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AdminClient } from "./admin-client";
import { searchUsers } from "@/actions/admin";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!currentUser?.isAdmin) {
    redirect("/");
  }

  // Initial paginated users load
  const initialUsers = await searchUsers("", 1);

  // Get all interest tags
  const allTags = await db
    .select({
      id: interestTags.id,
      name: interestTags.name,
      slug: interestTags.slug,
    })
    .from(interestTags)
    .orderBy(interestTags.name);

  // Get all courage messages
  const allCourageMessages = await db
    .select()
    .from(courageMessages)
    .orderBy(courageMessages.audience, courageMessages.id);

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-bold text-heading mb-6">Adminpanel</h1>
      <AdminClient
        initialUsers={initialUsers}
        tags={allTags}
        courageMessages={allCourageMessages}
      />
    </div>
  );
}
