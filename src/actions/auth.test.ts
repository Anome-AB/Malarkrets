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
  hashEmail: (s: string) => `H(${s.toLowerCase().trim()})`,
}));

const mockCheckRate = vi.fn().mockResolvedValue({ allowed: true, remaining: 3 });
vi.mock("@/lib/rate-limit", () => ({
  checkTokenRateLimit: (...args: unknown[]) => mockCheckRate(...args),
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
let resendVerificationEmail: typeof import("@/actions/auth").resendVerificationEmail;

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
  mockSendVerification.mockResolvedValue(undefined);
  mockCheckRate.mockResolvedValue({ allowed: true, remaining: 3 });

  const mod = await import("@/actions/auth");
  register = mod.register;
  verifyEmail = mod.verifyEmail;
  checkBanStatus = mod.checkBanStatus;
  resendVerificationEmail = mod.resendVerificationEmail;
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
    expect(res.emailSent).toBe(true);
  });

  // Regression: utskicket sväljs med flit så kontot inte rivs, men tidigare
  // returnerades success utan att säga att mailet aldrig gick iväg. Då fick
  // användaren "Kolla din e-post" för ett mail som inte fanns.
  it("reports emailSent:false when the verification mail throws", async () => {
    mockFindUserFirst.mockResolvedValueOnce(null);
    mockSendVerification.mockRejectedValueOnce(new Error("Resend failed"));

    const res = await register(
      makeFormData({
        email: "new@user.se",
        password: "validpassword12",
        confirmPassword: "validpassword12",
      }),
    );

    expect(res.success).toBe(true);
    expect(res.emailSent).toBe(false);
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe("resendVerificationEmail", () => {
  const NEUTRAL = /Om adressen finns hos oss/;

  it("rejects a malformed email without touching the database", async () => {
    const res = await resendVerificationEmail(
      makeFormData({ email: "inte-en-adress" }),
    );

    expect(res.success).toBe(false);
    expect(mockCheckRate).not.toHaveBeenCalled();
    expect(mockCreateToken).not.toHaveBeenCalled();
  });

  it("issues a new verify_email token for an unverified user", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u1",
      email: "stuck@user.se",
      isBanned: false,
      emailVerified: false,
    });

    const res = await resendVerificationEmail(
      makeFormData({ email: "stuck@user.se" }),
    );

    expect(res.success).toBe(true);
    expect(mockCreateToken).toHaveBeenCalledWith(
      expect.objectContaining({ type: "verify_email", userId: "u1" }),
    );
    expect(mockSendVerification).toHaveBeenCalledWith(
      "stuck@user.se",
      "FAKE_VERIFY_TOKEN",
    );
  });

  it("sends nothing for an already verified user but answers the same", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u2",
      email: "done@user.se",
      isBanned: false,
      emailVerified: true,
    });

    const res = await resendVerificationEmail(
      makeFormData({ email: "done@user.se" }),
    );

    expect(res.success).toBe(true);
    if (res.success) expect(res.message).toMatch(NEUTRAL);
    expect(mockCreateToken).not.toHaveBeenCalled();
    expect(mockSendVerification).not.toHaveBeenCalled();
  });

  it("sends nothing for a banned user", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u3",
      email: "banned@user.se",
      isBanned: true,
      emailVerified: false,
    });

    const res = await resendVerificationEmail(
      makeFormData({ email: "banned@user.se" }),
    );

    expect(res.success).toBe(true);
    expect(mockCreateToken).not.toHaveBeenCalled();
    expect(mockSendVerification).not.toHaveBeenCalled();
  });

  // Samma svar för okänd adress som för känd, annars går formuläret att
  // använda för att ta reda på vilka adresser som har konto.
  it("answers identically for an unknown address", async () => {
    mockFindUserFirst.mockResolvedValueOnce(null);

    const res = await resendVerificationEmail(
      makeFormData({ email: "nobody@user.se" }),
    );

    expect(res.success).toBe(true);
    if (res.success) expect(res.message).toMatch(NEUTRAL);
    expect(mockSendVerification).not.toHaveBeenCalled();
  });

  it("stops at the rate limit without issuing a token", async () => {
    mockCheckRate.mockResolvedValueOnce({ allowed: false, remaining: 0 });

    const res = await resendVerificationEmail(
      makeFormData({ email: "spammer@user.se" }),
    );

    expect(res.success).toBe(true);
    if (res.success) expect(res.message).toMatch(NEUTRAL);
    expect(mockFindUserFirst).not.toHaveBeenCalled();
    expect(mockCreateToken).not.toHaveBeenCalled();
  });

  it("still answers neutrally when the mail send throws", async () => {
    mockFindUserFirst.mockResolvedValueOnce({
      id: "u4",
      email: "stuck@user.se",
      isBanned: false,
      emailVerified: false,
    });
    mockSendVerification.mockRejectedValueOnce(new Error("Resend failed"));

    const res = await resendVerificationEmail(
      makeFormData({ email: "stuck@user.se" }),
    );

    expect(res.success).toBe(true);
    if (res.success) expect(res.message).toMatch(NEUTRAL);
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
