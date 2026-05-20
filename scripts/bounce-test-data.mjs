#!/usr/bin/env node
// bounce-test-data.mjs
//
// Skjuter aktivitets-tidsstämplar framåt (eller bakåt) med N hela dagar
// så seedat testdata stannar i en användbar past↔future-fördelning utan
// att hela seeden behöver köras om.
//
// Touched:
//   activities.start_time / end_time / published_at / cancelled_at /
//   deleted_at / created_at / updated_at
//   activity_comments.created_at
//   activity_participants.created_at
//   activity_feedback.created_at
//
// Inte touched:
//   users.* / notifications.* / reports.* / admin_actions.* /
//   user_tokens.* - representerar konto- eller audit-state, inte
//   aktivitets-tidslinje. Att flytta dem muddrar semantiken.
//
// Standard är dry-run. --apply commitar.
//
// Användning:
//
// Lokalt (host-side, mot Docker Desktop's postgres):
//   bun run bounce:dates -- --days=30            # dry-run
//   bun run bounce:dates -- --days=30 --apply    # skriv
//
// I docker-compose-stacken (staging/prod på VPS) — via ops-servicen som
// reuse:ar migrate-imagen och har postgres + drizzle-deps:
//   docker compose run --rm ops scripts/bounce-test-data.mjs --days=30
//   docker compose run --rm ops scripts/bounce-test-data.mjs --days=30 --apply
//
// OBS: app-imagen är slim Next.js standalone och har INTE postgres-paketet
// — `docker compose exec app node scripts/...` fungerar inte. Kör alltid
// via ops-servicen i container-läge.

import postgres from "postgres";

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [[m[1], m[2] ?? true]] : [];
  }),
);

if (args.help || args.h) {
  process.stdout.write(`bounce-test-data.mjs

Skjuter aktivitets-tidsstämplar med N hela dagar.

  --days=N   Krävs. Heltal, negativt OK.
  --apply    Skriv på riktigt. Utan flaggan: dry-run.
  --help     Visa det här.
`);
  process.exit(0);
}

const daysRaw = args.days;
if (daysRaw === undefined || daysRaw === true) {
  console.error("ERROR: --days=N krävs (heltal, negativt OK).");
  process.exit(2);
}
if (!/^-?\d+$/.test(String(daysRaw))) {
  console.error(`ERROR: --days måste vara ett heltal, fick: ${daysRaw}`);
  process.exit(2);
}
const days = Number.parseInt(String(daysRaw), 10);
if (days === 0) {
  console.error("ERROR: --days=0 har ingen effekt.");
  process.exit(2);
}
// Cap så pathological input inte skapar interval som spränger Date-konstruktorn
// i dry-run-projektionen eller producerar absurda timestamps.
if (Math.abs(days) > 36500) {
  console.error(`ERROR: --days måste ligga inom ±36500 (100 år), fick: ${days}`);
  process.exit(2);
}

// --apply är boolean-only. `--apply=foo` ska inte tyst falla tillbaka till dry-run.
if (args.apply !== undefined && args.apply !== true) {
  console.error(`ERROR: --apply tar inget värde (fick: ${args.apply}). Använd bara --apply.`);
  process.exit(2);
}
const apply = args.apply === true;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL är inte satt");
  process.exit(1);
}

// Whitelistade tabeller/kolumner. Båda interpoleras rakt in i SQL nedan -
// redigera bara den här listan, ta aldrig emot tabell/kolumn-namn från CLI.
const targets = [
  {
    table: "activities",
    cols: [
      "start_time", "end_time", "published_at",
      "cancelled_at", "deleted_at",
      "created_at", "updated_at",
    ],
  },
  { table: "activity_comments", cols: ["created_at"] },
  { table: "activity_participants", cols: ["created_at"] },
  { table: "activity_feedback", cols: ["created_at"] },
];

const client = postgres(connectionString, { max: 1 });

try {
  await run();
} catch (err) {
  console.error("\nbounce misslyckades:", err);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 }).catch(() => {});
}

async function run() {
  const [before] = await client`
    SELECT MIN(start_time) AS min_s,
           MAX(start_time) AS max_s,
           COUNT(*)::int   AS n
    FROM activities
  `;

  console.log(`Läge:     ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Shift:    ${days} dag${Math.abs(days) === 1 ? "" : "ar"}`);
  console.log(`Före:     activities n=${before.n}`);
  console.log(`          start_time min=${fmt(before.min_s)}`);
  console.log(`          start_time max=${fmt(before.max_s)}`);

  if (!apply) {
    // Postgres `timestamp without time zone` (schemat här) tolkar `+ INTERVAL 'N
    // days'` som exakt N*24h, så ms-aritmetik nedan matchar apply-resultatet.
    // Skulle schemat byta till `timestamptz` blir prediktionen approximativ vid
    // DST-övergångar.
    const ms = days * 86_400_000;
    const projMin = before.min_s ? new Date(before.min_s.getTime() + ms) : null;
    const projMax = before.max_s ? new Date(before.max_s.getTime() + ms) : null;
    console.log(`Projicerat efter shift:`);
    console.log(`          start_time min=${fmt(projMin)}`);
    console.log(`          start_time max=${fmt(projMax)}`);
    console.log(`\nDry-run. Kör om med --apply för att skriva.`);
    return;
  }

  console.log(`\nFlyttar tidsstämplar på ALLA ${before.n} aktiviteter och relaterade rader.`);

  // days är validerat som heltal via regex ovan, säkert att inline:a i SQL.
  // Tabell/kolumn-namn kommer från hardkodade `targets`.
  const interval = `INTERVAL '${days} days'`;

  const counts = await client.begin(async (tx) => {
    // Konsistenslås så samtidiga writes inte ser activities flyttade men
    // comments/participants/feedback orörda mitt i transaktionen. SHARE ROW
    // EXCLUSIVE blockar UPDATE/INSERT/DELETE men inte SELECT.
    await tx.unsafe(
      `LOCK TABLE ${targets.map((t) => `"${t.table}"`).join(", ")} IN SHARE ROW EXCLUSIVE MODE`,
    );

    const out = {};
    for (const { table, cols } of targets) {
      const set = cols.map((c) => `"${c}" = "${c}" + ${interval}`).join(", ");
      const r = await tx.unsafe(`UPDATE "${table}" SET ${set}`);
      out[table] = r.count ?? r.length ?? 0;
    }
    return out;
  });

  const [after] = await client`
    SELECT MIN(start_time) AS min_s, MAX(start_time) AS max_s
    FROM activities
  `;

  console.log("\nKlart:");
  for (const [t, n] of Object.entries(counts)) {
    console.log(`  ${t.padEnd(24)} ${n} rad${n === 1 ? "" : "er"}`);
  }
  console.log(`Efter:    start_time min=${fmt(after.min_s)}`);
  console.log(`          start_time max=${fmt(after.max_s)}`);
}

function fmt(d) {
  return d ? d.toISOString() : "(none)";
}
