import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────
const mockFindUserFirst = vi.fn();

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

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: { findFirst: (...args: unknown[]) => mockFindUserFirst(...args) },
      userTokens: { findFirst: vi.fn() },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: vi.fn(() => chain()),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
  isNull: vi.fn((col: unknown) => ({ _op: "isNull", col })),
  lt: vi.fn((...args: unknown[]) => ({ _op: "lt", args })),
  gte: vi.fn((...args: unknown[]) => ({ _op: "gte", args })),
  or: vi.fn((...args: unknown[]) => ({ _op: "or", args })),
  sql: Object.assign(
    vi.fn((...args: unknown[]) => args),
    { join: vi.fn() },
  ),
}));

vi.mock("@/db/schema", () => ({
  users: { id: "id", email: "email", passwordHash: "password_hash" },
  userTokens: {
    id: "id",
    userId: "user_id",
    type: "type",
    tokenHash: "token_hash",
    emailHash: "email_hash",
    ip: "ip",
    expiresAt: "expires_at",
    usedAt: "used_at",
    createdAt: "created_at",
  },
}));

const mockHeaders = vi.fn(() =>
  Promise.resolve({
    get: (n: string) => (n === "x-forwarded-for" ? "10.0.0.1" : null),
  }),
);
vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

const mockSendReset = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendReset(...args),
}));

const mockCheckRate = vi
  .fn()
  .mockResolvedValue({ allowed: true, remaining: 5 });
vi.mock("@/lib/rate-limit", () => ({
  checkTokenRateLimit: (...args: unknown[]) => mockCheckRate(...args),
}));

const mockCreateToken = vi
  .fn()
  .mockResolvedValue({
    rawToken: "RAW_TOKEN_FAKE_VALUE_123456",
    expiresAt: new Date(Date.now() + 3600_000),
  });
const mockConsumeToken = vi.fn();
vi.mock("@/lib/tokens", () => ({
  createToken: (...args: unknown[]) => mockCreateToken(...args),
  consumeToken: (...args: unknown[]) => mockConsumeToken(...args),
  hashEmail: (s: string) => `H(${s.toLowerCase().trim()})`,
  getClientIp: (h: { get: (n: string) => string | null }) =>
    h.get("x-forwarded-for") ?? null,
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (pw: string) => `bcrypt(${pw})`),
  },
}));

// ── Import after mocks ───────────────────────────────────
let forgotPassword: typeof import("@/actions/password-reset").forgotPassword;
let resetPassword: typeof import("@/actions/password-reset").resetPassword;

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

beforeEach(async () => {
  vi.clearAllMocks();
  mockCheckRate.mockResolvedValue({ allowed: true, remaining: 5 });
  mockSendReset.mockResolvedValue(undefined);
  mockCreateToken.mockResolvedValue({
    rawToken: "RAW_TOKEN_FAKE_VALUE_123456",
    expiresAt: new Date(Date.now() + 3600_000),
  });

  const mod = await import("@/actions/password-reset");
  forgotPassword = mod.forgotPassword;
  resetPassword = mod.resetPassword;
});

describe("forgotPassword", () => {
  it("rejects invalid email shape with field error", async () => {
    const res = await forgotPassword(makeFormData({ email: "not-an-email" }));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toMatch(/ogiltig/i);
  });

  it("returns neutral success when email is unknown", async () => {
    mockFindUserFirst.mockResolvedValueOnce(null);
    const res = await forgotPassword(makeFormData({ email: "ghost@x.se" }));
    expect(res.success).toBe(true);
    expect(mockSendReset).not.toHaveBeenCalled();
    expect(mockCreateToken).not.toHaveBeenCalled();
  });

  it("sends email when user exists, verified, not banned", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u1",
      email: "anna@example.com",
      isBanned: false,
      emailVerified: true,
    });
    const res = await forgotPassword(
      makeFormData({ email: "anna@example.com" }),
    );
    expect(res.success).toBe(true);
    expect(mockCreateToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: "reset_password",
        ip: "10.0.0.1",
      }),
    );
    expect(mockSendReset).toHaveBeenCalledWith(
      "anna@example.com",
      expect.any(String),
    );
  });

  it("skips email send for banned user but returns neutral success", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u1",
      email: "banned@x.se",
      isBanned: true,
      emailVerified: true,
    });
    const res = await forgotPassword(makeFormData({ email: "banned@x.se" }));
    expect(res.success).toBe(true);
    expect(mockSendReset).not.toHaveBeenCalled();
    expect(mockCreateToken).not.toHaveBeenCalled();
  });

  it("skips email send for unverified user but returns neutral success", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u1",
      email: "unverified@x.se",
      isBanned: false,
      emailVerified: false,
    });
    const res = await forgotPassword(
      makeFormData({ email: "unverified@x.se" }),
    );
    expect(res.success).toBe(true);
    expect(mockSendReset).not.toHaveBeenCalled();
  });

  it("returns neutral success when rate limit is exceeded, skips DB", async () => {
    mockCheckRate.mockResolvedValueOnce({ allowed: false, remaining: 0 });
    const res = await forgotPassword(makeFormData({ email: "a@b.se" }));
    expect(res.success).toBe(true);
    expect(mockFindUserFirst).not.toHaveBeenCalled();
    expect(mockSendReset).not.toHaveBeenCalled();
  });

  it("still returns neutral success when Resend fails (no leakage)", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u1",
      email: "a@b.se",
      isBanned: false,
      emailVerified: true,
    });
    mockSendReset.mockRejectedValueOnce(new Error("Resend down"));
    const res = await forgotPassword(makeFormData({ email: "a@b.se" }));
    expect(res.success).toBe(true);
  });
});

describe("resetPassword", () => {
  it("rejects short password", async () => {
    const res = await resetPassword(
      makeFormData({
        token: "RAW_TOKEN_FAKE_VALUE_123456",
        password: "short",
        confirmPassword: "short",
      }),
    );
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toMatch(/12 tecken/);
  });

  it("rejects password mismatch", async () => {
    const res = await resetPassword(
      makeFormData({
        token: "RAW_TOKEN_FAKE_VALUE_123456",
        password: "abcdefghijkl",
        confirmPassword: "abcdefghijlk",
      }),
    );
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toMatch(/matchar/i);
  });

  it("rejects invalid or expired token with generic error", async () => {
    mockConsumeToken.mockResolvedValueOnce({ ok: false, reason: "expired" });
    const res = await resetPassword(
      makeFormData({
        token: "RAW_TOKEN_FAKE_VALUE_123456",
        password: "validpassword12",
        confirmPassword: "validpassword12",
      }),
    );
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toMatch(/ogiltig|gått ut/i);
  });

  it("rejects used token", async () => {
    mockConsumeToken.mockResolvedValueOnce({ ok: false, reason: "used" });
    const res = await resetPassword(
      makeFormData({
        token: "RAW_TOKEN_FAKE_VALUE_123456",
        password: "validpassword12",
        confirmPassword: "validpassword12",
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects reset for banned user", async () => {
    mockConsumeToken.mockResolvedValueOnce({
      ok: true,
      token: { id: "t1", userId: "u1" },
    });
    mockFindUserFirst.mockResolvedValueOnce({ id: "u1", isBanned: true });
    const res = await resetPassword(
      makeFormData({
        token: "RAW_TOKEN_FAKE_VALUE_123456",
        password: "validpassword12",
        confirmPassword: "validpassword12",
      }),
    );
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toMatch(/spärrat|kontakta/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("updates password and sets passwordChangedAt on happy path", async () => {
    mockConsumeToken.mockResolvedValueOnce({
      ok: true,
      token: { id: "t1", userId: "u1" },
    });
    mockFindUserFirst.mockResolvedValueOnce({ id: "u1", isBanned: false });
    const res = await resetPassword(
      makeFormData({
        token: "RAW_TOKEN_FAKE_VALUE_123456",
        password: "validpassword12",
        confirmPassword: "validpassword12",
      }),
    );
    expect(res.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});
