import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

const mockInsert = vi.fn();
const mockSelect = vi.fn();

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((arg: unknown) => arg),
  and: vi.fn((...args: unknown[]) => args),
  inArray: vi.fn((...args: unknown[]) => args),
  sql: Object.assign(vi.fn((...args: unknown[]) => args), {
    join: vi.fn((...args: unknown[]) => args),
  }),
}));

const mockFindTip = vi.fn();
const mockFindUser = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    query: {
      feedbackTips: {
        findFirst: (...args: unknown[]) => mockFindTip(...args),
      },
      users: {
        findFirst: (...args: unknown[]) => mockFindUser(...args),
      },
    },
  },
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
    resolvedAt: "resolved_at",
    lastActivityAt: "last_activity_at",
    updatedAt: "updated_at",
  },
  feedbackTipComments: {
    tipId: "tip_id",
    authorId: "author_id",
    body: "body",
    createdAt: "created_at",
    id: "id",
  },
  feedbackTipViews: {
    userId: "user_id",
    tipId: "tip_id",
    lastViewedAt: "last_viewed_at",
  },
  feedbackTipInterestSuggestions: {
    id: "id",
    tipId: "tip_id",
    name: "name",
    status: "status",
    createdAt: "created_at",
  },
  interestTags: { id: "id", name: "name", slug: "slug" },
  users: {
    id: "id",
    displayName: "display_name",
    isAdmin: "is_admin",
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

import { submitTip, getMyTips, editMyTip, addTipComment } from "./feedback-tips";

function chain(terminal: unknown) {
  const promise = Promise.resolve(terminal);
  const methods = [
    "values",
    "returning",
    "from",
    "where",
    "orderBy",
    "groupBy",
    "set",
    "leftJoin",
    "innerJoin",
    "onConflictDoUpdate",
    "onConflictDoNothing",
  ];
  for (const m of methods) {
    (promise as unknown as Record<string, unknown>)[m] = vi.fn(() => promise);
  }
  return promise;
}

const VALID_UUID = "10000000-0000-4000-8000-000000000001";

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
    // Två insert-anrop: först feedback_tips, sedan view-rad för rapportören
    mockInsert
      .mockReturnValueOnce(chain([{ id: "tip-123" }]))
      .mockReturnValueOnce(chain([]));

    const result = await submitTip({
      kind: "idea",
      description: "Vore kul med en kalendervy på aktiviteter",
      pageUrl: "https://vanligavasteras.se/aktiviteter",
      userAgent: "Mozilla/5.0 Test",
      viewportWidth: 1920,
      viewportHeight: 1080,
    });

    expect(result.success).toBe(true);
    expect(result.tipId).toBe("tip-123");
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("trimmar whitespace runt description", async () => {
    let firstInsertValues: Record<string, unknown> | undefined;
    let callCount = 0;
    mockInsert.mockImplementation(() => {
      const chained = chain([{ id: "tip-x" }]);
      const myCall = callCount++;
      (chained as unknown as { values: (v: Record<string, unknown>) => unknown }).values = vi.fn(
        (v: Record<string, unknown>) => {
          // Bara första insert (feedback_tips), inte den andra (view-raden)
          if (myCall === 0) firstInsertValues = v;
          return chained;
        },
      );
      return chained;
    });

    await submitTip({
      kind: "bug",
      description: "   Knappen svarar inte när jag trycker   ",
    });

    expect(firstInsertValues?.description).toBe("Knappen svarar inte när jag trycker");
  });
});

describe("getMyTips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-1", email: "tester@example.com" });
  });

  it("returnerar bara den inloggade användarens egna tips med kommentar-count", async () => {
    const baseTime = new Date(2026, 4, 20, 10, 0, 0);
    // hasUnread räknas nu server-side via SQL, så mocken returnerar
    // boolean direkt i stället för raw timestamps.
    const tipRows = [
      {
        id: "tip-1",
        kind: "bug",
        status: "open",
        description: "x",
        createdAt: baseTime,
        resolvedAt: null,
        lastActivityAt: baseTime,
        hasUnread: false,
      },
    ];
    mockSelect
      .mockReturnValueOnce(chain(tipRows))
      .mockReturnValueOnce(chain([]));

    const result = await getMyTips();
    expect(result).toEqual([
      {
        id: "tip-1",
        kind: "bug",
        status: "open",
        description: "x",
        createdAt: baseTime,
        resolvedAt: null,
        lastActivityAt: baseTime,
        commentCount: 0,
        hasUnread: false,
      },
    ]);
    expect(mockRequireAuth).toHaveBeenCalled();
  });

  it("returnerar hasUnread=true när server-side SQL räknat ut det", async () => {
    const baseTime = new Date(2026, 4, 20, 10, 0, 0);
    const tipRows = [
      {
        id: "tip-2",
        kind: "bug",
        status: "open",
        description: "y",
        createdAt: baseTime,
        resolvedAt: null,
        lastActivityAt: baseTime,
        hasUnread: true,
      },
    ];
    mockSelect
      .mockReturnValueOnce(chain(tipRows))
      .mockReturnValueOnce(chain([]));

    const result = await getMyTips();
    expect(result[0].hasUnread).toBe(true);
  });

  it("returnerar tom lista utan att fråga om counts", async () => {
    mockSelect.mockReturnValueOnce(chain([]));
    const result = await getMyTips();
    expect(result).toEqual([]);
    // Andra anropet (counts) ska aldrig göras
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });
});

describe("submitTip (interest)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-1", email: "tester@example.com" });
  });

  it("avvisar interest-tip utan föreslagna namn", async () => {
    const result = await submitTip({
      kind: "interest",
      description: "",
      interestNames: [],
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/minst ett intresse/i);
  });

  it("avvisar interest-tip med bara whitespace-namn", async () => {
    const result = await submitTip({
      kind: "interest",
      description: "",
      interestNames: ["x"], // < min 2 tecken
    });
    expect(result.success).toBe(false);
  });

  it("godkänner interest-tip med minst ett namn även om description är tom", async () => {
    // submitTip gör tre inserts vid kind=interest:
    // 1) feedback_tips, 2) feedback_tip_interest_suggestions, 3) feedback_tip_views
    mockInsert
      .mockReturnValueOnce(chain([{ id: "tip-int-1" }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]));

    const result = await submitTip({
      kind: "interest",
      description: "",
      interestNames: ["Schack på torget", "Akvarellmålning"],
    });

    expect(result.success).toBe(true);
    expect(result.tipId).toBe("tip-int-1");
    expect(mockInsert).toHaveBeenCalledTimes(3);
  });
});

describe("editMyTip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-1", email: "tester@example.com" });
  });

  it("avvisar redigering om tipset inte tillhör användaren", async () => {
    mockFindTip.mockResolvedValue({
      id: "tip-1",
      reporterId: "user-other",
      status: "open",
    });
    const result = await editMyTip({
      tipId: VALID_UUID,
      kind: "bug",
      description: "En tillräckligt lång beskrivning för validering",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/dina egna/);
  });

  it("avvisar redigering om status inte längre är open", async () => {
    mockFindTip.mockResolvedValue({
      id: "tip-1",
      reporterId: "user-1",
      status: "triaged",
    });
    const result = await editMyTip({
      tipId: VALID_UUID,
      kind: "bug",
      description: "En tillräckligt lång beskrivning för validering",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/hanteras/);
  });

  it("uppdaterar tipset när allt stämmer", async () => {
    mockFindTip.mockResolvedValue({
      id: "tip-1",
      reporterId: "user-1",
      status: "open",
    });
    mockUpdate.mockReturnValue(chain([]));
    const result = await editMyTip({
      tipId: VALID_UUID,
      kind: "idea",
      description: "En tillräckligt lång beskrivning för validering",
    });
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("addTipComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-1", email: "tester@example.com" });
  });

  it("släpper in rapportören att svara på sitt eget tips", async () => {
    mockFindTip.mockResolvedValue({ id: "tip-1", reporterId: "user-1" });
    mockFindUser.mockResolvedValue({ id: "user-1", isAdmin: false });
    mockInsert.mockReturnValue(chain([]));
    mockUpdate.mockReturnValue(chain([]));
    const result = await addTipComment({
      tipId: VALID_UUID,
      body: "Här är mer info",
    });
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("släpper in en admin även om hen inte är rapportören", async () => {
    mockFindTip.mockResolvedValue({ id: "tip-1", reporterId: "user-other" });
    mockFindUser.mockResolvedValue({ id: "user-1", isAdmin: true });
    mockInsert.mockReturnValue(chain([]));
    mockUpdate.mockReturnValue(chain([]));
    const result = await addTipComment({
      tipId: VALID_UUID,
      body: "Vi tittar på det",
    });
    expect(result.success).toBe(true);
  });

  it("nekar tredje part som varken är rapportören eller admin", async () => {
    mockFindTip.mockResolvedValue({ id: "tip-1", reporterId: "user-other" });
    mockFindUser.mockResolvedValue({ id: "user-1", isAdmin: false });
    const result = await addTipComment({
      tipId: VALID_UUID,
      body: "Försöker tjuvlyssna",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/tillgång/);
  });

  it("avvisar tom kommentar", async () => {
    const result = await addTipComment({
      tipId: VALID_UUID,
      body: "",
    });
    expect(result.success).toBe(false);
  });
});
