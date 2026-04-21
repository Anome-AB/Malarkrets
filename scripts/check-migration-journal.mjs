#!/usr/bin/env node
// check-migration-journal.mjs
//
// Verifies the latest drizzle migration has the highest `when` timestamp in
// _journal.json. Drizzle-orm's migrator applies a migration only if its
// `when` (folderMillis) is strictly greater than MAX(created_at) already
// present in drizzle.__drizzle_migrations.
//
// A newly-generated migration with a `when` lower than some prior entry's
// `when` is silently skipped on any database where that prior entry has
// been applied. No error, no warning. The regression only surfaces when
// application code later queries a table that was never created.
//
// This script enforces: the last entry in the journal must have the max
// `when` in the journal. Historical non-monotonic entries are tolerated
// (they reflect past junk we can't clean up without DB surgery), but any
// new migration must climb above the existing high-water mark.
//
// Run in CI on every PR. Run locally before committing a new migration:
//   node scripts/check-migration-journal.mjs

import { readFileSync, existsSync } from "node:fs";

const JOURNAL = "src/db/migrations/meta/_journal.json";

if (!existsSync(JOURNAL)) {
  console.error(`ERROR: ${JOURNAL} not found (run from repo root)`);
  process.exit(1);
}

const journal = JSON.parse(readFileSync(JOURNAL, "utf8"));
const entries = journal.entries ?? [];

if (entries.length === 0) {
  console.log("OK: journal has no entries yet");
  process.exit(0);
}

const last = entries[entries.length - 1];
const max = entries.reduce((m, e) => (e.when > m.when ? e : m), entries[0]);

if (last.when === max.when) {
  console.log(`OK: latest migration (${last.tag}) has the highest 'when' (${last.when})`);
  process.exit(0);
}

const bumpTo = max.when + 1000;
const msg = `
ERROR: migration journal failure — newest migration's 'when' is not the max.

  Newest entry:   ${last.tag} (when=${last.when})
  Max in journal: ${max.tag} (when=${max.when})

Drizzle's migrator compares each migration's 'when' (folderMillis)
against MAX(created_at) in drizzle.__drizzle_migrations. Any database
where ${max.tag} is already applied will silently skip ${last.tag}
because its timestamp appears older than what's already on disk.

Fix: edit ${JOURNAL} and set ${last.tag}'s 'when' to any value
strictly greater than ${max.when}, e.g. ${bumpTo}.

Background: past merge-conflict resolutions left some entries with
hand-edited future timestamps, casting a shadow that naturally-generated
(Date.now()-based) entries fall into. See TODOS.md for the long-term
cleanup plan (B: normalize historical timestamps + DB surgery).
`;

console.error(msg);
process.exit(1);
