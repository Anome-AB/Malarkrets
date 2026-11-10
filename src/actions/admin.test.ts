import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────
const mockRequireAdmin = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockFindUserFirst = vi.fn();

function chain(terminal: unknown = []) {
  const promise = Promise.resolve(terminal) as Promise<unknown> &
    Record<string, unknown>;
  const methods = [
    "select",
    "from",
    "where",
    "values",
    "returning",
    "limit",
    "offset",
    "orderBy",
  ];
  for (const m of methods) {
    promise[m] = vi.fn().mockReturnValue(promise);
  }
  promise.set = vi.fn((...args: unknown[]) => {
    mockSet(...args);
    return promise;
  });
  return promise;
}

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: { findFirst: (...args: unknown[]) => mockFindUserFirst(...args) },
    },
    select: vi.fn(() => chain([])),
    insert: vi.fn(() => chain()),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: vi.fn(() => chain()),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
  gt: vi.fn((...args: unknown[]) => ({ _op: "gt", args })),
  isNull: vi.fn((col: unknown) => ({ _op: "isNull", col })),
  or: vi.fn((...args: unknown[]) => ({ _op: "or", args })),
  ilike: vi.fn((...args: unknown[]) => ({ _op: "ilike", args })),
  count: vi.fn(() => ({ _op: "count" })),
  desc: vi.fn((col: unknown) => ({ _op: "desc", col })),
}));

vi.mock("@/db/schema", () => ({
  users: {
    id: "id",
    email: "email",
    displayName: "display_name",
    emailVerified: "email_verified",
    isAdmin: "is_admin",
    isBanned: "is_banned",
    bannedAt: "banned_at",
    banReason: "ban_reason",
    bannedBy: "banned_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  userInterests: { userId: "user_id" },
  userBlocks: { blockerId: "blocker_id" },
  notifications: { userId: "user_id" },
  analyticsEvents: { userId: "user_id" },
  interestTags: { id: "id", name: "name", slug: "slug" },
  activities: {
    id: "id",
    title: "title",
    creatorId: "creator_id",
    startTime: "start_time",
    cancelledAt: "cancelled_at",
  },
  activityParticipants: { userId: "user_id", activityId: "activity_id" },
  courageMessages: { id: "id", audience: "audience", message: "message" },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockLogInfo = vi.fn();
vi.mock("@/lib/logger", () => ({
  log: { info: (...a: unknown[]) => mockLogInfo(...a), warn: vi.fn(), error: vi.fn() },
  errAttrs: vi.fn((err: unknown) => ({ err })),
}));

// ── Import after mocks ───────────────────────────────────
import { verifyUserEmail } from "./admin";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
  mockUpdate.mockImplementation(() => chain());
});

describe("verifyUserEmail", () => {
  it("nekar den som inte är admin", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error("Åtkomst nekad"));

    const res = await verifyUserEmail("u1");

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/nekad/i);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockFindUserFirst).not.toHaveBeenCalled();
  });

  it("sätter emailVerified på ett obekräftat konto", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u1",
      email: "anna@example.com",
      emailVerified: false,
      isBanned: false,
    });

    const res = await verifyUserEmail("u1");

    expect(res.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerified: true }),
    );
  });

  it("loggar både vem det gjordes på och vem som gjorde det", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u1",
      email: "anna@example.com",
      emailVerified: false,
      isBanned: false,
    });

    await verifyUserEmail("u1");

    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ userId: "u1", adminId: "admin-1" }),
    );
  });

  it("nekar ett anonymiserat konto", async () => {
    // Anonymisering nollar emailVerified. Utan skyddet hade kontot sett ut
    // som vilket obekräftat konto som helst, och gått att återuppliva.
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u1",
      email: "4f0e1c2a-dead-beef-cafe-000000000000@anonymized.invalid",
      emailVerified: false,
      isBanned: false,
    });

    const res = await verifyUserEmail("u1");

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/anonymiserat/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("nekar ett blockerat konto och hänvisar till avblockering", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u1",
      email: "banned@example.com",
      emailVerified: false,
      isBanned: true,
    });

    const res = await verifyUserEmail("u1");

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/avblockera/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("nekar ett konto som redan är bekräftat", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u1",
      email: "anna@example.com",
      emailVerified: true,
      isBanned: false,
    });

    const res = await verifyUserEmail("u1");

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/redan/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("nekar när användaren inte finns", async () => {
    mockFindUserFirst.mockResolvedValueOnce(null);

    const res = await verifyUserEmail("ghost");

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/hittades inte/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
