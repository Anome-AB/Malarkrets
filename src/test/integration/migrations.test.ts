// Verifies migrations apply cleanly against a real Postgres and produce
// the expected schema. Would have caught:
//   - migration 0008 silently skipped due to out-of-order timestamps
//   - courage_messages table missing despite 0008 being "applied"
//   - any migration that fails to parse or conflicts with an earlier one
//
// Runs against a throwaway Postgres (CI service container OR local docker).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type postgres from "postgres";
import { getTestClient, teardownTestDb } from "./db";

describe("drizzle migrations", () => {
  let client: postgres.Sql;

  beforeAll(() => {
    ({ client } = getTestClient());
  });

  afterAll(async () => {
    if (client) await teardownTestDb(client);
  });

  it("creates the expected public-schema tables", async () => {
    const rows = await client<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const tables = rows.map((r) => r.table_name);

    // Spot-check representative tables from several migrations. If someone
    // drops or renames one without going through a migration, this fires.
    expect(tables).toEqual(
      expect.arrayContaining([
        "activities",
        "activity_comments",
        "activity_feedback",
        "activity_participants",
        "activity_tags",
        "admin_actions",
        "courage_messages", // added in 0008 — the one that silently skipped
        "images", // added in 0007
        "interest_tags",
        "notifications",
        "reports",
        "user_blocks",
        "user_interests",
        "users",
      ]),
    );
  });

  it("records all journal entries in drizzle.__drizzle_migrations", async () => {
    const journal = await import("../../db/migrations/meta/_journal.json");
    const expected = journal.default.entries.length;

    const rows = await client<{ count: string }[]>`
      SELECT COUNT(*)::text as count FROM drizzle.__drizzle_migrations
    `;
    const actual = parseInt(rows[0].count, 10);

    expect(actual).toBe(expected);
  });

  it("records migrations with strictly monotonic created_at", async () => {
    // If this fails, drizzle's migrator will silently skip any new
    // migration with a `when` less than the bogus future max. See PR #38
    // for the full archaeology.
    const rows = await client<{ created_at: string }[]>`
      SELECT created_at::text FROM drizzle.__drizzle_migrations
      ORDER BY created_at
    `;
    const timestamps = rows.map((r) => BigInt(r.created_at));

    for (let i = 1; i < timestamps.length; i++) {
      expect(
        timestamps[i] > timestamps[i - 1],
        `timestamp at index ${i} (${timestamps[i]}) is not greater than previous (${timestamps[i - 1]})`,
      ).toBe(true);
    }
  });

  it("courage_messages has expected columns", async () => {
    // Narrow check on the most recently added table to verify both the
    // migration SQL and the intended schema for PR #37 / #38 fallout.
    const rows = await client<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'courage_messages'
    `;
    const columns = Object.fromEntries(
      rows.map((r) => [r.column_name, r.data_type]),
    );

    expect(columns).toHaveProperty("id");
    expect(columns).toHaveProperty("audience");
    expect(columns).toHaveProperty("message");
  });
});
