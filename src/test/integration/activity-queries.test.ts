// Smoke test for real Drizzle queries against real Postgres. Covers the
// "does our schema actually let me insert + query a realistic row" gap
// that mock-DB-based unit tests cannot.
//
// Keep this file small — the unit tests in src/actions/*.test.ts cover
// permission logic thoroughly against mock-DB. This file is specifically
// for catching SQL/schema regressions the mock cannot see.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type postgres from "postgres";
import { eq, and } from "drizzle-orm";
import { getTestClient, teardownTestDb, truncateAll, type TestDb } from "./db";
import {
  activities,
  activityParticipants,
  users,
} from "@/db/schema";

describe("activity real-SQL queries", () => {
  let db: TestDb;
  let client: postgres.Sql;

  beforeAll(() => {
    ({ db, client } = getTestClient());
  });

  afterAll(async () => {
    if (client) await teardownTestDb(client);
  });

  beforeEach(async () => {
    await truncateAll(client);
  });

  it("inserts + selects an activity with creator join", async () => {
    const [creator] = await db
      .insert(users)
      .values({
        email: "creator@example.com",
        passwordHash: "$2b$12$dummy",
        displayName: "Anna Testsson",
        emailVerified: true,
      })
      .returning();

    const [activity] = await db
      .insert(activities)
      .values({
        title: "Kvällspromenad",
        description: "Test",
        location: "Västerås",
        creatorId: creator.id,
        startTime: new Date(Date.now() + 86_400_000),
        maxParticipants: 10,
        genderRestriction: "alla",
      })
      .returning();

    const rows = await db
      .select({
        title: activities.title,
        creatorName: users.displayName,
      })
      .from(activities)
      .innerJoin(users, eq(activities.creatorId, users.id))
      .where(eq(activities.id, activity.id));

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Kvällspromenad");
    expect(rows[0].creatorName).toBe("Anna Testsson");
  });

  it("enforces activity_participants composite primary key", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "user@example.com",
        passwordHash: "$2b$12$dummy",
        displayName: "Test",
        emailVerified: true,
      })
      .returning();

    const [activity] = await db
      .insert(activities)
      .values({
        title: "Test",
        description: "Test",
        location: "Västerås",
        creatorId: user.id,
        startTime: new Date(Date.now() + 86_400_000),
        genderRestriction: "alla",
      })
      .returning();

    await db.insert(activityParticipants).values({
      activityId: activity.id,
      userId: user.id,
      status: "attending",
    });

    // Second insert with same (activityId, userId) should fail on PK.
    await expect(
      db.insert(activityParticipants).values({
        activityId: activity.id,
        userId: user.id,
        status: "interested",
      }),
    ).rejects.toThrow();
  });

  it("cascade-deletes participants when user is removed", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "cascade@example.com",
        passwordHash: "$2b$12$dummy",
        displayName: "Cascade Test",
        emailVerified: true,
      })
      .returning();

    const [other] = await db
      .insert(users)
      .values({
        email: "other@example.com",
        passwordHash: "$2b$12$dummy",
        displayName: "Other",
        emailVerified: true,
      })
      .returning();

    const [activity] = await db
      .insert(activities)
      .values({
        title: "Test",
        description: "Test",
        location: "Västerås",
        creatorId: other.id,
        startTime: new Date(Date.now() + 86_400_000),
        genderRestriction: "alla",
      })
      .returning();

    await db.insert(activityParticipants).values({
      activityId: activity.id,
      userId: user.id,
      status: "attending",
    });

    await db.delete(users).where(eq(users.id, user.id));

    const remaining = await db
      .select()
      .from(activityParticipants)
      .where(
        and(
          eq(activityParticipants.activityId, activity.id),
          eq(activityParticipants.userId, user.id),
        ),
      );
    expect(remaining).toHaveLength(0);
  });
});
