#!/usr/bin/env node
// cleanup-expired-tokens.mjs
//
// Removes user_tokens rows that are safely unreachable:
//   - expired AND at least 7 days past expiry, OR
//   - used AND at least 7 days past expiry.
//
// Opportunistic cleanup inside createToken() already runs on ~5% of inserts
// so this script is not the primary mechanism. It exists for manual
// one-off runs or future cron-container setup when traffic grows.
//
// Usage (reads DATABASE_URL from env):
//   node scripts/cleanup-expired-tokens.mjs
//   bun run scripts/cleanup-expired-tokens.mjs

import postgres from "postgres";

const RETENTION_DAYS = 7;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });

try {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const result = await client`
    DELETE FROM user_tokens
    WHERE expires_at < ${cutoff}
    RETURNING id
  `;

  console.log(
    `Deleted ${result.length} token rows with expires_at < ${cutoff.toISOString()}`,
  );
} catch (err) {
  console.error("Cleanup failed:", err);
  process.exitCode = 1;
} finally {
  await client.end();
}
