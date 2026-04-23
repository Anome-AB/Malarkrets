import { db } from "@/lib/db";
import { activities, activityComments, userTokens } from "@/db/schema";
import { sql, eq, and, gte, or } from "drizzle-orm";

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

  const rows = result as unknown as Array<{ count: number }>;
  const currentCount = rows[0]?.count ?? 0;
  const remaining = Math.max(0, limit - currentCount);

  return {
    allowed: currentCount < limit,
    remaining,
  };
}

type TokenRateLimitInput = {
  emailHash: string;
  ip: string | null;
  type: "verify_email" | "reset_password";
  windowMinutes: number;
  max: number;
};

/**
 * Rate-limit unauthenticated token-issuing flows (forgot-password, verify).
 *
 * Counts user_tokens rows within the window where email_hash OR ip match
 * (whichever is present). used_at is IGNORED on purpose: an attacker
 * spamming requests invalidates earlier tokens as side effect, so counting
 * only unused rows would silently permit unlimited traffic.
 */
export async function checkTokenRateLimit(
  input: TokenRateLimitInput,
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(
    Date.now() - input.windowMinutes * 60 * 1000,
  );

  const predicates = [
    eq(userTokens.type, input.type),
    gte(userTokens.createdAt, windowStart),
  ];

  const identityClauses = [eq(userTokens.emailHash, input.emailHash)];
  if (input.ip) {
    identityClauses.push(eq(userTokens.ip, input.ip));
  }

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userTokens)
    .where(and(...predicates, or(...identityClauses)));

  const currentCount = result[0]?.count ?? 0;
  const remaining = Math.max(0, input.max - currentCount);

  return {
    allowed: currentCount < input.max,
    remaining,
  };
}
