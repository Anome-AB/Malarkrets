#!/usr/bin/env node
// Runs Drizzle migrations against DATABASE_URL, then exits.
// Used by the `migrate` service in docker-compose.prod.yml — app waits on this
// container exiting 0 before it starts. Keep dependencies minimal so the
// migrate image stays small (drizzle-orm + postgres only).

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
try {
  await migrate(drizzle(client), { migrationsFolder: "./src/db/migrations" });
  console.log("migrate: done");
} catch (err) {
  console.error("migrate: failed", err);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
