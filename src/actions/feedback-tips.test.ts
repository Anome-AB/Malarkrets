import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

const mockInsert = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((arg: unknown) => arg),
}));

vi.mock("@/db/schema", () => ({
  feedbackTips: {
    id: "id",
    reporterId: "reporter_id",
    kind: "kind",
    severity: "severity",
    status: "status",
    description: "description",
    createdAt: "created_at",
    adminNotes: "admin_notes",
    resolvedAt: "resolved_at",
  },
  images: { id: "id" },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  errAttrs: vi.fn((err: unknown) => ({ err })),
}));

import { submitTip, getMyTips } from "./feedback-tips";

function chain(terminal: unknown) {
  const promise = Promise.resolve(terminal);
  const methods = [
    "values",
    "returning",
    "from",
    "where",
    "orderBy",
  ];
  for (const m of methods) {
    (promise as unknown as Record<string, unknown>)[m] = vi.fn(() => promise);
  }
  return promise;
}

describe("submitTip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-1", email: "tester@example.com" });
  });

  it("kräver minst 10 tecken description", async () => {
    const result = await submitTip({ kind: "bug", description: "för kort" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/minst 10/i);
  });

  it("avvisar ogiltig kind", async () => {
    const result = await submitTip({
      kind: "invalid" as unknown as "bug",
      description: "Det här är en tillräckligt lång beskrivning",
    });
    expect(result.success).toBe(false);
  });

  it("avvisar console-log över 64 KB", async () => {
    const consoleLog = "x".repeat(65 * 1024);
    const result = await submitTip({
      kind: "bug",
      description: "En lång nog beskrivning för att passera valideringen",
      consoleLog,
    });
    expect(result.success).toBe(false);
  });

  it("sparar giltigt tips och returnerar id", async () => {
    mockInsert.mockReturnValue(chain([{ id: "tip-123" }]));

    const result = await submitTip({
      kind: "idea",
      description: "Vore kul med en kalendervy på aktiviteter",
      pageUrl: "https://malarkrets.se/aktiviteter",
      userAgent: "Mozilla/5.0 Test",
      viewportWidth: 1920,
      viewportHeight: 1080,
    });

    expect(result.success).toBe(true);
    expect(result.tipId).toBe("tip-123");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("trimmar whitespace runt description", async () => {
    let insertedValues: Record<string, unknown> | undefined;
    mockInsert.mockImplementation(() => {
      const chained = chain([{ id: "tip-x" }]);
      (chained as unknown as { values: (v: Record<string, unknown>) => unknown }).values = vi.fn(
        (v: Record<string, unknown>) => {
          insertedValues = v;
          return chained;
        },
      );
      return chained;
    });

    await submitTip({
      kind: "bug",
      description: "   Knappen svarar inte när jag trycker   ",
    });

    expect(insertedValues?.description).toBe("Knappen svarar inte när jag trycker");
  });
});

describe("getMyTips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-1", email: "tester@example.com" });
  });

  it("returnerar bara den inloggade användarens egna tips", async () => {
    const myTips = [
      { id: "tip-1", kind: "bug", status: "open", description: "x", createdAt: new Date(), adminNotes: null, resolvedAt: null },
    ];
    mockSelect.mockReturnValue(chain(myTips));

    const result = await getMyTips();
    expect(result).toEqual(myTips);
    expect(mockRequireAuth).toHaveBeenCalled();
  });
});
