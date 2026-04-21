// Runs migrations ONCE per vitest run (not per test file). Each test
// file then just opens a connection to the already-migrated DB and
// TRUNCATE's between tests.
//
// Vitest calls `setup()` before any test runs and `teardown()` after all
// tests finish — both optional exports.

import { setupTestDb, teardownTestDb } from "./db";

export async function setup() {
  const { client } = await setupTestDb();
  await teardownTestDb(client);
}
