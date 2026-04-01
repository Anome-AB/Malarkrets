import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────
const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

const mockDbQueryParticipantsFindFirst = vi.fn();
const mockDbQueryCommentsFindFirst = vi.fn();
const mockDbQueryActivitiesFindFirst = vi.fn();

function chain(terminal: unknown = []) {
  const promise = Promise.resolve(terminal);
  const methods = [
    "select", "from", "where", "innerJoin", "leftJoin",
    "groupBy", "orderBy", "limit", "set", "values",
    "onConflictDoUpdate", "returning",
  ];
  for (const m of methods) {
    (promise as Record<string, unknown>)[m] = vi.fn().mockReturnValue(promise);
  }
  return promise;
}

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      activityParticipants: { findFirst: (...args: unknown[]) => mockDbQueryParticipantsFindFirst(...args) },
      activityComments: { findFirst: (...args: unknown[]) => mockDbQueryCommentsFindFirst(...args) },
      activities: { findFirst: (...args: unknown[]) => mockDbQueryActivitiesFindFirst(...args) },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
  count: vi.fn(() => "count"),
  sql: Object.assign(vi.fn((...args: unknown[]) => args), {
    join: vi.fn((...args: unknown[]) => args),
  }),
}));

vi.mock("@/db/schema", () => ({
  activityComments: { id: "id", activityId: "activity_id", userId: "user_id", createdAt: "created_at" },
  activityParticipants: { activityId: "activity_id", userId: "user_id", status: "status" },
  activityFeedback: { activityId: "activity_id", userId: "user_id", rating: "rating" },
  activities: { id: "id", startTime: "start_time" },
  analyticsEvents: {},
}));

// ── Test Data ────────────────────────────────────────────

const CREATOR = { id: "user-creator", email: "anna@example.com", name: "Anna", image: null };
const PARTICIPANT = { id: "user-participant", email: "erik@example.com", name: "Erik", image: null };
const OUTSIDER = { id: "user-outsider", email: "lisa@example.com", name: "Lisa", image: null };
const ACTIVITY_ID = "555d52b4-5799-4d2f-b1c1-ca0aac4b1f62";

let createComment: typeof import("@/actions/comments").createComment;
let deleteComment: typeof import("@/actions/comments").deleteComment;

beforeEach(async () => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue(chain([]));
  mockInsert.mockReturnValue(chain());
  mockDelete.mockReturnValue(chain());

  const mod = await import("@/actions/comments");
  createComment = mod.createComment;
  deleteComment = mod.deleteComment;
});

// ═══════════════════════════════════════════════════════════
// COMMENTS ON OWN ACTIVITY (as creator)
// ═══════════════════════════════════════════════════════════

describe("Comments on own activity (creator)", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(CREATOR);
  });

  it("creator can comment when participating", async () => {
    mockDbQueryParticipantsFindFirst.mockResolvedValue({
      activityId: ACTIVITY_ID,
      userId: CREATOR.id,
      status: "attending",
    });
    // Rate limit: 0 today
    mockSelect.mockReturnValueOnce(chain([{ count: 0 }]));

    const fd = new FormData();
    fd.set("activityId", ACTIVITY_ID);
    fd.set("content", "Välkommen alla!");

    const result = await createComment(fd);
    expect(result.success).toBe(true);
  });

  it("creator can delete any comment on their activity", async () => {
    // Comment by someone else
    mockDbQueryCommentsFindFirst.mockResolvedValue({
      id: "comment-1",
      activityId: ACTIVITY_ID,
      userId: PARTICIPANT.id,
      content: "En fråga",
    });
    // Activity lookup — creator check
    mockDbQueryActivitiesFindFirst.mockResolvedValue({
      id: ACTIVITY_ID,
      creatorId: CREATOR.id,
    });

    const result = await deleteComment("comment-1");
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// COMMENTS ON SOMEONE ELSE'S ACTIVITY
// ═══════════════════════════════════════════════════════════

describe("Comments on other's activity (participant)", () => {
  beforeEach(() => {
    mockRequireAuth.mockResolvedValue(PARTICIPANT);
  });

  it("attending participant can comment", async () => {
    mockDbQueryParticipantsFindFirst.mockResolvedValue({
      activityId: ACTIVITY_ID,
      userId: PARTICIPANT.id,
      status: "attending",
    });
    mockSelect.mockReturnValueOnce(chain([{ count: 0 }]));

    const fd = new FormData();
    fd.set("activityId", ACTIVITY_ID);
    fd.set("content", "Ser fram emot det!");

    const result = await createComment(fd);
    expect(result.success).toBe(true);
  });

  it("interested participant can comment", async () => {
    mockDbQueryParticipantsFindFirst.mockResolvedValue({
      activityId: ACTIVITY_ID,
      userId: PARTICIPANT.id,
      status: "interested",
    });
    mockSelect.mockReturnValueOnce(chain([{ count: 0 }]));

    const fd = new FormData();
    fd.set("activityId", ACTIVITY_ID);
    fd.set("content", "Vad ska man ha på sig?");

    const result = await createComment(fd);
    expect(result.success).toBe(true);
  });

  it("non-participant cannot comment", async () => {
    mockRequireAuth.mockResolvedValue(OUTSIDER);
    mockDbQueryParticipantsFindFirst.mockResolvedValue(null);

    const fd = new FormData();
    fd.set("activityId", ACTIVITY_ID);
    fd.set("content", "Kan jag komma?");

    const result = await createComment(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("deltagare");
    }
  });

  it("rejects empty comment", async () => {
    const fd = new FormData();
    fd.set("activityId", ACTIVITY_ID);
    fd.set("content", "");

    const result = await createComment(fd);
    expect(result.success).toBe(false);
  });

  it("rejects comment over 2000 chars", async () => {
    const fd = new FormData();
    fd.set("activityId", ACTIVITY_ID);
    fd.set("content", "x".repeat(2001));

    const result = await createComment(fd);
    expect(result.success).toBe(false);
  });

  it("participant can delete own comment", async () => {
    mockDbQueryCommentsFindFirst.mockResolvedValue({
      id: "comment-2",
      activityId: ACTIVITY_ID,
      userId: PARTICIPANT.id,
      content: "Min kommentar",
    });

    const result = await deleteComment("comment-2");
    expect(result.success).toBe(true);
  });

  it("participant cannot delete other's comment", async () => {
    mockDbQueryCommentsFindFirst.mockResolvedValue({
      id: "comment-3",
      activityId: ACTIVITY_ID,
      userId: CREATOR.id,
      content: "Arrangörens kommentar",
    });
    // Activity creator check — participant is not creator
    mockDbQueryActivitiesFindFirst.mockResolvedValue({
      id: ACTIVITY_ID,
      creatorId: CREATOR.id,
    });

    const result = await deleteComment("comment-3");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("egna");
    }
  });

  it("respects daily rate limit of 20 comments", async () => {
    mockDbQueryParticipantsFindFirst.mockResolvedValue({
      activityId: ACTIVITY_ID,
      userId: PARTICIPANT.id,
      status: "attending",
    });
    // 20 comments today
    mockSelect.mockReturnValueOnce(chain([{ count: 20 }]));

    const fd = new FormData();
    fd.set("activityId", ACTIVITY_ID);
    fd.set("content", "Ytterligare en kommentar");

    const result = await createComment(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("20");
    }
  });
});

// ═══════════════════════════════════════════════════════════
// FEEDBACK
// ═══════════════════════════════════════════════════════════

describe("Feedback on activities", () => {
  let submitFeedback: typeof import("@/actions/feedback").submitFeedback;

  beforeEach(async () => {
    const mod = await import("@/actions/feedback");
    submitFeedback = mod.submitFeedback;
  });

  it("participant can submit feedback on past activity", async () => {
    mockRequireAuth.mockResolvedValue(PARTICIPANT);
    mockDbQueryParticipantsFindFirst.mockResolvedValue({
      activityId: ACTIVITY_ID,
      userId: PARTICIPANT.id,
      status: "attending",
    });
    mockDbQueryActivitiesFindFirst.mockResolvedValue({
      id: ACTIVITY_ID,
      startTime: new Date("2026-03-01T10:00:00Z"), // past
    });

    const result = await submitFeedback(ACTIVITY_ID, "positive");
    expect(result.success).toBe(true);
  });

  it("rejects feedback on future activity", async () => {
    mockRequireAuth.mockResolvedValue(PARTICIPANT);
    mockDbQueryParticipantsFindFirst.mockResolvedValue({
      activityId: ACTIVITY_ID,
      userId: PARTICIPANT.id,
      status: "attending",
    });
    mockDbQueryActivitiesFindFirst.mockResolvedValue({
      id: ACTIVITY_ID,
      startTime: new Date("2099-01-01T10:00:00Z"), // future
    });

    const result = await submitFeedback(ACTIVITY_ID, "positive");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("börjat");
    }
  });

  it("rejects feedback from non-participant", async () => {
    mockRequireAuth.mockResolvedValue(OUTSIDER);
    mockDbQueryParticipantsFindFirst.mockResolvedValue(null);

    const result = await submitFeedback(ACTIVITY_ID, "positive");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("deltagit");
    }
  });

  it("rejects feedback on non-existent activity", async () => {
    mockRequireAuth.mockResolvedValue(PARTICIPANT);
    mockDbQueryParticipantsFindFirst.mockResolvedValue({
      activityId: ACTIVITY_ID,
      userId: PARTICIPANT.id,
      status: "attending",
    });
    mockDbQueryActivitiesFindFirst.mockResolvedValue(null);

    const result = await submitFeedback(ACTIVITY_ID, "positive");
    expect(result.success).toBe(false);
  });
});
