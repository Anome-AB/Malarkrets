import { db } from "@/lib/db";
import { interestTags, userInterests } from "@/db/schema";
import { count, eq } from "drizzle-orm";

export async function GET() {
  const tags = await db
    .select({
      id: interestTags.id,
      name: interestTags.name,
      slug: interestTags.slug,
      userCount: count(userInterests.userId),
    })
    .from(interestTags)
    .leftJoin(userInterests, eq(userInterests.tagId, interestTags.id))
    .groupBy(interestTags.id);

  // Sortera alfabetiskt med svenskt locale så å/ä/ö hamnar sist (efter z)
  // istället för var som helst som default-collation skulle ge.
  tags.sort((a, b) => a.name.localeCompare(b.name, "sv"));

  return Response.json({ tags });
}
