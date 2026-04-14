import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, userInterests, interestTags } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Ej inloggad" }, { status: 401 });
  }

  const [interests, profile] = await Promise.all([
    db
      .select({
        id: interestTags.id,
        name: interestTags.name,
        slug: interestTags.slug,
      })
      .from(userInterests)
      .innerJoin(interestTags, eq(interestTags.id, userInterests.tagId))
      .where(eq(userInterests.userId, session.user.id)),
    db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { gender: true },
    }),
  ]);

  return Response.json({
    interests,
    gender: profile?.gender ?? "ej_angett",
  });
}
