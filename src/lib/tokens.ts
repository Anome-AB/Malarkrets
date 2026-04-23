import { randomBytes, createHash } from "node:crypto";
import { and, eq, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { userTokens, type UserToken } from "@/db/schema";

type TokenType = "verify_email" | "reset_password";

const DEFAULT_TTL_MINUTES: Record<TokenType, number> = {
  verify_email: 60 * 24,
  reset_password: 60,
};

const CLEANUP_RETENTION_DAYS = 7;
const CLEANUP_PROBABILITY = 0.05;

export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

type CreateTokenInput = {
  userId: string | null;
  email: string;
  ip: string | null;
  type: TokenType;
  ttlMinutes?: number;
};

export type CreateTokenResult = {
  rawToken: string;
  expiresAt: Date;
};

/**
 * Create a new token: generate raw value, store its sha256 hash.
 * Runs opportunistic cleanup of expired rows (~5% of calls) to amortize
 * storage growth without a separate scheduler.
 *
 * Returns the RAW token for the caller to email/use. The hash is what
 * lives in the DB, consumeToken() rehashes on lookup.
 */
export async function createToken(
  input: CreateTokenInput,
): Promise<CreateTokenResult> {
  await maybeCleanupExpired();

  const ttl = input.ttlMinutes ?? DEFAULT_TTL_MINUTES[input.type];
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const emailHash = hashEmail(input.email);
  const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

  if (input.userId) {
    await db
      .update(userTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(userTokens.userId, input.userId),
          eq(userTokens.type, input.type),
          isNull(userTokens.usedAt),
        ),
      );
  }

  await db.insert(userTokens).values({
    userId: input.userId,
    type: input.type,
    tokenHash,
    emailHash,
    ip: input.ip,
    expiresAt,
  });

  return { rawToken, expiresAt };
}

export type ConsumeTokenResult =
  | { ok: true; token: UserToken }
  | { ok: false; reason: "not_found" | "expired" | "used" };

/**
 * Consume a token: look up by sha256(raw), verify not expired/used,
 * mark used_at. Caller is responsible for verifying the type matches.
 */
export async function consumeToken(
  rawToken: string,
  type: TokenType,
): Promise<ConsumeTokenResult> {
  const tokenHash = hashToken(rawToken);

  const row = await db.query.userTokens.findFirst({
    where: and(eq(userTokens.tokenHash, tokenHash), eq(userTokens.type, type)),
  });

  if (!row) return { ok: false, reason: "not_found" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  await db
    .update(userTokens)
    .set({ usedAt: new Date() })
    .where(eq(userTokens.id, row.id));

  return { ok: true, token: row };
}

async function maybeCleanupExpired(): Promise<void> {
  if (Math.random() > CLEANUP_PROBABILITY) return;
  try {
    const cutoff = new Date(
      Date.now() - CLEANUP_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    await db
      .delete(userTokens)
      .where(lt(userTokens.expiresAt, cutoff));
  } catch {
    // Cleanup is best-effort; never let it break the main flow.
  }
}

/**
 * Extracts client IP from Next.js headers, trusting x-forwarded-for
 * because we run behind Caddy which sets it. First value in the list
 * is the original client.
 */
export function getClientIp(
  headers: { get: (name: string) => string | null },
): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip");
}

// Explicit export so sql tagged-template stays tree-shakable where unused.
export { sql };
