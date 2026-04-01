import { db } from "@/lib/db";
import { interestTags, userInterests } from "@/db/schema";
import { count, eq } from "drizzle-orm";

export async function GET() {
  const tags = await db
    .select({
      id: interestTags.id,
      name: interestTags.name,
      slug: interestTags.slug,
      category: interestTags.category,
      userCount: count(userInterests.userId),
    })
    .from(interestTags)
    .leftJoin(userInterests, eq(userInterests.tagId, interestTags.id))
    .groupBy(interestTags.id)
    .orderBy(interestTags.name);

  return Response.json({ tags });
}
