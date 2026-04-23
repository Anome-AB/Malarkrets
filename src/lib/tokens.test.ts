import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────
const mockFindFirst = vi.fn();

function chain(terminal: unknown = []) {
  const promise = Promise.resolve(terminal);
  const methods = [
    "select",
    "from",
    "where",
    "set",
    "values",
    "returning",
  ];
  for (const m of methods) {
    (promise as unknown as Record<string, unknown>)[m] = vi
      .fn()
      .mockReturnValue(promise);
  }
  return promise;
}

const mockInsert = vi.fn((..._args: unknown[]) => chain());
const mockUpdate = vi.fn((..._args: unknown[]) => chain());
const mockDelete = vi.fn((..._args: unknown[]) => chain());

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      userTokens: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
  isNull: vi.fn((col: unknown) => ({ _op: "isNull", col })),
  lt: vi.fn((...args: unknown[]) => ({ _op: "lt", args })),
  sql: vi.fn((...args: unknown[]) => args),
}));

vi.mock("@/db/schema", () => ({
  userTokens: {
    id: "id",
    userId: "user_id",
    type: "type",
    tokenHash: "token_hash",
    emailHash: "email_hash",
    expiresAt: "expires_at",
    usedAt: "used_at",
    createdAt: "created_at",
  },
}));

// ── Import after mocks ──────────────────────────────────
let tokens: typeof import("@/lib/tokens");

beforeEach(async () => {
  vi.clearAllMocks();
  mockInsert.mockReturnValue(chain());
  mockUpdate.mockReturnValue(chain());
  mockDelete.mockReturnValue(chain());
  tokens = await import("@/lib/tokens");
});

describe("generateRawToken", () => {
  it("returns a url-safe string of at least 40 chars (base64url of 32 bytes)", () => {
    const t = tokens.generateRawToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(40);
  });

  it("is unique across calls", () => {
    const a = tokens.generateRawToken();
    const b = tokens.generateRawToken();
    expect(a).not.toBe(b);
  });
});

describe("hashToken", () => {
  it("is deterministic for the same input", () => {
    expect(tokens.hashToken("abc")).toBe(tokens.hashToken("abc"));
  });

  it("produces different hash for different input", () => {
    expect(tokens.hashToken("abc")).not.toBe(tokens.hashToken("abd"));
  });

  it("returns hex string of length 64 (sha256)", () => {
    const h = tokens.hashToken("whatever");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("hashEmail", () => {
  it("normalizes case and whitespace", () => {
    expect(tokens.hashEmail("Foo@Bar.SE")).toBe(
      tokens.hashEmail("  foo@bar.se  "),
    );
  });
});

describe("createToken", () => {
  it("inserts a row with hashed token + email", async () => {
    vi.spyOn(Math, "random").mockReturnValue(1); // skip opportunistic cleanup
    const result = await tokens.createToken({
      userId: "user-1",
      email: "a@b.se",
      ip: "1.2.3.4",
      type: "reset_password",
    });

    expect(result.rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(mockInsert).toHaveBeenCalled();
  });

  it("marks older unused tokens of same type as used", async () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    await tokens.createToken({
      userId: "user-1",
      email: "a@b.se",
      ip: null,
      type: "reset_password",
    });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("skips the invalidate-older step when userId is null", async () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    await tokens.createToken({
      userId: null,
      email: "a@b.se",
      ip: null,
      type: "reset_password",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe("consumeToken", () => {
  it("returns not_found when no row matches", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const res = await tokens.consumeToken("raw-abc", "reset_password");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_found");
  });

  it("returns used when row has used_at set", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "t1",
      userId: "u1",
      tokenHash: "h",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const res = await tokens.consumeToken("raw-abc", "reset_password");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("used");
  });

  it("returns expired when row is past expiry", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "t1",
      userId: "u1",
      tokenHash: "h",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await tokens.consumeToken("raw-abc", "reset_password");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("expired");
  });

  it("marks token used and returns ok on happy path", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "t1",
      userId: "u1",
      tokenHash: "h",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const res = await tokens.consumeToken("raw-abc", "reset_password");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.token.userId).toBe("u1");
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("getClientIp", () => {
  it("extracts first x-forwarded-for value", () => {
    const hdrs = {
      get: (n: string) =>
        n === "x-forwarded-for" ? "1.1.1.1, 2.2.2.2" : null,
    };
    expect(tokens.getClientIp(hdrs)).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip", () => {
    const hdrs = {
      get: (n: string) => (n === "x-real-ip" ? "3.3.3.3" : null),
    };
    expect(tokens.getClientIp(hdrs)).toBe("3.3.3.3");
  });

  it("returns null when neither header is set", () => {
    const hdrs = { get: () => null };
    expect(tokens.getClientIp(hdrs)).toBeNull();
  });
});
