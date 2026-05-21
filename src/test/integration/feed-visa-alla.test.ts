// Integration tests for getMatchedActivities "Visa alla" (showAll) mode.
// Verifies that regular-user showAll respects gender + minAge restrictions
// while admin showAll bypasses everything. Covers the query-level predicate
// branching in src/lib/queries/activity-feed.ts that the mock-DB cannot see.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type postgres from "postgres";
import { getTestClient, teardownTestDb, truncateAll, type TestDb } from "./db";
import {
  activities,
  activityTags,
  interestTags,
  userBlocks,
  userInterests,
  users,
} from "@/db/schema";
import { getMatchedActivities } from "@/lib/queries/activity-feed";

async function seedTag(db: TestDb, name: string) {
  const [tag] = await db
    .insert(interestTags)
    .values({ name, slug: name.toLowerCase().replace(/\s+/g, "-") })
    .returning();
  return tag;
}

async function seedUser(
  db: TestDb,
  overrides: Partial<{
    email: string;
    gender: "man" | "kvinna" | "ej_angett";
    birthDate: string;
    isAdmin: boolean;
  }> = {},
) {
  const [u] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `user-${Math.random()}@example.com`,
      passwordHash: "$2b$12$dummy",
      emailVerified: true,
      gender: overrides.gender ?? "ej_angett",
      birthDate: overrides.birthDate ?? null,
      isAdmin: overrides.isAdmin ?? false,
    })
    .returning();
  return u;
}

async function seedActivity(
  db: TestDb,
  creatorId: string,
  tagId: number,
  overrides: Partial<{
    title: string;
    genderRestriction: "alla" | "kvinnor" | "man";
    minAge: number;
  }> = {},
) {
  const [a] = await db
    .insert(activities)
    .values({
      title: overrides.title ?? "Aktivitet",
      description: "Beskrivning",
      location: "Västerås",
      creatorId,
      startTime: new Date(Date.now() + 86_400_000),
      genderRestriction: overrides.genderRestriction ?? "alla",
      minAge: overrides.minAge ?? null,
      // Feed-queryn filtrerar bort drafts (publishedAt IS NULL).
      // Testfixturer är publika aktiviteter, så sätt publishedAt direkt.
      publishedAt: new Date(),
    })
    .returning();
  await db.insert(activityTags).values({ activityId: a.id, tagId });
  return a;
}

describe('getMatchedActivities "Visa alla" (showAll)', () => {
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

  it("regular user: hides kvinnor-only activity from man even with showAll", async () => {
    const tag = await seedTag(db, "Vandring");
    const creator = await seedUser(db, { email: "anna@x.se", gender: "kvinna" });
    const viewer = await seedUser(db, { email: "erik@x.se", gender: "man" });

    await seedActivity(db, creator.id, tag.id, {
      title: "Tjejvandring",
      genderRestriction: "kvinnor",
    });

    const results = await getMatchedActivities(
      viewer.id,
      viewer.gender,
      null,
      undefined,
      undefined,
      true, // showAll
      false, // isAdmin
    );

    expect(results).toHaveLength(0);
  });

  it("admin: sees kvinnor-only activity even as man with showAll", async () => {
    const tag = await seedTag(db, "Vandring");
    const creator = await seedUser(db, { email: "anna@x.se", gender: "kvinna" });
    const admin = await seedUser(db, {
      email: "admin@x.se",
      gender: "man",
      isAdmin: true,
    });

    await seedActivity(db, creator.id, tag.id, {
      title: "Tjejvandring",
      genderRestriction: "kvinnor",
    });

    const results = await getMatchedActivities(
      admin.id,
      admin.gender,
      null,
      undefined,
      undefined,
      true, // showAll
      true, // isAdmin
    );

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Tjejvandring");
  });

  it("regular user with showAll: hides minAge-gated activity when under age", async () => {
    const tag = await seedTag(db, "Vandring");
    const creator = await seedUser(db, { email: "c@x.se" });
    // 20 years old
    const youngViewer = await seedUser(db, {
      email: "young@x.se",
      birthDate: "2006-04-22",
    });

    await seedActivity(db, creator.id, tag.id, {
      title: "Vuxenaktivitet",
      minAge: 25,
    });

    const results = await getMatchedActivities(
      youngViewer.id,
      youngViewer.gender,
      20,
      undefined,
      undefined,
      true,
      false,
    );

    expect(results).toHaveLength(0);
  });

  it("regular user with showAll: hides minAge-gated activity when birthDate missing", async () => {
    const tag = await seedTag(db, "Vandring");
    const creator = await seedUser(db, { email: "c@x.se" });
    const viewer = await seedUser(db, { email: "nobirth@x.se" });

    await seedActivity(db, creator.id, tag.id, {
      title: "Vuxenaktivitet",
      minAge: 18,
    });

    const results = await getMatchedActivities(
      viewer.id,
      viewer.gender,
      null,
      undefined,
      undefined,
      true,
      false,
    );

    expect(results).toHaveLength(0);
  });

  it("regular user with showAll: shows 'alla'-activity they don't match interests on", async () => {
    // This is the whole point of "Visa alla" for regular users: see activities
    // you have no interest-match to, as long as they're not gender- or age-gated.
    const tag = await seedTag(db, "Jakt");
    const creator = await seedUser(db, { email: "c@x.se" });
    const viewer = await seedUser(db, { email: "v@x.se", gender: "man" });

    // viewer has NO userInterests rows - no tag overlap
    await seedActivity(db, creator.id, tag.id, {
      title: "Obekant aktivitet",
      genderRestriction: "alla",
    });

    const results = await getMatchedActivities(
      viewer.id,
      viewer.gender,
      30,
      undefined,
      undefined,
      true,
      false,
    );

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Obekant aktivitet");
  });

  it("regular user without showAll: interest-matching still gates the feed", async () => {
    const tag = await seedTag(db, "Jakt");
    const creator = await seedUser(db, { email: "c@x.se" });
    const viewer = await seedUser(db, { email: "v@x.se", gender: "man" });

    await seedActivity(db, creator.id, tag.id, {
      title: "Obekant aktivitet",
    });

    const results = await getMatchedActivities(
      viewer.id,
      viewer.gender,
      30,
      undefined,
      undefined,
      false,
      false,
    );

    expect(results).toHaveLength(0);
  });

  // ── Admin bypass av creator-blocks ──────────────────────────────────────
  // En vanlig användare ska kunna gömma sina aktiviteter från en annan
  // vanlig användare genom att blockera dem. Men en admin behöver kunna se
  // alla aktiviteter för att kunna moderera - även de som blockerat admin.

  it("regular user blocked by creator: aktivitet doldas från viewer", async () => {
    const tag = await seedTag(db, "Vandring");
    const creator = await seedUser(db, { email: "c@x.se" });
    const viewer = await seedUser(db, { email: "v@x.se" });
    // Viewer har intresse-matchning (annars filtreras aktiviteten ändå)
    await db.insert(userInterests).values({ userId: viewer.id, tagId: tag.id });

    await seedActivity(db, creator.id, tag.id, { title: "Privat vandring" });
    // Creator blockerar viewer
    await db
      .insert(userBlocks)
      .values({ blockerId: creator.id, blockedId: viewer.id });

    const results = await getMatchedActivities(
      viewer.id,
      viewer.gender,
      null,
      undefined,
      undefined,
      false, // showAll
      false, // isAdmin
    );

    expect(results).toHaveLength(0);
  });

  it("admin blocked by creator: ser fortfarande aktiviteten (moderation-bypass)", async () => {
    const tag = await seedTag(db, "Vandring");
    const creator = await seedUser(db, { email: "c@x.se" });
    const admin = await seedUser(db, { email: "a@x.se", isAdmin: true });
    await db.insert(userInterests).values({ userId: admin.id, tagId: tag.id });

    await seedActivity(db, creator.id, tag.id, { title: "Privat vandring" });
    // Creator blockerar admin - ska INTE dölja aktiviteten för admin
    await db
      .insert(userBlocks)
      .values({ blockerId: creator.id, blockedId: admin.id });

    const results = await getMatchedActivities(
      admin.id,
      admin.gender,
      null,
      undefined,
      undefined,
      false, // showAll
      true, // isAdmin
    );

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Privat vandring");
  });

  it("admin har själv blockerat creator: aktiviteten doldas i Mina intressen (personligt flöde)", async () => {
    const tag = await seedTag(db, "Vandring");
    const creator = await seedUser(db, { email: "c@x.se" });
    const admin = await seedUser(db, { email: "a@x.se", isAdmin: true });
    await db.insert(userInterests).values({ userId: admin.id, tagId: tag.id });

    await seedActivity(db, creator.id, tag.id, { title: "Vandring" });
    // Admin blockerar creator - admins personliga flöde respekterar det.
    await db
      .insert(userBlocks)
      .values({ blockerId: admin.id, blockedId: creator.id });

    const results = await getMatchedActivities(
      admin.id,
      admin.gender,
      null,
      undefined,
      undefined,
      false, // showAll = Mina intressen
      true, // isAdmin
    );

    expect(results).toHaveLength(0);
  });

  it("admin har själv blockerat creator: aktiviteten syns ändå i Visa alla (moderation-bypass)", async () => {
    const tag = await seedTag(db, "Vandring");
    const creator = await seedUser(db, { email: "c@x.se" });
    const admin = await seedUser(db, { email: "a@x.se", isAdmin: true });

    await seedActivity(db, creator.id, tag.id, { title: "Vandring" });
    // Admin blockerar creator men byter till Visa alla - moderation kräver
    // full visibilitet även för admins egna blocks.
    await db
      .insert(userBlocks)
      .values({ blockerId: admin.id, blockedId: creator.id });

    const results = await getMatchedActivities(
      admin.id,
      admin.gender,
      null,
      undefined,
      undefined,
      true, // showAll = full moderation-vy
      true, // isAdmin
    );

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Vandring");
  });

  it("vanlig användare har blockerat creator + Visa alla: aktiviteten doldas (regular users har full block-respekt)", async () => {
    const tag = await seedTag(db, "Vandring");
    const creator = await seedUser(db, { email: "c@x.se" });
    const viewer = await seedUser(db, { email: "v@x.se" });

    await seedActivity(db, creator.id, tag.id, { title: "Vandring" });
    // Vanlig användare blockerar creator - även Visa alla respekterar det
    // för vanliga användare (bara admins får moderation-bypass i Visa alla).
    await db
      .insert(userBlocks)
      .values({ blockerId: viewer.id, blockedId: creator.id });

    const results = await getMatchedActivities(
      viewer.id,
      viewer.gender,
      null,
      undefined,
      undefined,
      true, // showAll
      false, // isAdmin
    );

    expect(results).toHaveLength(0);
  });
});
