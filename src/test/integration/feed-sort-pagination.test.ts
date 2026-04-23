// Integration tests for feed sort + offset-pagination. Covers the
// predicate branches in src/lib/queries/activity-feed.ts that are hard to
// verify against the mock-DB layer: chronological ordering (datum →
// starttid) and offset-based pagination stability.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type postgres from "postgres";
import { getTestClient, teardownTestDb, truncateAll, type TestDb } from "./db";
import {
  activities,
  activityTags,
  interestTags,
  userInterests,
  users,
} from "@/db/schema";
import {
  FEED_PAGE_SIZE,
  getMatchedActivities,
} from "@/lib/queries/activity-feed";

async function seedTag(db: TestDb, name = "Vandring") {
  const [t] = await db
    .insert(interestTags)
    .values({ name, slug: name.toLowerCase() })
    .returning();
  return t;
}

async function seedUserWithInterest(
  db: TestDb,
  tagId: number,
  overrides: Partial<{
    email: string;
    gender: "man" | "kvinna" | "ej_angett";
  }> = {},
) {
  const [u] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `u-${Math.random()}@x.se`,
      passwordHash: "$2b$12$dummy",
      emailVerified: true,
      gender: overrides.gender ?? "ej_angett",
    })
    .returning();
  await db.insert(userInterests).values({ userId: u.id, tagId });
  return u;
}

async function seedActivity(
  db: TestDb,
  creatorId: string,
  tagId: number,
  startTime: Date,
  title = "A",
) {
  const [a] = await db
    .insert(activities)
    .values({
      title,
      description: "desc",
      location: "Västerås",
      creatorId,
      startTime,
      genderRestriction: "alla",
    })
    .returning();
  await db.insert(activityTags).values({ activityId: a.id, tagId });
  return a;
}

describe("getMatchedActivities — sort + offset", () => {
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

  it("orders activities chronologically (earlier date first) regardless of creation order", async () => {
    const tag = await seedTag(db);
    const viewer = await seedUserWithInterest(db, tag.id);
    const creator = await seedUserWithInterest(db, tag.id, {
      email: "creator@x.se",
    });

    // Seed out-of-order: create the "latest" activity first, then the
    // earliest. A buggy order-by-createdAt or order-by-relevance would
    // put the newest-created activity at the top instead of the earliest
    // in calendar time.
    const laterStart = new Date(Date.now() + 10 * 86_400_000); // +10 days
    const earlierStart = new Date(Date.now() + 2 * 86_400_000); // +2 days
    const middleStart = new Date(Date.now() + 5 * 86_400_000); // +5 days

    await seedActivity(db, creator.id, tag.id, laterStart, "Sent");
    await seedActivity(db, creator.id, tag.id, earlierStart, "Tidigt");
    await seedActivity(db, creator.id, tag.id, middleStart, "Mitten");

    const results = await getMatchedActivities(
      viewer.id,
      viewer.gender,
      null,
    );

    expect(results.map((r) => r.title)).toEqual(["Tidigt", "Mitten", "Sent"]);
  });

  it("sorts same-date activities by start time of day", async () => {
    const tag = await seedTag(db);
    const viewer = await seedUserWithInterest(db, tag.id);
    const creator = await seedUserWithInterest(db, tag.id, {
      email: "creator@x.se",
    });

    const base = new Date();
    base.setDate(base.getDate() + 3);
    base.setHours(0, 0, 0, 0);

    const morning = new Date(base);
    morning.setHours(9, 0, 0, 0);
    const afternoon = new Date(base);
    afternoon.setHours(14, 0, 0, 0);
    const evening = new Date(base);
    evening.setHours(19, 30, 0, 0);

    await seedActivity(db, creator.id, tag.id, evening, "Kväll");
    await seedActivity(db, creator.id, tag.id, morning, "Morgon");
    await seedActivity(db, creator.id, tag.id, afternoon, "Eftermiddag");

    const results = await getMatchedActivities(
      viewer.id,
      viewer.gender,
      null,
    );

    expect(results.map((r) => r.title)).toEqual([
      "Morgon",
      "Eftermiddag",
      "Kväll",
    ]);
  });

  it("respects FEED_PAGE_SIZE limit", async () => {
    const tag = await seedTag(db);
    const viewer = await seedUserWithInterest(db, tag.id);
    const creator = await seedUserWithInterest(db, tag.id, {
      email: "creator@x.se",
    });

    for (let i = 0; i < FEED_PAGE_SIZE + 5; i++) {
      const start = new Date(Date.now() + (i + 1) * 86_400_000);
      await seedActivity(db, creator.id, tag.id, start, `A${i}`);
    }

    const firstPage = await getMatchedActivities(
      viewer.id,
      viewer.gender,
      null,
    );
    expect(firstPage).toHaveLength(FEED_PAGE_SIZE);
  });

  it("offset-based pagination returns the next slice without overlap", async () => {
    const tag = await seedTag(db);
    const viewer = await seedUserWithInterest(db, tag.id);
    const creator = await seedUserWithInterest(db, tag.id, {
      email: "creator@x.se",
    });

    const total = FEED_PAGE_SIZE + 10;
    for (let i = 0; i < total; i++) {
      const start = new Date(Date.now() + (i + 1) * 86_400_000);
      await seedActivity(db, creator.id, tag.id, start, `A${i}`);
    }

    const page1 = await getMatchedActivities(
      viewer.id,
      viewer.gender,
      null,
      0,
    );
    const page2 = await getMatchedActivities(
      viewer.id,
      viewer.gender,
      null,
      FEED_PAGE_SIZE,
    );

    expect(page1).toHaveLength(FEED_PAGE_SIZE);
    expect(page2).toHaveLength(total - FEED_PAGE_SIZE);

    const ids1 = new Set(page1.map((a) => a.id));
    const overlap = page2.filter((a) => ids1.has(a.id));
    expect(overlap).toHaveLength(0);
  });
});
