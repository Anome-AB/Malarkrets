import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import * as schema from "./schema";

// ─── Demo/fixture seed (dev only) ───────────────────────────────────────────
//
// This script inserts demo users + demo activities + demo participants +
// demo comments against a database that has already been migrated. Reference
// data (interest tags, courage messages) is NOT inserted here - those live
// in migrations (see 0001_seed_baseline_data.sql and any follow-up data
// migrations). That separation lets reference data evolve safely in prod
// while demo data stays a local-only convenience.
//
// Usage:
//   bun run db:migrate   # apply migrations first (creates tags + courage)
//   bun run db:seed      # insert demo users and activities on top
//
// This script refuses to run against NODE_ENV=production. Belt-and-braces:
// it also bails out if a demo user (anna@example.com) already exists.

if (process.env.NODE_ENV === "production") {
  console.error("seed (demo fixtures) is never allowed in production");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Provide it via .env.local or environment.");
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client, { schema });

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Return a Date that is `daysFromNow` days in the future at the given hour:minute.
 *  Negative values are accepted for past activities. */
function futureDate(daysFromNow: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Curated set av Unsplash-foton som matchar aktivitetsteman. Stable IDs som
// inte byts ut. Hämtas via images.unsplash.com som tillåter direkt-länkning
// utan API-nyckel. Vi sparar bara photo-IDt i activity-defs nedan; helpern
// bygger imageThumbUrl/imageMediumUrl/imageOgUrl-tripeln av samma bild i
// olika storlekar.
const UNSPLASH_PHOTOS: Record<string, string> = {
  vandring: "1441974231531-c6227db76b6e",      // skogsstig
  vandring2: "1469854523086-cc02fe5d8800",     // bergsutsikt
  vandring3: "1551632811-561732d1e306",        // människor på vandring
  natur: "1502082553048-f009c37129b9",         // skog med mossa
  yoga: "1545205597-b80f55c2d33d",             // yogamatta
  yoga2: "1599901860904-17e6ed7083a0",         // yogapose ute
  brädspel: "1606503153255-59d8b8b82b28",      // brädspel
  matlagning: "1556909114-f6e7ad7d3136",       // pasta
  matlagning2: "1490645935967-10de6ba17061",   // mat på fat
  bakning: "1486427944299-d1955d23e34d",       // bakade bullar
  fotografi: "1502920917128-1aa500764cbd",     // kamera
  fotografi2: "1452780212940-6f5c0d14d848",    // gammal kamera
  löpning: "1552674605-db6ffd4facb5",          // löparskor
  löpning2: "1571019614242-c5c5dee9f50b",      // löpare ute
  cykling: "1502744688674-c619d1586c9e",       // cykel landsväg
  vinprovning: "1510812431401-41d2bd2722f3",   // vinglas
  café: "1495474472287-4d71bcdd2085",          // kaffe latte
  musik: "1493225457124-a3eb161ffa5f",         // konsert
  programmering: "1517694712202-14dd9538aa97", // laptop kod
  schack: "1528819622765-d6bcf132f793",        // schackpjäser
  simning: "1530549387789-4c1017266635",       // simhall
  konst: "1452860606245-08befc0ff44b",         // måleri
  trädgård: "1416431168657-a6c4184348ab",      // växter
  bok: "1507842217343-583bb7270b66",           // bokstapel
  bibliotek: "1481627834876-b7833e8f5570",     // bibliotek
  fågel: "1444930694458-01babe71870e",         // fågel i flykt
  stickning: "1604110949070-9c5dfe5b5d49",     // garn
  styrketräning: "1534438327276-14e5300c3a48", // gym
  film: "1489599849927-2ee91cede3ba",          // bio
  dans: "1518611012118-696072aa579a",          // dansare
  håll: "1564507592333-c60657eea523",          // glada vänner
  picknick: "1530541930197-ff16ac917b0e",      // picknick
  utomhus: "1471107340929-a87cd0f5b5f3",       // sjö landskap
  gemenskap: "1529543544282-ea669407fca3",     // grupp middag
  vinter: "1457269449834-928af64c684d",        // snöig stig
  höst: "1507608616759-54f48f0af0ee",          // höstlöv
};

function unsplashUrls(photoKey: keyof typeof UNSPLASH_PHOTOS) {
  const id = UNSPLASH_PHOTOS[photoKey];
  const base = `https://images.unsplash.com/photo-${id}`;
  return {
    imageThumbUrl: `${base}?w=400&auto=format&fit=crop&q=80`,
    imageMediumUrl: `${base}?w=800&auto=format&fit=crop&q=80`,
    imageOgUrl: `${base}?w=1200&auto=format&fit=crop&q=80`,
  };
}

// ─── Seed logic ─────────────────────────────────────────────────────────────

// När RESEED_ACTIVITIES=1 sätts: hoppa över user-creation, wipa befintliga
// aktiviteter (inkl. tags/participants/comments via cascade), och insertera
// den utökade listan. Användardatan rörs aldrig — bara aktiviteter.
const RESEED_ACTIVITIES = process.env.RESEED_ACTIVITIES === "1";

async function seed() {
  console.log("Checking preconditions...");

  const [existingDemo] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "anna@example.com"))
    .limit(1);
  if (existingDemo && !RESEED_ACTIVITIES) {
    console.log("Demo user anna@example.com already present, skipping demo seed.");
    console.log("(Sätt RESEED_ACTIVITIES=1 för att wipa och re-seeda aktiviteter.)");
    await client.end();
    return;
  }
  if (RESEED_ACTIVITIES && !existingDemo) {
    console.error("RESEED_ACTIVITIES kräver att demo-användarna redan finns. Kör vanlig seed först.");
    await client.end();
    process.exit(1);
  }

  // Reference data (interest tags, courage messages) is expected to exist
  // already because migrations must have been applied before running seed.
  // Load the tag catalogue so we can look up IDs by canonical name below.
  const allTags = await db
    .select({ id: schema.interestTags.id, name: schema.interestTags.name })
    .from(schema.interestTags);
  if (allTags.length === 0) {
    console.error(
      "No interest tags found. Run `bun run db:migrate` first so the baseline data migration populates them.",
    );
    await client.end();
    process.exit(1);
  }
  const tagMap = new Map(allTags.map((t) => [t.name, t.id]));
  console.log(`  Loaded ${allTags.length} interest tags from DB.`);

  // ── 2. Demo users ──────────────────────────────────────────────────────

  let anna: string;
  let erik: string;
  let sara: string;
  let omar: string;
  let lisa: string;

  if (RESEED_ACTIVITIES) {
    console.log("Reseed-mode: hämtar befintliga demo-användare...");
    const demoEmails = [
      "anna@example.com",
      "erik@example.com",
      "sara@example.com",
      "omar@example.com",
      "lisa@example.com",
    ];
    const existing = await db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users);
    const byEmail = new Map(existing.map((u) => [u.email, u.id]));
    for (const e of demoEmails) {
      if (!byEmail.has(e)) {
        console.error(`Saknar demo-användare ${e}. Kör vanlig seed först.`);
        await client.end();
        process.exit(1);
      }
    }
    anna = byEmail.get("anna@example.com")!;
    erik = byEmail.get("erik@example.com")!;
    sara = byEmail.get("sara@example.com")!;
    omar = byEmail.get("omar@example.com")!;
    lisa = byEmail.get("lisa@example.com")!;

    console.log("Wipa befintliga aktiviteter...");
    // Beroende-ordning: kommentarer + deltagare + tags refererar till aktiviteter.
    // Cascade borde fixa det men explicit är säkrare.
    await db.delete(schema.activityComments);
    await db.delete(schema.activityParticipants);
    await db.delete(schema.activityFeedback);
    await db.delete(schema.activityTags);
    await db.delete(schema.activities);
    console.log("  Wipe klart.");
  } else {
    console.log("Seeding demo users...");

    const passwordHash = await hash("testlosen123", 12);

    const userDefs = [
      { email: "anna@example.com", firstName: "Anna", lastName: "Karlsson", displayName: "Anna K", gender: "kvinna" as const, birthDate: "1985-04-12" },
      { email: "erik@example.com", firstName: "Erik", lastName: "Persson", displayName: "Erik P", gender: "man" as const, birthDate: "1990-08-23" },
      { email: "sara@example.com", firstName: "Sara", lastName: "Lindqvist", displayName: "Sara L", gender: "kvinna" as const, birthDate: "1998-01-07" },
      { email: "omar@example.com", firstName: "Omar", lastName: "Hassan", displayName: "Omar H", gender: "man" as const, birthDate: "1988-11-30" },
      { email: "lisa@example.com", firstName: "Lisa", lastName: "Johansson", displayName: "Lisa J", gender: "kvinna" as const, birthDate: "1975-06-18" },
    ];

    const insertedUsers = await db
      .insert(schema.users)
      .values(
        userDefs.map((u) => ({
          ...u,
          passwordHash,
          emailVerified: true,
        }))
      )
      .returning();

    const userMap = new Map(insertedUsers.map((u) => [u.email, u.id]));
    anna = userMap.get("anna@example.com")!;
    erik = userMap.get("erik@example.com")!;
    sara = userMap.get("sara@example.com")!;
    omar = userMap.get("omar@example.com")!;
    lisa = userMap.get("lisa@example.com")!;

    console.log(`  Inserted ${insertedUsers.length} demo users.`);
  }

  // ── 2b. Test users ────────────────────────────────────────────────────

  if (RESEED_ACTIVITIES) {
    console.log("Reseed-mode: hoppar över test-users + user-interests, går direkt till aktiviteter.");
  }

  if (!RESEED_ACTIVITIES) {

  console.log("Seeding test users...");

  const testPasswordHash = await hash("testm", 12);

  const testUserDefs = [
    { email: "testanv1@malarkrets.se", firstName: "Test", lastName: "Användare 1", displayName: "Test A", gender: "ej_angett" as const, birthDate: null, isAdmin: false },
    { email: "testanv2@malarkrets.se", firstName: "Test", lastName: "Användare 2", displayName: "Test A", gender: "man" as const, birthDate: "1990-01-15", isAdmin: false },
    { email: "testanv3@malarkrets.se", firstName: "Test", lastName: "Användare 3", displayName: "Test A", gender: "kvinna" as const, birthDate: "1995-06-20", isAdmin: false },
    { email: "testadmin1@malarkrets.se", firstName: "Test", lastName: "Admin", displayName: "Test A", gender: "ej_angett" as const, birthDate: null, isAdmin: true },
  ];

  const insertedTestUsers = await db
    .insert(schema.users)
    .values(
      testUserDefs.map((u) => ({
        ...u,
        passwordHash: testPasswordHash,
        emailVerified: true,
      }))
    )
    .returning();

  const testUserMap = new Map(insertedTestUsers.map((u) => [u.email, u.id]));
  console.log(`  Inserted ${insertedTestUsers.length} test users.`);

  // Assign random interests to test users
  const tagNames: string[] = allTags.map((t) => t.name);
  function pickRandom<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  const testInterestRows: { userId: string; tagId: number }[] = [];
  for (const testUser of insertedTestUsers) {
    const randomTags = pickRandom(tagNames, 3 + Math.floor(Math.random() * 3)); // 3-5
    for (const tagName of randomTags) {
      const tagId = tagMap.get(tagName);
      if (tagId) testInterestRows.push({ userId: testUser.id, tagId });
    }
  }

  if (testInterestRows.length > 0) {
    await db.insert(schema.userInterests).values(testInterestRows);
  }
  console.log(`  Assigned ${testInterestRows.length} test user interests.`);

  // ── 3. User interests ──────────────────────────────────────────────────

  console.log("Assigning user interests...");

  const userInterestAssignments: Record<string, string[]> = {
    [anna]: ["Vandring", "Fågelskådning", "Sticka / Virka", "Fotografi", "Yoga", "Bokcirkel"],
    [erik]: ["Brädspel", "Programmering", "E-sport", "Film", "Cykling", "Löpning", "Rollspel"],
    [sara]: ["Matlagning", "Keramik", "Dans", "Fotografi", "Yoga", "Bakning"],
    [omar]: ["Fotografi", "Vandring", "Löpning", "Historia", "Programmering", "Styrketräning", "Schack"],
    [lisa]: ["Yoga", "Simning", "Bokcirkel", "Vinprovning", "Teater", "Musik (lyssning)", "Trädgård"],
  };

  const userInterestRows: { userId: string; tagId: number }[] = [];
  for (const [userId, tagNames] of Object.entries(userInterestAssignments)) {
    for (const tagName of tagNames) {
      const tagId = tagMap.get(tagName);
      if (tagId) userInterestRows.push({ userId, tagId });
    }
  }

  await db.insert(schema.userInterests).values(userInterestRows);
  console.log(`  Assigned ${userInterestRows.length} user interests.`);

  } // end if (!RESEED_ACTIVITIES)

  // ── 4. Activities ──────────────────────────────────────────────────────

  console.log("Seeding activities...");

  const activityDefs = [
    {
      title: "Kvällspromenad runt Mälaren",
      description: "En härlig kvällspromenad längs Mälarens strandlinje. Vi går i lugnt tempo och njuter av naturen och solnedgången. Alla nivåer välkomna!",
      location: "Östra hamnen, Västerås",
      latitude: 59.6118, longitude: 16.5584,
      colorTheme: "sage",
      creatorId: anna,
      startTime: futureDate(1, 18, 0),
      endTime: futureDate(1, 19, 30),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Vandring"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Blandad grupp, alla åldrar", latePolicy: "Kom i tid, vi väntar inte efter start", courageMessage: "Du behöver inte känna någon för att komma - många som dyker upp gör det för första gången." },
    },
    {
      title: "Brädspelskväll på Stadsbiblioteket",
      description: "Drop-in brädspelskväll! Vi har med oss klassiker och nya spel. Perfekt för nybörjare och veteraner. Fika finns att köpa.",
      location: "Stadsbiblioteket, Västerås",
      latitude: 59.6110, longitude: 16.5440,
      colorTheme: "sky",
      creatorId: erik,
      startTime: futureDate(2, 17, 30),
      endTime: futureDate(2, 21, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Brädspel"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Mest 20-40 år, alla välkomna", latePolicy: "Kom när du kan, vi kör hela kvällen", courageMessage: "Kom som du är. Det spelar ingen roll om du är nybörjare eller inte känner någon." },
    },
    {
      title: "Nybörjarmatlagning - Indiskt",
      description: "Lär dig laga autentisk indisk mat från grunden. Vi gör tikka masala, naan och raita. Alla ingredienser ingår.",
      location: "Folkets Hus, Västerås",
      latitude: 59.6095, longitude: 16.5470,
      colorTheme: "mustard",
      creatorId: sara,
      startTime: futureDate(4, 14, 0),
      endTime: futureDate(4, 17, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Matlagning"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Matintresserade i alla åldrar", latePolicy: "Kom i tid, vi börjar laga direkt", courageMessage: "Alla är välkomna oavsett erfarenhet. Vi ses där!" },
    },
    {
      title: "Fotopromenad i gamla stan",
      description: "Vi utforskar Västerås gamla stadskärna med kameran. Tips om komposition och ljus under promenaden. Alla kameror/mobiler välkomna.",
      location: "Svartån/Kyrkbacken, Västerås",
      latitude: 59.6130, longitude: 16.5410,
      colorTheme: "terracotta",
      creatorId: omar,
      startTime: futureDate(3, 10, 0),
      endTime: futureDate(3, 12, 30),
      maxParticipants: 15,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Fotografi", "Vandring"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Fotoentusiaster, blandade åldrar", latePolicy: "Vi samlas vid Svartån kl 10 sharp" },
    },
    {
      title: "Yoga i parken för nybörjare",
      description: "Lugn morgonyoga utomhus i Vasaparken. Jag guidar genom grundläggande positioner. Ta med egen matta och vattenflaska.",
      location: "Vasaparken, Västerås",
      latitude: 59.6155, longitude: 16.5505,
      colorTheme: "lavender",
      creatorId: lisa,
      startTime: futureDate(0, 7, 30),
      endTime: futureDate(0, 8, 30),
      maxParticipants: 20,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Yoga"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Mest kvinnor 25-50, men alla välkomna", latePolicy: "Kom 5 min innan start", courageMessage: "Jag startade den här aktiviteten just för att det ska vara lätt att hänga med - välkommen!" },
    },
    {
      title: "Fågelskådning vid Asköviken",
      description: "Tidig morgonvandring vid Asköviken naturreservat. Vi spanar efter vårfåglar och diskuterar artbestämning. Kikare finns att låna.",
      location: "Asköviken naturreservat, Västerås",
      latitude: 59.5880, longitude: 16.4730,
      colorTheme: "sage",
      creatorId: anna,
      startTime: futureDate(5, 8, 0),
      endTime: futureDate(5, 11, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Fågelskådning"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Naturintresserade, blandade åldrar", latePolicy: "Samling vid parkeringen kl 08:00" },
    },
    {
      title: "Bokcirkel: Svensk deckare",
      description: "Vi läser och diskuterar en ny svensk deckare varje månad. Denna gång: valfri titel av Camilla Läckberg. Mysig stämning med fika.",
      location: "Café August, Västerås",
      latitude: 59.6105, longitude: 16.5455,
      colorTheme: "peach",
      creatorId: lisa,
      startTime: futureDate(6, 19, 0),
      endTime: futureDate(6, 21, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Bokcirkel"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Bokälskare, mest 30-60 år", latePolicy: "Kom gärna i tid så vi hinner fika först" },
    },
    {
      title: "Kodkväll för nybörjare",
      description: "Lär dig programmera från scratch! Vi börjar med Python och bygger enkla projekt tillsammans. Egen laptop krävs.",
      location: "Stadsbiblioteket, Västerås",
      latitude: 59.6110, longitude: 16.5440,
      colorTheme: "sky",
      creatorId: erik,
      startTime: futureDate(8, 18, 0),
      endTime: futureDate(8, 20, 30),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Programmering"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Teknikintresserade, alla åldrar", latePolicy: "Kom i tid, vi börjar med intro kl 18" },
    },
    {
      title: "Keramikworkshop",
      description: "Prova på keramik och dreja din egen skål. Material ingår. Begränsat antal platser - passa på!",
      location: "Kulturhuset, Västerås",
      latitude: 59.6100, longitude: 16.5490,
      colorTheme: "rose",
      creatorId: sara,
      startTime: futureDate(9, 13, 0),
      endTime: futureDate(9, 16, 0),
      maxParticipants: 6,
      genderRestriction: "kvinnor" as const,
      minAge: 18,
      tags: ["Keramik"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Kreativa kvinnor 18+", latePolicy: "Måste vara på plats vid start" },
    },
    {
      title: "Löpgrupp - 5 km",
      description: "Gemensam löprunda på ca 5 km i lagom tempo. Vi springer längs Mälaren och tillbaka. Alla hastigheter välkomna!",
      location: "Lögarängen, Västerås",
      latitude: 59.6075, longitude: 16.5530,
      colorTheme: "mustard",
      creatorId: omar,
      startTime: futureDate(1, 6, 30),
      endTime: futureDate(1, 7, 30),
      maxParticipants: 20,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Löpning"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Motionärer, blandade nivåer", latePolicy: "Vi startar exakt kl 06:30" },
    },
    {
      title: "Vinprovning med tema Italien",
      description: "Smaka sex utvalda italienska viner med tilltugg. Vi pratar druvor, regioner och matpairing. Avslappnad stämning.",
      location: "Restaurang Bia, Västerås",
      latitude: 59.6120, longitude: 16.5420,
      colorTheme: "terracotta",
      creatorId: lisa,
      startTime: futureDate(10, 19, 0),
      endTime: futureDate(10, 21, 30),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: 25,
      tags: ["Vinprovning"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Vinintresserade 25+", latePolicy: "Kom i tid, vi börjar punklitgt kl 19" },
    },
    {
      title: "Stickcafé på Ica Maxi",
      description: "Ta med ditt stickprojekt och häng med oss i caféet. Nybörjare får gärna hjälp att komma igång. Garn och stickor finns att köpa på plats.",
      location: "Ica Maxi Erikslund, Västerås",
      latitude: 59.6200, longitude: 16.5100,
      colorTheme: "stone",
      creatorId: anna,
      startTime: futureDate(0, 14, 0),
      endTime: futureDate(0, 16, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Sticka / Virka"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Mest kvinnor men alla välkomna", latePolicy: "Drop-in, kom och gå som du vill" },
    },
    {
      title: "Historisk stadsvandring",
      description: "Guidad promenad genom Västerås historia - från vikingatid till modern industri. Vi besöker domkyrkan, Anundshög-utställningen och mer.",
      location: "Domkyrkan, Västerås",
      latitude: 59.6115, longitude: 16.5395,
      colorTheme: "lavender",
      creatorId: omar,
      startTime: futureDate(12, 11, 0),
      endTime: futureDate(12, 13, 0),
      maxParticipants: 15,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Historia", "Vandring"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Historieintresserade, alla åldrar", latePolicy: "Samling vid domkyrkans entré kl 11" },
    },
    {
      title: "Filmkväll: Studio Ghibli-maraton",
      description: "Vi ser två Studio Ghibli-filmer på storbild! Popcorn och snacks ingår. Rösta på vilka filmer vi ser i kommentarerna.",
      location: "Folkets Hus, Västerås",
      latitude: 59.6095, longitude: 16.5470,
      colorTheme: "peach",
      creatorId: erik,
      startTime: futureDate(13, 17, 0),
      endTime: futureDate(13, 22, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Film"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Animefans och filmälskare", latePolicy: "Kom gärna 15 min innan för bästa plats" },
    },
    {
      title: "Simning - morgonpass",
      description: "Gemensamt morgonpass i 50-metersbassängen. Vi simmar i eget tempo men peppar varandra. Alla nivåer välkomna.",
      location: "Lögarängsbadet, Västerås",
      latitude: 59.6070, longitude: 16.5535,
      colorTheme: "sky",
      creatorId: lisa,
      startTime: futureDate(14, 7, 0),
      endTime: futureDate(14, 8, 0),
      maxParticipants: 15,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Simning"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Simmare i alla åldrar och nivåer", latePolicy: "Var ombytt och redo kl 07:00" },
    },
    {
      title: "Språk - Svenska/Engelska",
      description: "Öva svenska eller engelska i avslappnad miljö. Vi byter språk varannan halvtimme. Fika ingår!",
      location: "Café Stationen, Västerås",
      latitude: 59.6090, longitude: 16.5560,
      colorTheme: "rose",
      creatorId: sara,
      startTime: futureDate(15, 16, 0),
      endTime: futureDate(15, 18, 0),
      maxParticipants: 16,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Språk"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Språkintresserade, internationell mix", latePolicy: "Drop-in, kom när du kan" },
    },
    {
      title: "Styrketräning utomhus",
      description: "Funktionell styrketräning i Djäknebergets utegym. Jag leder ett 45-minuterspass med kroppsviktsövningar. Inga redskap behövs.",
      location: "Djäkneberget, Västerås",
      latitude: 59.6140, longitude: 16.5380,
      colorTheme: "sage",
      creatorId: omar,
      startTime: futureDate(17, 7, 0),
      endTime: futureDate(17, 7, 45),
      maxParticipants: 15,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Styrketräning"],
      whatToExpect: { audience: "alla", experienceLevel: "medel", whoComes: "Träningsintresserade 20-45 år", latePolicy: "Kom uppvärmningsklar kl 07:00" },
    },
    {
      title: "Bastukväll för män",
      description: "Avslappnad bastukväll med bad och samtal. Bra tillfälle att träffa andra killar i Västerås i lugn miljö. Tag med handduk och badbyxor.",
      location: "Lögarängsbadet, Västerås",
      latitude: 59.6070, longitude: 16.5535,
      colorTheme: "stone",
      creatorId: erik,
      startTime: futureDate(11, 19, 0),
      endTime: futureDate(11, 21, 30),
      maxParticipants: 10,
      genderRestriction: "man" as const,
      minAge: 18,
      tags: ["Simning"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Mixade åldrar, 18+", latePolicy: "Kom i tid, insläpp slutar kl 19:15", courageMessage: "Du behöver inte känna någon för att komma. De flesta hittar hit ensamma första gången." },
    },

    // ─── Passerade aktiviteter (för historik och feedback-flöde) ──────────
    {
      title: "Vandring i Anundshögsskogen",
      description: "Vi vandrade till Anundshög och tillbaka, ca 8 km. Härligt väder och bra sällskap.",
      location: "Anundshög, Västerås",
      latitude: 59.6310, longitude: 16.6390,
      ...unsplashUrls("vandring2"),
      creatorId: anna,
      startTime: futureDate(-7, 10, 0),
      endTime: futureDate(-7, 13, 0),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Vandring", "Historia"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Naturälskare 25-60 år", latePolicy: "Vi startade kl 10 punktligt" },
    },
    {
      title: "Vinprovning — Bordeaux",
      description: "Sex utvalda Bordeaux-viner med tilltugg. Riktigt mysig kväll på Bia.",
      location: "Restaurang Bia, Västerås",
      latitude: 59.6120, longitude: 16.5420,
      ...unsplashUrls("vinprovning"),
      creatorId: lisa,
      startTime: futureDate(-14, 19, 0),
      endTime: futureDate(-14, 21, 30),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: 25,
      tags: ["Vinprovning"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Vinintresserade 30-55 år", latePolicy: "Punkligt kl 19" },
    },
    {
      title: "Brädspelskväll — Catan-natten",
      description: "Tre Catan-rundor och pizza. Erik vann (igen).",
      location: "Stadsbiblioteket, Västerås",
      latitude: 59.6110, longitude: 16.5440,
      ...unsplashUrls("brädspel"),
      creatorId: erik,
      startTime: futureDate(-21, 18, 0),
      endTime: futureDate(-21, 22, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Brädspel"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Brädspelsentusiaster", latePolicy: "Drop-in" },
    },
    {
      title: "Höstvandring runt Mälaren",
      description: "Längs Mälaren när höstfärgerna stod på topp. ~6 km.",
      location: "Lövudden, Västerås",
      latitude: 59.6210, longitude: 16.6020,
      ...unsplashUrls("höst"),
      creatorId: omar,
      startTime: futureDate(-30, 11, 0),
      endTime: futureDate(-30, 13, 30),
      maxParticipants: 15,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Vandring", "Fotografi"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Blandade åldrar", latePolicy: "Samling vid p-platsen kl 11" },
    },
    {
      title: "Yoga vid Lögarängen",
      description: "Morgonpass utomhus när vädret tillät det. Solen tittade fram halvvägs.",
      location: "Lögarängen, Västerås",
      latitude: 59.6075, longitude: 16.5530,
      ...unsplashUrls("yoga2"),
      creatorId: lisa,
      startTime: futureDate(-3, 7, 30),
      endTime: futureDate(-3, 8, 30),
      maxParticipants: 20,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Yoga"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Mest kvinnor 25-50", latePolicy: "Kom 5 min innan" },
    },
    {
      title: "Bakcafé — semlor i februaristil",
      description: "Vi bakade semlor från grunden. Allas blev ätbara, en del blev fantastiska.",
      location: "Folkets Hus, Västerås",
      latitude: 59.6095, longitude: 16.5470,
      ...unsplashUrls("bakning"),
      creatorId: sara,
      startTime: futureDate(-10, 13, 0),
      endTime: futureDate(-10, 16, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Bakning"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Bakintresserade", latePolicy: "I tid, vi börjar på degen direkt" },
    },
    {
      title: "Schackcafé i Vasaparken",
      description: "Drop-in schack utomhus. Solen sken och pjäserna åkte fram.",
      location: "Vasaparken, Västerås",
      latitude: 59.6155, longitude: 16.5505,
      ...unsplashUrls("schack"),
      creatorId: omar,
      startTime: futureDate(-5, 14, 0),
      endTime: futureDate(-5, 17, 0),
      maxParticipants: 16,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Schack"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Alla nivåer", latePolicy: "Drop-in, kom när du vill" },
    },
    {
      title: "Bokcirkel — Sara Lidman",
      description: "Vi diskuterade 'Tjärdalen'. Bra samtal, mer kaffe än planerat.",
      location: "Café August, Västerås",
      latitude: 59.6105, longitude: 16.5455,
      ...unsplashUrls("bok"),
      creatorId: lisa,
      startTime: futureDate(-17, 19, 0),
      endTime: futureDate(-17, 21, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Bokcirkel"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Bokälskare 30-65", latePolicy: "Punktligt kl 19" },
    },

    // ─── Kommande 90 dagar (~50 aktiviteter) ──────────────────────────────
    {
      title: "Söndagspromenad i Tidö slottspark",
      description: "Långsam promenad genom slottsparken. Vi tar oss tid för allt fågelliv på vägen.",
      location: "Tidö slott, Västerås",
      latitude: 59.6800, longitude: 16.5870,
      ...unsplashUrls("vandring"),
      creatorId: anna,
      startTime: futureDate(2, 11, 0),
      endTime: futureDate(2, 13, 30),
      maxParticipants: 15,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Vandring", "Fågelskådning"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Naturentusiaster i alla åldrar", latePolicy: "Samling vid p-platsen 11:00" },
    },
    {
      title: "Quizkväll på Bishops Arms",
      description: "Allmänkunskap, musik och bild. Lag på 4-6 personer. Pris till vinnande lag!",
      location: "Bishops Arms, Västerås",
      latitude: 59.6100, longitude: 16.5430,
      ...unsplashUrls("gemenskap"),
      creatorId: erik,
      startTime: futureDate(3, 19, 0),
      endTime: futureDate(3, 22, 0),
      maxParticipants: 24,
      genderRestriction: "alla" as const,
      minAge: 20,
      tags: ["Brädspel"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Mest 25-45 år", latePolicy: "Kom 18:45 så hinner vi laguppdelning" },
    },
    {
      title: "Söndagsbrunch + språkutbyte",
      description: "Engelsk konversation över brunch. Alla nivåer välkomna — vi anpassar tempot.",
      location: "Café Stationen, Västerås",
      latitude: 59.6090, longitude: 16.5560,
      ...unsplashUrls("café"),
      creatorId: sara,
      startTime: futureDate(5, 11, 0),
      endTime: futureDate(5, 13, 0),
      maxParticipants: 14,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Språk"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Internationell mix", latePolicy: "Drop-in mellan 11-12" },
    },
    {
      title: "Kvällsspring vid Mälaren — 7 km",
      description: "Lite längre kvällspass i lugnt tempo. Vi pratar mer än vi flåsar.",
      location: "Östra hamnen, Västerås",
      latitude: 59.6118, longitude: 16.5584,
      ...unsplashUrls("löpning2"),
      creatorId: omar,
      startTime: futureDate(4, 18, 30),
      endTime: futureDate(4, 19, 45),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Löpning"],
      whatToExpect: { audience: "alla", experienceLevel: "medel", whoComes: "Tempot ca 6 min/km", latePolicy: "Punkligt 18:30 vid bryggan" },
    },
    {
      title: "Fotokurs — porträtt utomhus",
      description: "Vi tränar på naturligt ljus och komposition. Modeller turas om. Ta med kamera/mobil.",
      location: "Djäkneberget, Västerås",
      latitude: 59.6140, longitude: 16.5380,
      ...unsplashUrls("fotografi"),
      creatorId: omar,
      startTime: futureDate(7, 10, 0),
      endTime: futureDate(7, 13, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Fotografi"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Hobbyfotografer", latePolicy: "Vi börjar prick 10:00" },
    },
    {
      title: "Trädgårdsmiddag — vegetariskt",
      description: "Fyra rätter, allt vegetariskt, mest från egen odling. BYO vin.",
      location: "Privat trädgård, Västerås",
      latitude: 59.6180, longitude: 16.5640,
      ...unsplashUrls("trädgård"),
      creatorId: lisa,
      startTime: futureDate(8, 18, 0),
      endTime: futureDate(8, 22, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: 25,
      tags: ["Matlagning", "Trädgård"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Trädgårds- och matintresserade 25+", latePolicy: "Kom 17:45, vi sätter oss 18:00", courageMessage: "Det är okej att komma ensam — alla började så någon gång." },
    },
    {
      title: "Cykling — Anundshögsslingan",
      description: "Lugn 30 km-runda förbi historiska platser. Stopp vid Anundshög för fika.",
      location: "Centralstationen, Västerås",
      latitude: 59.6090, longitude: 16.5560,
      ...unsplashUrls("cykling"),
      creatorId: erik,
      startTime: futureDate(9, 9, 0),
      endTime: futureDate(9, 13, 0),
      maxParticipants: 14,
      genderRestriction: "alla" as const,
      minAge: 18,
      tags: ["Cykling", "Historia"],
      whatToExpect: { audience: "alla", experienceLevel: "medel", whoComes: "Cykelvana", latePolicy: "Punkligt 09:00 vid stationen" },
    },
    {
      title: "Pilatesintro för nybörjare",
      description: "Lugn intro till pilates. Fokus på bål och andning. Mattor finns att låna.",
      location: "Folkets Hus, Västerås",
      latitude: 59.6095, longitude: 16.5470,
      ...unsplashUrls("yoga"),
      creatorId: lisa,
      startTime: futureDate(10, 18, 0),
      endTime: futureDate(10, 19, 0),
      maxParticipants: 18,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Yoga"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Mest kvinnor", latePolicy: "Kom 10 min innan" },
    },
    {
      title: "Brädspelskväll — strategispel",
      description: "Tyngre strategispel: Terraforming Mars, Twilight Imperium-light, Wingspan. Erfarna spelare en fördel.",
      location: "Stadsbiblioteket, Västerås",
      latitude: 59.6110, longitude: 16.5440,
      ...unsplashUrls("brädspel"),
      creatorId: erik,
      startTime: futureDate(11, 17, 0),
      endTime: futureDate(11, 22, 30),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: 18,
      tags: ["Brädspel"],
      whatToExpect: { audience: "alla", experienceLevel: "medel", whoComes: "Brädspelsveteraner", latePolicy: "Punkligt 17:00" },
    },
    {
      title: "Akvarellkurs i Vasaparken",
      description: "Måla parkmiljön i akvarell. Material kan lånas, ta med eget om du har.",
      location: "Vasaparken, Västerås",
      latitude: 59.6155, longitude: 16.5505,
      ...unsplashUrls("konst"),
      creatorId: sara,
      startTime: futureDate(12, 13, 0),
      endTime: futureDate(12, 16, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Keramik"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Kreativa själar, alla nivåer", latePolicy: "13:00 vid lekparken" },
    },
    {
      title: "Filmkväll: Wes Anderson-maraton",
      description: "Tre filmer, popcorn, snacks. Vi börjar med Grand Budapest Hotel.",
      location: "Folkets Hus, Västerås",
      latitude: 59.6095, longitude: 16.5470,
      ...unsplashUrls("film"),
      creatorId: erik,
      startTime: futureDate(13, 16, 0),
      endTime: futureDate(13, 23, 0),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Film"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Filmälskare", latePolicy: "Kom 15:45 så hinner vi popcorn" },
    },
    {
      title: "Kodkväll — JavaScript-projekt",
      description: "Vi bygger en liten todo-app i React tillsammans. Egen laptop. Lite JS-vana hjälper.",
      location: "Stadsbiblioteket, Västerås",
      latitude: 59.6110, longitude: 16.5440,
      ...unsplashUrls("programmering"),
      creatorId: erik,
      startTime: futureDate(14, 18, 0),
      endTime: futureDate(14, 21, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Programmering"],
      whatToExpect: { audience: "alla", experienceLevel: "medel", whoComes: "Hobbyutvecklare", latePolicy: "Punkligt 18:00" },
    },
    {
      title: "Stickfika — strumpor och kaffe",
      description: "Drop-in stickning med strumpgarn. Visar upp pågående projekt och fikar.",
      location: "Café August, Västerås",
      latitude: 59.6105, longitude: 16.5455,
      ...unsplashUrls("stickning"),
      creatorId: anna,
      startTime: futureDate(15, 14, 0),
      endTime: futureDate(15, 16, 30),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Sticka / Virka"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Mest kvinnor", latePolicy: "Drop-in" },
    },
    {
      title: "Padelkväll — nybörjare",
      description: "Vi delar in i lag och kör matcher. Plan finns bokad. Inga förkunskaper krävs.",
      location: "Padelhall Erikslund, Västerås",
      latitude: 59.6190, longitude: 16.5110,
      ...unsplashUrls("styrketräning"),
      creatorId: omar,
      startTime: futureDate(16, 19, 0),
      endTime: futureDate(16, 21, 0),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: 18,
      tags: ["Styrketräning"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Sportintresserade 25-45", latePolicy: "Var ombytt 18:50" },
    },
    {
      title: "Fågelskådning vid Asköviken — vårfåglar",
      description: "Tidig morgon. Vi spanar efter sångare och vadare. Kikare finns att låna.",
      location: "Asköviken naturreservat, Västerås",
      latitude: 59.5880, longitude: 16.4730,
      ...unsplashUrls("fågel"),
      creatorId: anna,
      startTime: futureDate(17, 6, 30),
      endTime: futureDate(17, 9, 30),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Fågelskådning"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Fågelintresserade", latePolicy: "Samling vid p-platsen 06:30 sharp" },
    },
    {
      title: "Vinprovning — naturviner",
      description: "Vi smakar 6 naturviner från Frankrike och Italien. Ostbricka ingår.",
      location: "Restaurang Bia, Västerås",
      latitude: 59.6120, longitude: 16.5420,
      ...unsplashUrls("vinprovning"),
      creatorId: lisa,
      startTime: futureDate(18, 19, 0),
      endTime: futureDate(18, 21, 30),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: 25,
      tags: ["Vinprovning"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Vinintresserade 25+", latePolicy: "Punkligt 19:00" },
    },
    {
      title: "Morgonsim — 1500 m",
      description: "Strukturerat pass i 50-bassängen. Vi delar upp i hastighetsbanor.",
      location: "Lögarängsbadet, Västerås",
      latitude: 59.6070, longitude: 16.5535,
      ...unsplashUrls("simning"),
      creatorId: lisa,
      startTime: futureDate(19, 6, 30),
      endTime: futureDate(19, 7, 45),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: 18,
      tags: ["Simning"],
      whatToExpect: { audience: "alla", experienceLevel: "medel", whoComes: "Vana simmare", latePolicy: "Var ombytt 06:25" },
    },
    {
      title: "Stadsvandring — gatukonst",
      description: "Vi promenerar runt centrum och spanar efter graffiti och murals. Kamera = bra idé.",
      location: "Stora torget, Västerås",
      latitude: 59.6094, longitude: 16.5430,
      ...unsplashUrls("fotografi2"),
      creatorId: omar,
      startTime: futureDate(20, 14, 0),
      endTime: futureDate(20, 16, 30),
      maxParticipants: 18,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Fotografi", "Vandring"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Konstnyfikna", latePolicy: "14:00 vid torgklockan" },
    },
    {
      title: "Indiskt matlagningskurs — vegetariskt",
      description: "Dal, paneer butter masala, naan, raita. Allt veganskt-anpassningsbart. Recept ingår.",
      location: "Folkets Hus, Västerås",
      latitude: 59.6095, longitude: 16.5470,
      ...unsplashUrls("matlagning2"),
      creatorId: sara,
      startTime: futureDate(22, 17, 30),
      endTime: futureDate(22, 21, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Matlagning"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Matintresserade", latePolicy: "Kom 17:15" },
    },
    {
      title: "Bokcirkel — modern svensk skönlitteratur",
      description: "Denna gång: 'Beredskapssamhället' av Pernilla Thunberg. Boken finns på biblioteket.",
      location: "Café August, Västerås",
      latitude: 59.6105, longitude: 16.5455,
      ...unsplashUrls("bibliotek"),
      creatorId: lisa,
      startTime: futureDate(24, 19, 0),
      endTime: futureDate(24, 21, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Bokcirkel"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Bokälskare", latePolicy: "Punkligt 19:00" },
    },
    {
      title: "Konsertkväll — lokala band",
      description: "Tre lokala band spelar på Black Sheep. Genrer: indie, folk, rock.",
      location: "Black Sheep, Västerås",
      latitude: 59.6090, longitude: 16.5440,
      ...unsplashUrls("musik"),
      creatorId: erik,
      startTime: futureDate(25, 20, 0),
      endTime: futureDate(25, 23, 30),
      maxParticipants: 30,
      genderRestriction: "alla" as const,
      minAge: 20,
      tags: ["Film"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Musikintresserade 20-40", latePolicy: "Insläpp från 19:30" },
    },
    {
      title: "Kvällsyoga — yin",
      description: "Lugn yin-yoga med långa stretchar. Bra avslutning på dagen.",
      location: "Vasaparken, Västerås",
      latitude: 59.6155, longitude: 16.5505,
      ...unsplashUrls("yoga"),
      creatorId: lisa,
      startTime: futureDate(26, 19, 0),
      endTime: futureDate(26, 20, 15),
      maxParticipants: 18,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Yoga"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Yogaintresserade", latePolicy: "Kom 18:50" },
    },
    {
      title: "Fotopromenad — Skog & sjö",
      description: "Vi kör ut till Lövudden och fotograferar. Skjuts från centrum kan ordnas.",
      location: "Lövudden, Västerås",
      latitude: 59.6210, longitude: 16.6020,
      ...unsplashUrls("natur"),
      creatorId: omar,
      startTime: futureDate(28, 9, 30),
      endTime: futureDate(28, 13, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Fotografi", "Vandring"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Naturfotografer", latePolicy: "P-platsen 09:30" },
    },
    {
      title: "Schackturnering — snabbschack",
      description: "5+0 blixt-format, swissystem. Pris till topp 3. Anmäl klockslag!",
      location: "Stadsbiblioteket, Västerås",
      latitude: 59.6110, longitude: 16.5440,
      ...unsplashUrls("schack"),
      creatorId: omar,
      startTime: futureDate(30, 13, 0),
      endTime: futureDate(30, 17, 0),
      maxParticipants: 16,
      genderRestriction: "alla" as const,
      minAge: 12,
      tags: ["Schack"],
      whatToExpect: { audience: "alla", experienceLevel: "medel", whoComes: "Schackspelare alla nivåer", latePolicy: "Anmälan 12:30" },
    },
    {
      title: "Långpromenad — 12 km runt Hammarby",
      description: "Hela rundan runt sjön. Vi tar god tid på oss och pausar för fika.",
      location: "Hammarbyparken, Västerås",
      latitude: 59.6360, longitude: 16.5490,
      ...unsplashUrls("vandring3"),
      creatorId: anna,
      startTime: futureDate(31, 9, 0),
      endTime: futureDate(31, 14, 0),
      maxParticipants: 14,
      genderRestriction: "alla" as const,
      minAge: 16,
      tags: ["Vandring"],
      whatToExpect: { audience: "alla", experienceLevel: "medel", whoComes: "Vandrare med kondition", latePolicy: "Sharp 09:00" },
    },
    {
      title: "Picknick i Vasaparken",
      description: "Drop-in picknick. Vi tar med var sin sak att dela. Filt, mat, dryck.",
      location: "Vasaparken, Västerås",
      latitude: 59.6155, longitude: 16.5505,
      ...unsplashUrls("picknick"),
      creatorId: sara,
      startTime: futureDate(33, 12, 0),
      endTime: futureDate(33, 15, 0),
      maxParticipants: 25,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Bokcirkel"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Alla välkomna", latePolicy: "Drop-in", courageMessage: "Kom som du är, även ensam." },
    },
    {
      title: "Bakdag — surdegsbröd",
      description: "Vi bakar surdegsbröd från grunden. Ta med en burk till deg och en till smula.",
      location: "Folkets Hus, Västerås",
      latitude: 59.6095, longitude: 16.5470,
      ...unsplashUrls("bakning"),
      creatorId: sara,
      startTime: futureDate(35, 10, 0),
      endTime: futureDate(35, 15, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Bakning"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Bakintresserade", latePolicy: "10:00 sharp, vi börjar med skålen" },
    },
    {
      title: "Cykla till Sala — heldagstur",
      description: "ca 70 km en väg. Lunch i Sala, tåg hem. Krävs cykelvana.",
      location: "Centralstationen, Västerås",
      latitude: 59.6090, longitude: 16.5560,
      ...unsplashUrls("cykling"),
      creatorId: erik,
      startTime: futureDate(37, 8, 0),
      endTime: futureDate(37, 17, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: 20,
      tags: ["Cykling"],
      whatToExpect: { audience: "alla", experienceLevel: "avancerad", whoComes: "Cyklister med kondition", latePolicy: "Sharp 08:00 vid stationen" },
    },
    {
      title: "Yoga — power flow",
      description: "Snabbare flow för dig som vill svettas. 60 minuter, intensiv stretch.",
      location: "Vasaparken, Västerås",
      latitude: 59.6155, longitude: 16.5505,
      ...unsplashUrls("yoga2"),
      creatorId: lisa,
      startTime: futureDate(39, 8, 0),
      endTime: futureDate(39, 9, 0),
      maxParticipants: 16,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Yoga"],
      whatToExpect: { audience: "alla", experienceLevel: "medel", whoComes: "Yogaerfarna", latePolicy: "Kom 07:50" },
    },
    {
      title: "Pubquiz — film & TV",
      description: "Specialtema: 90-talsfilm + 2000-talsserier. Lag på 4-6 personer.",
      location: "Bishops Arms, Västerås",
      latitude: 59.6100, longitude: 16.5430,
      ...unsplashUrls("film"),
      creatorId: erik,
      startTime: futureDate(41, 19, 0),
      endTime: futureDate(41, 22, 0),
      maxParticipants: 30,
      genderRestriction: "alla" as const,
      minAge: 20,
      tags: ["Film", "Brädspel"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Filmälskare 25-45", latePolicy: "Anmälan 18:45" },
    },
    {
      title: "Löpning — intervaller",
      description: "Kort uppvärmning + 8x400m intervaller på elljusspår. Krävs grundkondition.",
      location: "Lögarängen, Västerås",
      latitude: 59.6075, longitude: 16.5530,
      ...unsplashUrls("löpning"),
      creatorId: omar,
      startTime: futureDate(43, 18, 30),
      endTime: futureDate(43, 19, 45),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: 18,
      tags: ["Löpning"],
      whatToExpect: { audience: "alla", experienceLevel: "medel", whoComes: "Löpare med kondition", latePolicy: "Sharp 18:30" },
    },
    {
      title: "Trädgårdsdag — vårplantering",
      description: "Vi förbereder odlingslådor och planterar förkultiverade plantor. Handskar finns.",
      location: "Stadsodlingen Ekbacken, Västerås",
      latitude: 59.6280, longitude: 16.5550,
      ...unsplashUrls("trädgård"),
      creatorId: lisa,
      startTime: futureDate(45, 10, 0),
      endTime: futureDate(45, 14, 0),
      maxParticipants: 15,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Trädgård"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Trädgårdsintresserade", latePolicy: "Drop-in mellan 10-12" },
    },
    {
      title: "Vandring — Kvarnberget",
      description: "Brant uppstigning, vacker utsikt. Tag rejäla skor. ca 6 km.",
      location: "Kvarnberget, Västerås",
      latitude: 59.6450, longitude: 16.6700,
      ...unsplashUrls("vandring2"),
      creatorId: anna,
      startTime: futureDate(47, 10, 0),
      endTime: futureDate(47, 14, 0),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: 14,
      tags: ["Vandring"],
      whatToExpect: { audience: "alla", experienceLevel: "medel", whoComes: "Naturvana", latePolicy: "P-platsen 10:00" },
    },
    {
      title: "Programmering — Rust för nybörjare",
      description: "Intro till Rust. Vi går igenom ownership och bygger en kommandoradsapp.",
      location: "Stadsbiblioteket, Västerås",
      latitude: 59.6110, longitude: 16.5440,
      ...unsplashUrls("programmering"),
      creatorId: erik,
      startTime: futureDate(49, 18, 0),
      endTime: futureDate(49, 21, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Programmering"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Utvecklare, alla språk", latePolicy: "Kom 17:50" },
    },
    {
      title: "Kvinnor i naturen — vandring",
      description: "Vandring och samtal om friluftsliv. Endast för kvinnor.",
      location: "Asköviken naturreservat, Västerås",
      latitude: 59.5880, longitude: 16.4730,
      ...unsplashUrls("natur"),
      creatorId: anna,
      startTime: futureDate(50, 10, 0),
      endTime: futureDate(50, 13, 30),
      maxParticipants: 10,
      genderRestriction: "kvinnor" as const,
      minAge: 18,
      tags: ["Vandring"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Kvinnor 18+", latePolicy: "P-platsen 10:00", courageMessage: "Bra format för dig som vill prova vandring i mindre grupp." },
    },
    {
      title: "Höstpromenad — svampskådning",
      description: "Vi går genom skogen och letar svamp. Bra första-tur för nybörjare.",
      location: "Skälby skog, Västerås",
      latitude: 59.6360, longitude: 16.5790,
      ...unsplashUrls("höst"),
      creatorId: anna,
      startTime: futureDate(52, 11, 0),
      endTime: futureDate(52, 14, 0),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Vandring"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Naturintresserade", latePolicy: "P-plats vid skogsbrynet 11:00" },
    },
    {
      title: "Brädspel — familjekväll",
      description: "Familjevänliga spel: Carcassonne, Ticket to Ride, Codenames. Barn 10+.",
      location: "Stadsbiblioteket, Västerås",
      latitude: 59.6110, longitude: 16.5440,
      ...unsplashUrls("brädspel"),
      creatorId: erik,
      startTime: futureDate(54, 17, 0),
      endTime: futureDate(54, 20, 0),
      maxParticipants: 16,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Brädspel"],
      whatToExpect: { audience: "familj", experienceLevel: "alla", whoComes: "Familjer med barn 10+", latePolicy: "Drop-in 17-18" },
    },
    {
      title: "Kvällsbrunch — pannkakor & pajer",
      description: "Sallsemester-format brunch på kvällen. Vi gör tillsammans.",
      location: "Folkets Hus, Västerås",
      latitude: 59.6095, longitude: 16.5470,
      ...unsplashUrls("matlagning"),
      creatorId: sara,
      startTime: futureDate(56, 18, 0),
      endTime: futureDate(56, 21, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Matlagning", "Bakning"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Matintresserade", latePolicy: "Kom 17:45" },
    },
    {
      title: "Fågelguidning — för nybörjare",
      description: "Vi lär oss känna igen 15-20 vanliga arter. Kikare och fågelbok finns att låna.",
      location: "Asköviken naturreservat, Västerås",
      latitude: 59.5880, longitude: 16.4730,
      ...unsplashUrls("fågel"),
      creatorId: anna,
      startTime: futureDate(58, 7, 0),
      endTime: futureDate(58, 10, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: 12,
      tags: ["Fågelskådning"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Nyfikna naturmänniskor", latePolicy: "Sharp 07:00" },
    },
    {
      title: "Vinprovning — ekologiskt & svenskt",
      description: "Svenska vingårdar börjar göra sig hörda. Vi smakar 6 svenska viner med ostbricka.",
      location: "Restaurang Bia, Västerås",
      latitude: 59.6120, longitude: 16.5420,
      ...unsplashUrls("vinprovning"),
      creatorId: lisa,
      startTime: futureDate(60, 19, 0),
      endTime: futureDate(60, 21, 30),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: 25,
      tags: ["Vinprovning"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Vinintresserade 25+", latePolicy: "Punkligt 19" },
    },
    {
      title: "Söndagsfika i parken",
      description: "Drop-in fika utomhus. Ta med en kanna och något bakat eller köp på vägen.",
      location: "Vasaparken, Västerås",
      latitude: 59.6155, longitude: 16.5505,
      ...unsplashUrls("café"),
      creatorId: sara,
      startTime: futureDate(63, 14, 0),
      endTime: futureDate(63, 16, 30),
      maxParticipants: 30,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Bokcirkel"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Alla välkomna", latePolicy: "Drop-in", courageMessage: "Du är välkommen även ensam — bordet är öppet." },
    },
    {
      title: "Filmkväll — japansk anime",
      description: "Två filmer ur Studio Ghibli-katalogen. Snacks och soba ingår.",
      location: "Folkets Hus, Västerås",
      latitude: 59.6095, longitude: 16.5470,
      ...unsplashUrls("film"),
      creatorId: erik,
      startTime: futureDate(65, 18, 0),
      endTime: futureDate(65, 22, 30),
      maxParticipants: 14,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Film"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Animefans + filmnördar", latePolicy: "17:45" },
    },
    {
      title: "Stickfika — fortsättningskurs",
      description: "För dig som kan grunderna och vill lära dig mönsterstickning.",
      location: "Café August, Västerås",
      latitude: 59.6105, longitude: 16.5455,
      ...unsplashUrls("stickning"),
      creatorId: anna,
      startTime: futureDate(67, 15, 0),
      endTime: futureDate(67, 17, 30),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: 16,
      tags: ["Sticka / Virka"],
      whatToExpect: { audience: "alla", experienceLevel: "medel", whoComes: "Stickerskor med grunder", latePolicy: "15:00" },
    },
    {
      title: "Morgonyoga — energiboost",
      description: "Snabb 45-min-flow för att starta dagen. Inga förkunskaper.",
      location: "Lögarängen, Västerås",
      latitude: 59.6075, longitude: 16.5530,
      ...unsplashUrls("yoga2"),
      creatorId: lisa,
      startTime: futureDate(69, 6, 30),
      endTime: futureDate(69, 7, 15),
      maxParticipants: 16,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Yoga"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Morgonpigga", latePolicy: "06:25" },
    },
    {
      title: "Brädspel — för nybörjare",
      description: "Nya till brädspelshobbyn? Vi börjar med Carcassonne och Splendor. Lugnt tempo.",
      location: "Stadsbiblioteket, Västerås",
      latitude: 59.6110, longitude: 16.5440,
      ...unsplashUrls("brädspel"),
      creatorId: erik,
      startTime: futureDate(71, 18, 0),
      endTime: futureDate(71, 21, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Brädspel"],
      whatToExpect: { audience: "alla", experienceLevel: "nyborjare", whoComes: "Nybörjare välkomna", latePolicy: "17:50", courageMessage: "Du behöver verkligen inte ha spelat förut." },
    },
    {
      title: "Cykla & fika — söndagstur",
      description: "Lugn 25 km-tur med fikastopp halvvägs. Lämplig för alla.",
      location: "Centralstationen, Västerås",
      latitude: 59.6090, longitude: 16.5560,
      ...unsplashUrls("cykling"),
      creatorId: erik,
      startTime: futureDate(73, 11, 0),
      endTime: futureDate(73, 15, 0),
      maxParticipants: 14,
      genderRestriction: "alla" as const,
      minAge: 12,
      tags: ["Cykling"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Söndagscyklister", latePolicy: "11:00 vid stationen" },
    },
    {
      title: "Konsertkväll — jazz på Black Sheep",
      description: "Lokal jazztrio spelar i två set. Mat och dryck ingår ej.",
      location: "Black Sheep, Västerås",
      latitude: 59.6090, longitude: 16.5440,
      ...unsplashUrls("musik"),
      creatorId: lisa,
      startTime: futureDate(75, 20, 0),
      endTime: futureDate(75, 23, 0),
      maxParticipants: 25,
      genderRestriction: "alla" as const,
      minAge: 20,
      tags: ["Film"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Jazzälskare 30+", latePolicy: "Insläpp 19:30" },
    },
    {
      title: "Söndagsbrunch — internationell mix",
      description: "Var och en bidrar med en rätt från sitt hemland. Vi äter och pratar.",
      location: "Folkets Hus, Västerås",
      latitude: 59.6095, longitude: 16.5470,
      ...unsplashUrls("gemenskap"),
      creatorId: sara,
      startTime: futureDate(77, 12, 0),
      endTime: futureDate(77, 15, 0),
      maxParticipants: 20,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Matlagning", "Språk"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Internationell mix", latePolicy: "Drop-in 12-13" },
    },
    {
      title: "Löpning — långpass 15 km",
      description: "Lugn långkörning. Lämplig för dig som tränar för halv- eller helmaraton.",
      location: "Lögarängen, Västerås",
      latitude: 59.6075, longitude: 16.5530,
      ...unsplashUrls("löpning2"),
      creatorId: omar,
      startTime: futureDate(79, 8, 0),
      endTime: futureDate(79, 9, 45),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: 18,
      tags: ["Löpning"],
      whatToExpect: { audience: "alla", experienceLevel: "avancerad", whoComes: "Vana löpare", latePolicy: "Sharp 08:00" },
    },
    {
      title: "Fotopromenad — solnedgång över Mälaren",
      description: "Vi fångar solnedgången över sjön. Stativ rekommenderat.",
      location: "Östra hamnen, Västerås",
      latitude: 59.6118, longitude: 16.5584,
      ...unsplashUrls("utomhus"),
      creatorId: omar,
      startTime: futureDate(81, 19, 30),
      endTime: futureDate(81, 21, 30),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Fotografi"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Hobbyfotografer", latePolicy: "Bryggan 19:30" },
    },
    {
      title: "Stadsvandring — Västerås medeltid",
      description: "Guidad tur fokus medeltid: domkyrkan, slottet, gamla stan. Ca 2 timmar.",
      location: "Domkyrkan, Västerås",
      latitude: 59.6115, longitude: 16.5395,
      ...unsplashUrls("vandring"),
      creatorId: omar,
      startTime: futureDate(83, 13, 0),
      endTime: futureDate(83, 15, 0),
      maxParticipants: 18,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Historia", "Vandring"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Historieintresserade", latePolicy: "Domkyrkans entré 13:00" },
    },
    {
      title: "Bokcirkel — sci-fi och fantasy",
      description: "Vi läser Ursula K. Le Guin. Ny grupp, alla välkomna.",
      location: "Café August, Västerås",
      latitude: 59.6105, longitude: 16.5455,
      ...unsplashUrls("bok"),
      creatorId: erik,
      startTime: futureDate(85, 19, 0),
      endTime: futureDate(85, 21, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Bokcirkel"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Sci-fi-fans", latePolicy: "Punkligt 19" },
    },
    {
      title: "Trädgårdsdag — skörd och förvaring",
      description: "Vi skördar säsongens grönsaker och lär oss konservera dem.",
      location: "Stadsodlingen Ekbacken, Västerås",
      latitude: 59.6280, longitude: 16.5550,
      ...unsplashUrls("trädgård"),
      creatorId: lisa,
      startTime: futureDate(87, 10, 0),
      endTime: futureDate(87, 14, 0),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Trädgård"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Trädgårdsintresserade", latePolicy: "Drop-in 10-12" },
    },
    {
      title: "Bara män — bastu och samtal",
      description: "Lugn bastukväll, fokus samtal. Bra format för killar i alla åldrar.",
      location: "Lögarängsbadet, Västerås",
      latitude: 59.6070, longitude: 16.5535,
      ...unsplashUrls("simning"),
      creatorId: omar,
      startTime: futureDate(89, 19, 0),
      endTime: futureDate(89, 21, 30),
      maxParticipants: 10,
      genderRestriction: "man" as const,
      minAge: 18,
      tags: ["Simning"],
      whatToExpect: { audience: "alla", experienceLevel: "alla", whoComes: "Män 18+", latePolicy: "Insläpp slutar 19:15", courageMessage: "Du behöver inte känna någon för att komma." },
    },
  ];

  const insertedActivities = [];
  for (const def of activityDefs) {
    const { tags: tagNames, ...activityData } = def;
    const [inserted] = await db
      .insert(schema.activities)
      .values(activityData)
      .returning();

    // Link tags
    const tagIds = tagNames
      .map((name) => tagMap.get(name))
      .filter((id): id is number => id !== undefined);

    if (tagIds.length > 0) {
      await db.insert(schema.activityTags).values(
        tagIds.map((tagId) => ({ activityId: inserted.id, tagId }))
      );
    }

    insertedActivities.push(inserted);
  }

  console.log(`  Inserted ${insertedActivities.length} activities.`);

  // ── 5. Participants ────────────────────────────────────────────────────

  console.log("Adding participants...");

  const allUsers = [anna, erik, sara, omar, lisa];

  // For each activity, add some participants (excluding the creator)
  const participantAssignments: { activityIndex: number; userIds: string[] }[] = [
    { activityIndex: 0, userIds: [erik, sara, omar, lisa] },          // Kvällspromenad
    { activityIndex: 1, userIds: [anna, sara, omar] },                // Brädspel
    { activityIndex: 2, userIds: [anna, erik, omar, lisa] },          // Matlagning
    { activityIndex: 3, userIds: [anna, erik, sara] },                // Fotopromenad
    { activityIndex: 4, userIds: [anna, sara, omar] },                // Yoga
    { activityIndex: 5, userIds: [omar, lisa, erik] },                // Fågelskådning
    { activityIndex: 6, userIds: [anna, sara, erik] },                // Bokcirkel
    { activityIndex: 7, userIds: [sara, omar, anna, lisa] },          // Kodkväll
    { activityIndex: 8, userIds: [anna, lisa] },                      // Keramik (kvinnor)
    { activityIndex: 9, userIds: [anna, erik, sara, lisa] },          // Löpgrupp
    { activityIndex: 10, userIds: [anna, erik, omar] },               // Vinprovning
    { activityIndex: 11, userIds: [lisa, sara, erik] },               // Stickcafé
    { activityIndex: 12, userIds: [anna, erik, lisa, sara] },         // Stadsvandring
    { activityIndex: 13, userIds: [anna, sara, omar, lisa] },         // Filmkväll
    { activityIndex: 14, userIds: [anna, omar, sara, erik] },         // Simning
    { activityIndex: 15, userIds: [anna, erik, omar, lisa] },         // Språk
    { activityIndex: 16, userIds: [erik, anna, lisa] },               // Styrketräning
    { activityIndex: 17, userIds: [omar] },                           // Bastukväll för män
  ];

  let participantCount = 0;
  for (const { activityIndex, userIds } of participantAssignments) {
    const activity = insertedActivities[activityIndex];
    if (!activity) continue;

    await db.insert(schema.activityParticipants).values(
      userIds.map((userId) => ({
        activityId: activity.id,
        userId,
        status: "attending" as const,
      }))
    );
    participantCount += userIds.length;
  }

  // Auto-tilldela deltagare för aktiviteterna utöver de explicit listade
  // ovan. Plockar 1-3 random demo-användare per aktivitet (exklusive
  // skaparen). Ger feeden en levande look utan att vi behöver hand-författa
  // 60 entries.
  const allDemoUsers = [anna, erik, sara, omar, lisa];
  const explicitlyAssigned = new Set(participantAssignments.map((a) => a.activityIndex));
  for (let i = 0; i < insertedActivities.length; i++) {
    if (explicitlyAssigned.has(i)) continue;
    const activity = insertedActivities[i];
    const others = allDemoUsers.filter((u) => u !== activity.creatorId);
    const count = 1 + Math.floor(Math.random() * 3); // 1-3
    const picks = others.sort(() => Math.random() - 0.5).slice(0, count);
    if (picks.length === 0) continue;
    await db.insert(schema.activityParticipants).values(
      picks.map((userId) => ({
        activityId: activity.id,
        userId,
        status: "attending" as const,
      })),
    );
    participantCount += picks.length;
  }

  console.log(`  Added ${participantCount} participants.`);

  // ── 6. Comments ────────────────────────────────────────────────────────

  console.log("Adding sample comments...");

  const comments = [
    { activityIndex: 0, userId: erik, content: "Låter jättebra! Hur långt går vi ungefär?" },
    { activityIndex: 0, userId: anna, content: "Ca 5 km i lugnt tempo, tar ungefär 1,5 timme." },
    { activityIndex: 1, userId: sara, content: "Har ni Catan? Det är min favorit!" },
    { activityIndex: 1, userId: erik, content: "Absolut, vi har Catan, Ticket to Ride och mycket mer!" },
    { activityIndex: 2, userId: omar, content: "Behöver man ta med egna ingredienser?" },
    { activityIndex: 2, userId: sara, content: "Nej, allt ingår! Bara kom hungrig." },
    { activityIndex: 4, userId: sara, content: "Kan man komma om man aldrig gjort yoga förut?" },
    { activityIndex: 4, userId: lisa, content: "Absolut! Det är anpassat för nybörjare." },
    { activityIndex: 7, userId: omar, content: "Vilken version av Python kör vi?" },
    { activityIndex: 7, userId: erik, content: "Python 3.12, se till att ha det installerat innan!" },
    { activityIndex: 13, userId: anna, content: "Jag röstar på Spirited Away och Prinsessan Mononoke!" },
    { activityIndex: 13, userId: lisa, content: "Min granne Totoro! Perfekt för alla åldrar." },
  ];

  for (const { activityIndex, userId, content } of comments) {
    const activity = insertedActivities[activityIndex];
    if (!activity) continue;

    await db.insert(schema.activityComments).values({
      activityId: activity.id,
      userId,
      content,
    });
  }

  console.log(`  Added ${comments.length} comments.`);

  // Courage messages now live in migrations (see 0001_seed_baseline_data.sql).
  // Demo seed intentionally doesn't touch them.

  // ── Done ───────────────────────────────────────────────────────────────

  console.log("\nSeed complete!");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
