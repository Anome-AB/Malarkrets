// Helper for integration tests — creates a Drizzle client connected to a
// test Postgres (local docker compose or CI service container) and runs
// migrations from scratch.
//
// Safety: refuses to run against a DATABASE_URL that doesn't look like a
// test database (connection string must contain "test"). Integration tests
// DROP SCHEMA to start clean — pointing this at prod would wipe data.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/db/schema";

const DEFAULT_URL = "postgresql://test:test@localhost:5432/test";
const DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_URL;

// Guard against accidentally pointing at a real database.
if (!DATABASE_URL.includes("test")) {
  throw new Error(
    `Integration tests require DATABASE_URL to contain "test" in the connection string. Got: ${DATABASE_URL.replace(/:[^:@]+@/, ":***@")}. Refusing to run to avoid destroying real data.`,
  );
}

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export async function setupTestDb(): Promise<{
  db: TestDb;
  client: postgres.Sql;
}> {
  const client = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });

  // Start from a known-empty state so migrations apply cleanly each run.
  // Postgres auto-recreates `public` in some versions, so use IF NOT EXISTS.
  await client`DROP SCHEMA IF EXISTS public CASCADE`;
  await client`CREATE SCHEMA IF NOT EXISTS public`;
  await client`DROP SCHEMA IF EXISTS drizzle CASCADE`;

  await migrate(db, { migrationsFolder: "src/db/migrations" });

  return { db, client };
}

export async function teardownTestDb(client: postgres.Sql): Promise<void> {
  await client.end({ timeout: 5 });
}

/**
 * Connect to an already-migrated test DB. Use in test files that just
 * need to run queries — migrations are set up once by global-setup.ts.
 */
export function getTestClient(): {
  db: TestDb;
  client: postgres.Sql;
} {
  const client = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function truncateAll(client: postgres.Sql): Promise<void> {
  // TRUNCATE everything under public schema, keep drizzle schema intact so
  // migrations don't need to re-run between tests.
  await client`
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `;
}
