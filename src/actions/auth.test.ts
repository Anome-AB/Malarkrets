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

const mockInsert = vi.fn((..._args: unknown[]) =>
  chain([{ id: "new-user-id" }]),
);
const mockUpdate = vi.fn((..._args: unknown[]) => chain());

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: { findFirst: (...args: unknown[]) => mockFindUserFirst(...args) },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ _op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ _op: "and", args })),
}));

vi.mock("@/db/schema", () => ({
  users: { id: "id", email: "email" },
}));

const mockHeaders = vi.fn(() =>
  Promise.resolve({ get: () => null }),
);
vi.mock("next/headers", () => ({ headers: () => mockHeaders() }));

const mockSendVerification = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: (...args: unknown[]) => mockSendVerification(...args),
}));

const mockCreateToken = vi
  .fn()
  .mockResolvedValue({
    rawToken: "FAKE_VERIFY_TOKEN",
    expiresAt: new Date(Date.now() + 86400_000),
  });
const mockConsumeToken = vi.fn();
vi.mock("@/lib/tokens", () => ({
  createToken: (...args: unknown[]) => mockCreateToken(...args),
  consumeToken: (...args: unknown[]) => mockConsumeToken(...args),
  getClientIp: () => null,
}));

vi.mock("@/lib/auth", () => ({
  signOut: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(async (pw: string) => `bcrypt(${pw})`) },
}));

// ── Import after mocks ───────────────────────────────────
let register: typeof import("@/actions/auth").register;
let verifyEmail: typeof import("@/actions/auth").verifyEmail;
let checkBanStatus: typeof import("@/actions/auth").checkBanStatus;

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

beforeEach(async () => {
  vi.clearAllMocks();
  mockCreateToken.mockResolvedValue({
    rawToken: "FAKE_VERIFY_TOKEN",
    expiresAt: new Date(Date.now() + 86400_000),
  });

  const mod = await import("@/actions/auth");
  register = mod.register;
  verifyEmail = mod.verifyEmail;
  checkBanStatus = mod.checkBanStatus;
});

describe("register (creates verify-email token via user_tokens)", () => {
  it("rejects when user with email already exists", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "existing",
      email: "a@b.se",
    });
    const res = await register(
      makeFormData({
        email: "a@b.se",
        password: "validpassword12",
        confirmPassword: "validpassword12",
      }),
    );
    expect(res.error).toBeDefined();
    expect(mockCreateToken).not.toHaveBeenCalled();
  });

  it("creates user, issues verify-email token, sends verification email", async () => {
    mockFindUserFirst.mockResolvedValueOnce(null);
    const res = await register(
      makeFormData({
        email: "new@user.se",
        password: "validpassword12",
        confirmPassword: "validpassword12",
      }),
    );
    expect(res.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockCreateToken).toHaveBeenCalledWith(
      expect.objectContaining({ type: "verify_email" }),
    );
    expect(mockSendVerification).toHaveBeenCalledWith(
      "new@user.se",
      "FAKE_VERIFY_TOKEN",
    );
  });
});

describe("verifyEmail (regression: now goes via consumeToken)", () => {
  it("returns error when token cannot be consumed", async () => {
    mockConsumeToken.mockResolvedValueOnce({ ok: false, reason: "not_found" });
    const res = await verifyEmail("bogus");
    expect(res.error).toBeDefined();
  });

  it("marks email as verified on successful consume", async () => {
    mockConsumeToken.mockResolvedValueOnce({
      ok: true,
      token: { id: "t1", userId: "u1" },
    });
    const res = await verifyEmail("good-token");
    expect(res.success).toBe(true);
    expect(mockConsumeToken).toHaveBeenCalledWith("good-token", "verify_email");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns error when consumed token has no userId (defensive)", async () => {
    mockConsumeToken.mockResolvedValueOnce({
      ok: true,
      token: { id: "t1", userId: null },
    });
    const res = await verifyEmail("orphan-token");
    expect(res.error).toBeDefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("checkBanStatus", () => {
  it("returns banned:false for unknown email", async () => {
    mockFindUserFirst.mockResolvedValueOnce(null);
    const res = await checkBanStatus("none@x.se");
    expect(res.banned).toBe(false);
  });

  it("returns banned:true with reason for banned user", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      isBanned: true,
      banReason: "Bröt mot reglerna",
    });
    const res = await checkBanStatus("bad@x.se");
    expect(res.banned).toBe(true);
    if (res.banned) expect(res.reason).toBe("Bröt mot reglerna");
  });
});
