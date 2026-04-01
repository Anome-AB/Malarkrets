import { db } from "@/lib/db";
import { activities, activityComments } from "@/db/schema";
import { sql, eq, and, gte } from "drizzle-orm";

const tables = {
  activities,
  comments: activityComments,
} as const;

const userIdColumns = {
  activities: activities.creatorId,
  comments: activityComments.userId,
} as const;

const createdAtColumns = {
  activities: activities.createdAt,
  comments: activityComments.createdAt,
} as const;

export async function checkRateLimit(
  userId: string,
  table: "activities" | "comments",
  limit: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const targetTable = tables[table];
  const userIdCol = userIdColumns[table];
  const createdAtCol = createdAtColumns[table];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const result = await db.execute(sql`
    SELECT count(*)::int as count
    FROM ${targetTable}
    WHERE ${userIdCol} = ${userId}
      AND ${createdAtCol} >= ${todayStart}
    FOR UPDATE
  `);

  const currentCount = (result as any)[0]?.count ?? 0;
  const remaining = Math.max(0, limit - currentCount);

  return {
    allowed: currentCount < limit,
    remaining,
  };
}
