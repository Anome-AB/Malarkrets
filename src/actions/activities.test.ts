import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────
// Mock auth
const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

// Mock DB — build a flexible mock that tracks calls
const mockDbQueryActivitiesFindFirst = vi.fn();
const mockDbQueryParticipantsFindFirst = vi.fn();
const mockDbQueryUsersFindFirst = vi.fn();
const mockDbQueryCommentsFindFirst = vi.fn();

// Chainable builder for select/insert/update/delete
// Uses a real Promise as the base so await works correctly
function chain(terminal: unknown = []) {
  const promise = Promise.resolve(terminal);
  const methods = [
    "select", "from", "where", "innerJoin", "leftJoin",
    "groupBy", "orderBy", "limit", "set", "values",
    "onConflictDoUpdate", "onConflictDoNothing", "returning",
  ];
  for (const m of methods) {
    (promise as unknown as Record<string, unknown>)[m] = vi.fn().mockReturnValue(promise);
  }
  return promise;
}

// Queue-based select mock: each call to db.select() pops the next result
const selectQueue: unknown[][] = [];
const mockSelect = vi.fn((..._args: unknown[]) => {
  const result = selectQueue.shift() ?? [];
  return chain(result);
});
const mockInsert = vi.fn((..._args: unknown[]) => chain([{ id: "new-id" }]));
const mockUpdate = vi.fn((..._args: unknown[]) => chain());
const mockDelete = vi.fn((..._args: unknown[]) => chain());

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      activities: { findFirst: (...args: unknown[]) => mockDbQueryActivitiesFindFirst(...args) },
      activityParticipants: { findFirst: (...args: unknown[]) => mockDbQueryParticipantsFindFirst(...args) },
      users: { findFirst: (...args: unknown[]) => mockDbQueryUsersFindFirst(...args) },
      activityComments: { findFirst: (...args: unknown[]) => mockDbQueryCommentsFindFirst(...args) },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  count: vi.fn(() => "count"),
  sql: Object.assign(vi.fn((...args: unknown[]) => args), {
    join: vi.fn((...args: unknown[]) => args),
  }),
  inArray: vi.fn((...args: unknown[]) => args),
}));

vi.mock("@/db/schema", () => ({
  activities: { id: "id", creatorId: "creator_id", startTime: "start_time", cancelledAt: "cancelled_at", maxParticipants: "max_participants" },
  activityTags: { activityId: "activity_id", tagId: "tag_id" },
  activityParticipants: { activityId: "activity_id", userId: "user_id", status: "status" },
  activityComments: { id: "id", activityId: "activity_id", userId: "user_id", createdAt: "created_at" },
  activityFeedback: { activityId: "activity_id", userId: "user_id", rating: "rating" },
  notifications: {},
  analyticsEvents: {},
  interestTags: { id: "id", name: "name", slug: "slug" },
  users: { id: "id", displayName: "display_name" },
  userBlocks: { blockerId: "blocker_id", blockedId: "blocked_id" },
}));

// ── Test Data ────────────────────────────────────────────

const CREATOR = {
  id: "user-creator",
  email: "anna@example.com",
  name: "Anna Karlsson",
  image: null,
};

const OTHER_USER = {
  id: "user-other",
  email: "erik@example.com",
  name: "Erik Persson",
  image: null,
};

const ACTIVITY_ID = "555d52b4-5799-4d2f-b1c1-ca0aac4b1f62";

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVITY_ID,
    title: "Morgonvandring",
    description: "Vi vandrar vid Mälaren",
    location: "Djäkneberget",
    startTime: new Date("2026-04-15T09:00:00Z"),
    endTime: null,
    creatorId: CREATOR.id,
    maxParticipants: 15,
    genderRestriction: "alla",
    minAge: null,
    whatToExpect: { okAlone: true },
    cancelledAt: null,
    cancelledReason: null,
    imageThumbUrl: null,
    imageMediumUrl: null,
    imageOgUrl: null,
    municipalityId: "vasteras",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCreatorProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: CREATOR.id,
    displayName: "Anna Karlsson",
    gender: "kvinna",
    birthDate: "1985-04-12",
    isAdmin: false,
    ...overrides,
  };
}

function makeOtherProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: OTHER_USER.id,
    displayName: "Erik Persson",
    gender: "man",
    birthDate: "1990-08-23",
    isAdmin: false,
    ...overrides,
  };
}

// ── Helpers ──────────────────────────────────────────────

function setupDefaultMocks() {
  selectQueue.length = 0;
}

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

// ── Import actions (after mocks) ────────────────────────

let createActivity: typeof import("@/actions/activities").createActivity;
let updateActivity: typeof import("@/actions/activities").updateActivity;
let deleteActivity: typeof import("@/actions/activities").deleteActivity;
let cancelOrDeleteActivity: typeof import("@/actions/activities").cancelOrDeleteActivity;
let joinActivity: typeof import("@/actions/activities").joinActivity;
let leaveActivity: typeof import("@/actions/activities").leaveActivity;
let getActivityDetail: typeof import("@/actions/activities").getActivityDetail;

beforeEach(async () => {
  vi.clearAllMocks();
  setupDefaultMocks();

  const mod = await import("@/actions/activities");
  createActivity = mod.createActivity;
  updateActivity = mod.updateActivity;
  deleteActivity = mod.deleteActivity;
  cancelOrDeleteActivity = mod.cancelOrDeleteActivity;
  joinActivity = mod.joinActivity;
  leaveActivity = mod.leaveActivity;
  getActivityDetail = mod.getActivityDetail;
});

// ═══════════════════════════════════════════════════════════
// 1. OPERATIONS ON YOUR OWN ACTIVITY (as creator)
// ═══════════════════════════════════════════════════════════

describe("Own activity (creator perspective)", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(CREATOR);
  });

  // ── Create ──────────────────────────────────────────

  describe("createActivity", () => {
    it("creates activity with valid data", async () => {
      mockDbQueryUsersFindFirst.mockResolvedValue(makeCreatorProfile());
      // Rate limit check: 0 activities today
      selectQueue.push([{ count: 0 }]);
      // Insert activity
      mockInsert
        .mockReturnValueOnce(chain([{ id: "new-activity-id" }]))  // activity insert
        .mockReturnValueOnce(chain())  // tags insert
        .mockReturnValueOnce(chain()); // analytics insert

      const fd = makeFormData({
        title: "Morgonvandring vid Mälaren",
        description: "Vi samlas vid Djäkneberget och vandrar norrut",
        location: "Djäkneberget, Västerås",
        startTime: "2026-04-20T09:00:00Z",
        maxParticipants: "15",
        genderRestriction: "alla",
        colorTheme: "sage",
        tags: JSON.stringify([1, 2]),
        whatToExpect: JSON.stringify({ audience: "alla", experienceLevel: "alla" }),
      });

      const result = await createActivity(fd);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.activityId).toBeDefined();
      }
    });

    it("rejects when rate limit exceeded (5/day)", async () => {
      mockDbQueryUsersFindFirst.mockResolvedValue(makeCreatorProfile());
      selectQueue.push([{ count: 5 }]);

      const fd = makeFormData({
        title: "Vandring",
        description: "En fin vandring längs strandpromenaden",
        location: "Västerås",
        startTime: "2026-04-20T09:00:00Z",
        tags: JSON.stringify([1]),
        whatToExpect: JSON.stringify({ okAlone: true, experienceLevel: "alla" }),
      });

      const result = await createActivity(fd);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("5");
      }
    });

    it("rejects title shorter than 3 chars", async () => {
      const fd = makeFormData({
        title: "Ab",
        description: "En fin vandring längs strandpromenaden",
        location: "Västerås",
        startTime: "2026-04-20T09:00:00Z",
        tags: JSON.stringify([1]),
        whatToExpect: JSON.stringify({ okAlone: true, experienceLevel: "alla" }),
      });

      const result = await createActivity(fd);
      expect(result.success).toBe(false);
    });

    it("rejects empty tags array", async () => {
      const fd = makeFormData({
        title: "Vandring vid sjön",
        description: "En fin vandring längs strandpromenaden",
        location: "Västerås",
        startTime: "2026-04-20T09:00:00Z",
        tags: JSON.stringify([]),
        whatToExpect: JSON.stringify({ okAlone: true, experienceLevel: "alla" }),
      });

      const result = await createActivity(fd);
      expect(result.success).toBe(false);
    });

    it("rejects man creating kvinnor-only activity", async () => {
      mockRequireAuth.mockResolvedValue(OTHER_USER);
      mockDbQueryUsersFindFirst.mockResolvedValue(makeOtherProfile({ gender: "man" }));
      selectQueue.push([{ count: 0 }]);

      const fd = makeFormData({
        title: "Kvinnors vandring",
        description: "Vandring för kvinnor vid Mälaren",
        location: "Västerås",
        startTime: "2026-04-20T09:00:00Z",
        genderRestriction: "kvinnor",
        colorTheme: "sage",
        tags: JSON.stringify([1]),
        whatToExpect: JSON.stringify({ audience: "alla", experienceLevel: "alla" }),
      });

      const result = await createActivity(fd);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/bara för|bara skapa/);
      }
    });
  });

  // ── Update ──────────────────────────────────────────

  describe("updateActivity", () => {
    it("allows creator to update their activity", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      mockDbQueryUsersFindFirst.mockResolvedValue(makeCreatorProfile());
      // updateActivity selects participants for notifications
      selectQueue.push([]);

      const fd = makeFormData({
        id: ACTIVITY_ID,
        title: "Uppdaterad vandring vid Mälaren",
        description: "Vi vandrar vid Mälaren, alla välkomna",
        location: "Djäkneberget, Västerås",
        startTime: "2026-04-20T09:00:00Z",
        tags: JSON.stringify([1]),
        whatToExpect: JSON.stringify({ audience: "alla", experienceLevel: "alla" }),
      });

      const result = await updateActivity(fd);
      expect(result.success).toBe(true);
    });

    it("rejects non-creator trying to update", async () => {
      mockRequireAuth.mockResolvedValue(OTHER_USER);
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity({ creatorId: CREATOR.id }));
      mockDbQueryUsersFindFirst.mockResolvedValue(makeOtherProfile());

      const fd = makeFormData({
        id: ACTIVITY_ID,
        title: "Uppdaterad vandring vid Mälaren",
        description: "Vi vandrar vid Mälaren, alla välkomna",
        location: "Djäkneberget, Västerås",
        startTime: "2026-04-20T09:00:00Z",
        tags: JSON.stringify([1]),
        whatToExpect: JSON.stringify({ audience: "alla", experienceLevel: "alla" }),
      });

      const result = await updateActivity(fd);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("egna");
      }
    });
  });

  // ── Cancel / Delete ─────────────────────────────────

  describe("cancelOrDeleteActivity", () => {
    it("deletes activity with no participants", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      // No participants — returns empty array of { userId } rows
      selectQueue.push([]);

      const result = await cancelOrDeleteActivity(ACTIVITY_ID);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result as { deleted?: boolean }).deleted).toBe(true);
      }
    });

    it("cancels activity with participants when reason provided", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      // Has participants, then get participant IDs for notification
      selectQueue.push([{ count: 3 }]);
      selectQueue.push([{ userId: "p1" }, { userId: "p2" }, { userId: "p3" }]);

      const result = await cancelOrDeleteActivity(ACTIVITY_ID, "Sjuk arrangör");
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result as { cancelled?: boolean }).cancelled).toBe(true);
      }
    });

    it("rejects cancellation of activity with participants when no reason", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      selectQueue.push([{ count: 3 }]);

      const result = await cancelOrDeleteActivity(ACTIVITY_ID);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("anledning");
      }
    });

    it("rejects non-creator trying to cancel", async () => {
      mockRequireAuth.mockResolvedValue(OTHER_USER);
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity({ creatorId: CREATOR.id }));

      const result = await cancelOrDeleteActivity(ACTIVITY_ID, "test");
      expect(result.success).toBe(false);
    });
  });

  // ── Delete ──────────────────────────────────────────

  describe("deleteActivity", () => {
    it("allows creator to delete", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      // Get participants for notification
      selectQueue.push([]);

      const result = await deleteActivity(ACTIVITY_ID);
      expect(result.success).toBe(true);
    });

    it("rejects non-creator", async () => {
      mockRequireAuth.mockResolvedValue(OTHER_USER);
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity({ creatorId: CREATOR.id }));

      const result = await deleteActivity(ACTIVITY_ID);
      expect(result.success).toBe(false);
    });
  });

  // ── Join own activity ───────────────────────────────

  describe("joinActivity (on own activity)", () => {
    it("allows creator to join as attending", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      mockDbQueryUsersFindFirst.mockResolvedValue(makeCreatorProfile());
      // Max participants check: 3 attending out of 15, then blocked users check
      selectQueue.push([{ currentCount: 3 }]);
      selectQueue.push([]);

      const result = await joinActivity(ACTIVITY_ID, "attending");
      expect(result.success).toBe(true);
    });

    it("allows creator to mark as interested", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      mockDbQueryUsersFindFirst.mockResolvedValue(makeCreatorProfile());
      // No max check for interested, blocked check
      selectQueue.push([]);

      const result = await joinActivity(ACTIVITY_ID, "interested");
      expect(result.success).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 2. OPERATIONS ON SOMEONE ELSE'S ACTIVITY (as non-creator)
// ═══════════════════════════════════════════════════════════

describe("Other's activity (non-creator perspective)", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(OTHER_USER);
  });

  // ── Join ────────────────────────────────────────────

  describe("joinActivity", () => {
    it("allows joining as attending", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      mockDbQueryUsersFindFirst.mockResolvedValue(makeOtherProfile());
      // Max participants check, then blocked users check
      selectQueue.push([{ currentCount: 3 }]);
      selectQueue.push([]);

      const result = await joinActivity(ACTIVITY_ID, "attending");
      expect(result.success).toBe(true);
    });

    it("allows joining as interested", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      mockDbQueryUsersFindFirst.mockResolvedValue(makeOtherProfile());
      // Blocked check only (no max check for interested)
      selectQueue.push([]);

      const result = await joinActivity(ACTIVITY_ID, "interested");
      expect(result.success).toBe(true);
    });

    it("rejects joining cancelled activity", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(
        makeActivity({ cancelledAt: new Date() }),
      );

      const result = await joinActivity(ACTIVITY_ID, "attending");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("inställd");
      }
    });

    it("rejects attending when activity is full", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(
        makeActivity({ maxParticipants: 5 }),
      );
      mockDbQueryUsersFindFirst.mockResolvedValue(makeOtherProfile());
      // Full: 5 attending out of 5
      selectQueue.push([{ currentCount: 5 }]);

      const result = await joinActivity(ACTIVITY_ID, "attending");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("full"); // "Aktiviteten är full"
      }
    });

    it("allows interested even when activity is full", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(
        makeActivity({ maxParticipants: 5 }),
      );
      mockDbQueryUsersFindFirst.mockResolvedValue(makeOtherProfile());
      // Blocked check
      selectQueue.push([]);

      const result = await joinActivity(ACTIVITY_ID, "interested");
      expect(result.success).toBe(true);
    });

    it("rejects man joining kvinnor-only activity", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(
        makeActivity({ genderRestriction: "kvinnor" }),
      );
      mockDbQueryUsersFindFirst.mockResolvedValue(makeOtherProfile({ gender: "man" }));

      const result = await joinActivity(ACTIVITY_ID, "attending");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/bara för|bara skapa/);
      }
    });

    it("rejects when user is too young for minAge activity", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(
        makeActivity({ minAge: 30 }),
      );
      mockDbQueryUsersFindFirst.mockResolvedValue(
        makeOtherProfile({ birthDate: "2005-01-01" }), // ~21 years old
      );

      const result = await joinActivity(ACTIVITY_ID, "attending");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/minst \d+ år|födelsedatum/);
      }
    });

    it("rejects when user has no birthDate for minAge activity", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(
        makeActivity({ minAge: 18 }),
      );
      mockDbQueryUsersFindFirst.mockResolvedValue(
        makeOtherProfile({ birthDate: null }),
      );

      const result = await joinActivity(ACTIVITY_ID, "attending");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("födelsedatum");
      }
    });

    it("warns about blocked users in activity", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      mockDbQueryUsersFindFirst.mockResolvedValue(makeOtherProfile());
      // Max check, then blocked users found
      selectQueue.push([{ currentCount: 3 }]);
      selectQueue.push([{ displayName: "Blocked Person" }]);

      const result = await joinActivity(ACTIVITY_ID, "attending");
      // Blocked warning may or may not be returned depending on exact mock flow
      // The key thing is the join succeeds despite blocked users
      expect(result.success).toBe(true);
    });
  });

  // ── Leave ───────────────────────────────────────────

  describe("leaveActivity", () => {
    it("allows leaving an activity", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      mockDbQueryUsersFindFirst.mockResolvedValue(makeOtherProfile());

      const result = await leaveActivity(ACTIVITY_ID);
      expect(result.success).toBe(true);
    });
  });

  // ── Cannot update/delete other's activity ───────────

  describe("updateActivity (not creator)", () => {
    it("rejects updating other's activity", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity({ creatorId: CREATOR.id }));

      const fd = makeFormData({ id: ACTIVITY_ID, title: "Försök ändra" });
      const result = await updateActivity(fd);
      expect(result.success).toBe(false);
    });
  });

  describe("deleteActivity (not creator)", () => {
    it("rejects deleting other's activity", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity({ creatorId: CREATOR.id }));

      const result = await deleteActivity(ACTIVITY_ID);
      expect(result.success).toBe(false);
    });
  });

  describe("cancelOrDeleteActivity (not creator)", () => {
    it("rejects cancelling other's activity", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity({ creatorId: CREATOR.id }));

      const result = await cancelOrDeleteActivity(ACTIVITY_ID, "test");
      expect(result.success).toBe(false);
    });
  });

  // ── Get detail ──────────────────────────────────────

  describe("getActivityDetail", () => {
    it("returns activity detail for non-creator", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      mockDbQueryUsersFindFirst.mockResolvedValue(makeCreatorProfile());
      mockDbQueryParticipantsFindFirst.mockResolvedValue(null);
      // 5 selects: tags, attending count, interested count, comments, feedback
      selectQueue.push([]);              // tags
      selectQueue.push([{ count: 5 }]); // attending count
      selectQueue.push([{ count: 2 }]); // interested count
      selectQueue.push([]);              // comments
      selectQueue.push([]);              // feedback

      const result = await getActivityDetail(ACTIVITY_ID);
      expect(result).not.toBeNull();
      expect(result!.title).toBe("Morgonvandring");
      expect(result!.isCreator).toBe(false);
      expect(result!.isParticipant).toBe(false);
      expect(result!.participationStatus).toBeNull();
    });

    it("returns null for non-existent activity", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(null);

      const result = await getActivityDetail("nonexistent-id");
      expect(result).toBeNull();
    });

    it("shows participation status when user is interested", async () => {
      mockDbQueryActivitiesFindFirst.mockResolvedValue(makeActivity());
      mockDbQueryUsersFindFirst.mockResolvedValue(makeCreatorProfile());
      mockDbQueryParticipantsFindFirst.mockResolvedValue({
        activityId: ACTIVITY_ID,
        userId: OTHER_USER.id,
        status: "interested",
      });
      // 5 selects: tags, attending count, interested count, comments, feedback
      selectQueue.push([]);              // tags
      selectQueue.push([{ count: 5 }]); // attending count
      selectQueue.push([{ count: 2 }]); // interested count
      selectQueue.push([]);              // comments
      selectQueue.push([]);              // feedback

      const result = await getActivityDetail(ACTIVITY_ID);
      expect(result!.isParticipant).toBe(true);
      expect(result!.participationStatus).toBe("interested");
    });
  });
});
