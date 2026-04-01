import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import * as schema from "./schema";

// ─── Database connection ────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Provide it via .env.local or environment.");
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client, { schema });

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

/** Return a Date that is `daysFromNow` days in the future at the given hour:minute */
function futureDate(daysFromNow: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ─── Interest tags ──────────────────────────────────────────────────────────

const tagsByCategory: Record<string, string[]> = {
  "Utomhus": ["Vandring", "Löpning", "Cykling", "Fågelskådning", "Trädgård", "Fiske", "Paddling", "Klättring"],
  "Kreativt": ["Fotografi", "Målning", "Keramik", "Stickning", "Matlagning", "Bakning", "Musik", "Skrivande"],
  "Spel & hobby": ["Brädspel", "Rollspel", "Schack", "E-sport", "Modellbygge"],
  "Motion & hälsa": ["Yoga", "Simning", "Dans", "Kampsport", "Styrketräning"],
  "Socialt": ["Bokcirkel", "Filmkväll", "Vinprovning", "Språkcafé", "Kodning", "Frivilligarbete"],
  "Kultur": ["Teater", "Konst", "Historia", "Musik (lyssning)"],
};

// ─── Seed logic ─────────────────────────────────────────────────────────────

async function seed() {
  console.log("Checking if database is already seeded...");

  const existingTags = await db.select().from(schema.interestTags).limit(1);
  if (existingTags.length > 0) {
    console.log("Database already has interest tags — skipping seed.");
    await client.end();
    return;
  }

  console.log("Seeding interest tags...");

  // ── 1. Interest tags ────────────────────────────────────────────────────

  const allTagRows: { name: string; slug: string; category: string }[] = [];
  for (const [category, names] of Object.entries(tagsByCategory)) {
    for (const name of names) {
      allTagRows.push({ name, slug: slugify(name), category });
    }
  }

  const insertedTags = await db
    .insert(schema.interestTags)
    .values(allTagRows)
    .returning();

  const tagMap = new Map(insertedTags.map((t) => [t.name, t.id]));
  console.log(`  Inserted ${insertedTags.length} interest tags.`);

  // ── 2. Demo users ──────────────────────────────────────────────────────

  console.log("Seeding demo users...");

  const passwordHash = await hash("testlosen123", 12);

  const userDefs = [
    { email: "anna@example.com", displayName: "Anna Karlsson", gender: "kvinna" as const, birthDate: "1985-04-12" },
    { email: "erik@example.com", displayName: "Erik Persson", gender: "man" as const, birthDate: "1990-08-23" },
    { email: "sara@example.com", displayName: "Sara Lindqvist", gender: "kvinna" as const, birthDate: "1998-01-07" },
    { email: "omar@example.com", displayName: "Omar Hassan", gender: "man" as const, birthDate: "1988-11-30" },
    { email: "lisa@example.com", displayName: "Lisa Johansson", gender: "kvinna" as const, birthDate: "1975-06-18" },
  ];

  const insertedUsers = await db
    .insert(schema.users)
    .values(
      userDefs.map((u) => ({
        ...u,
        passwordHash,
        emailVerified: true,
        municipalityId: "vasteras",
      }))
    )
    .returning();

  const userMap = new Map(insertedUsers.map((u) => [u.email, u.id]));
  const anna = userMap.get("anna@example.com")!;
  const erik = userMap.get("erik@example.com")!;
  const sara = userMap.get("sara@example.com")!;
  const omar = userMap.get("omar@example.com")!;
  const lisa = userMap.get("lisa@example.com")!;

  console.log(`  Inserted ${insertedUsers.length} demo users.`);

  // ── 2b. Test users ────────────────────────────────────────────────────

  console.log("Seeding test users...");

  const testPasswordHash = await hash("testm", 12);

  const testUserDefs = [
    { email: "testanv1@malarkrets.se", displayName: "Test Användare 1", gender: "ej_angett" as const, birthDate: null, isAdmin: false },
    { email: "testanv2@malarkrets.se", displayName: "Test Användare 2", gender: "man" as const, birthDate: "1990-01-15", isAdmin: false },
    { email: "testanv3@malarkrets.se", displayName: "Test Användare 3", gender: "kvinna" as const, birthDate: "1995-06-20", isAdmin: false },
    { email: "testadmin1@malarkrets.se", displayName: "Test Admin", gender: "ej_angett" as const, birthDate: null, isAdmin: true },
  ];

  const insertedTestUsers = await db
    .insert(schema.users)
    .values(
      testUserDefs.map((u) => ({
        ...u,
        passwordHash: testPasswordHash,
        emailVerified: true,
        municipalityId: "vasteras",
      }))
    )
    .returning();

  const testUserMap = new Map(insertedTestUsers.map((u) => [u.email, u.id]));
  console.log(`  Inserted ${insertedTestUsers.length} test users.`);

  // Assign random interests to test users
  const allTagNames = insertedTags.map((t) => t.name);
  function pickRandom<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  const testInterestRows: { userId: string; tagId: number }[] = [];
  for (const testUser of insertedTestUsers) {
    const randomTags = pickRandom(allTagNames, 3 + Math.floor(Math.random() * 3)); // 3-5
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
    [anna]: ["Vandring", "Fågelskådning", "Stickning", "Fotografi", "Yoga", "Bokcirkel"],
    [erik]: ["Brädspel", "Kodning", "E-sport", "Filmkväll", "Cykling", "Löpning", "Rollspel"],
    [sara]: ["Matlagning", "Keramik", "Dans", "Fotografi", "Yoga", "Bakning"],
    [omar]: ["Fotografi", "Vandring", "Löpning", "Historia", "Kodning", "Styrketräning", "Schack"],
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

  // ── 4. Activities ──────────────────────────────────────────────────────

  console.log("Seeding activities...");

  const activityDefs = [
    {
      title: "Kvällspromenad runt Mälaren",
      description: "En härlig kvällspromenad längs Mälarens strandlinje. Vi går i lugnt tempo och njuter av naturen och solnedgången. Alla nivåer välkomna!",
      location: "Östra hamnen, Västerås",
      creatorId: anna,
      startTime: futureDate(3, 18, 0),
      endTime: futureDate(3, 19, 30),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Vandring"],
      whatToExpect: { okAlone: true, experienceLevel: "alla", whoComes: "Blandad grupp, alla åldrar", latePolicy: "Kom i tid, vi väntar inte efter start" },
    },
    {
      title: "Brädspelskväll på Stadsbiblioteket",
      description: "Drop-in brädspelskväll! Vi har med oss klassiker och nya spel. Perfekt för nybörjare och veteraner. Fika finns att köpa.",
      location: "Stadsbiblioteket, Västerås",
      creatorId: erik,
      startTime: futureDate(4, 17, 30),
      endTime: futureDate(4, 21, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Brädspel"],
      whatToExpect: { okAlone: true, experienceLevel: "alla", whoComes: "Mest 20-40 år, alla välkomna", latePolicy: "Kom när du kan, vi kör hela kvällen" },
    },
    {
      title: "Nybörjarmatlagning — Indiskt",
      description: "Lär dig laga autentisk indisk mat från grunden. Vi gör tikka masala, naan och raita. Alla ingredienser ingår.",
      location: "Folkets Hus, Västerås",
      creatorId: sara,
      startTime: futureDate(8, 14, 0),
      endTime: futureDate(8, 17, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Matlagning"],
      whatToExpect: { okAlone: true, experienceLevel: "nybörjare", whoComes: "Matintresserade i alla åldrar", latePolicy: "Kom i tid, vi börjar laga direkt" },
    },
    {
      title: "Fotopromenad i gamla stan",
      description: "Vi utforskar Västerås gamla stadskärna med kameran. Tips om komposition och ljus under promenaden. Alla kameror/mobiler välkomna.",
      location: "Svartån/Kyrkbacken, Västerås",
      creatorId: omar,
      startTime: futureDate(6, 10, 0),
      endTime: futureDate(6, 12, 30),
      maxParticipants: 15,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Fotografi", "Vandring"],
      whatToExpect: { okAlone: true, experienceLevel: "alla", whoComes: "Fotoentusiaster, blandade åldrar", latePolicy: "Vi samlas vid Svartån kl 10 sharp" },
    },
    {
      title: "Yoga i parken för nybörjare",
      description: "Lugn morgonyoga utomhus i Vasaparken. Jag guidar genom grundläggande positioner. Ta med egen matta och vattenflaska.",
      location: "Vasaparken, Västerås",
      creatorId: lisa,
      startTime: futureDate(2, 7, 30),
      endTime: futureDate(2, 8, 30),
      maxParticipants: 20,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Yoga"],
      whatToExpect: { okAlone: true, experienceLevel: "nybörjare", whoComes: "Mest kvinnor 25-50, men alla välkomna", latePolicy: "Kom 5 min innan start" },
    },
    {
      title: "Fågelskådning vid Asköviken",
      description: "Tidig morgonvandring vid Asköviken naturreservat. Vi spanar efter vårfåglar och diskuterar artbestämning. Kikare finns att låna.",
      location: "Asköviken naturreservat, Västerås",
      creatorId: anna,
      startTime: futureDate(9, 8, 0),
      endTime: futureDate(9, 11, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Fågelskådning"],
      whatToExpect: { okAlone: true, experienceLevel: "alla", whoComes: "Naturintresserade, blandade åldrar", latePolicy: "Samling vid parkeringen kl 08:00" },
    },
    {
      title: "Bokcirkel: Svensk deckare",
      description: "Vi läser och diskuterar en ny svensk deckare varje månad. Denna gång: valfri titel av Camilla Läckberg. Mysig stämning med fika.",
      location: "Café August, Västerås",
      creatorId: lisa,
      startTime: futureDate(5, 19, 0),
      endTime: futureDate(5, 21, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Bokcirkel"],
      whatToExpect: { okAlone: true, experienceLevel: "alla", whoComes: "Bokälskare, mest 30-60 år", latePolicy: "Kom gärna i tid så vi hinner fika först" },
    },
    {
      title: "Kodkväll för nybörjare",
      description: "Lär dig programmera från scratch! Vi börjar med Python och bygger enkla projekt tillsammans. Egen laptop krävs.",
      location: "Stadsbiblioteket, Västerås",
      creatorId: erik,
      startTime: futureDate(7, 18, 0),
      endTime: futureDate(7, 20, 30),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Kodning"],
      whatToExpect: { okAlone: true, experienceLevel: "nybörjare", whoComes: "Teknikintresserade, alla åldrar", latePolicy: "Kom i tid, vi börjar med intro kl 18" },
    },
    {
      title: "Keramikworkshop",
      description: "Prova på keramik och dreja din egen skål. Material ingår. Begränsat antal platser — passa på!",
      location: "Kulturhuset, Västerås",
      creatorId: sara,
      startTime: futureDate(10, 13, 0),
      endTime: futureDate(10, 16, 0),
      maxParticipants: 6,
      genderRestriction: "kvinnor" as const,
      minAge: 18,
      tags: ["Keramik"],
      whatToExpect: { okAlone: true, experienceLevel: "nybörjare", whoComes: "Kreativa kvinnor 18+", latePolicy: "Måste vara på plats vid start" },
    },
    {
      title: "Löpgrupp — 5 km",
      description: "Gemensam löprunda på ca 5 km i lagom tempo. Vi springer längs Mälaren och tillbaka. Alla hastigheter välkomna!",
      location: "Lögarängen, Västerås",
      creatorId: omar,
      startTime: futureDate(3, 6, 30),
      endTime: futureDate(3, 7, 30),
      maxParticipants: 20,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Löpning"],
      whatToExpect: { okAlone: true, experienceLevel: "alla", whoComes: "Motionärer, blandade nivåer", latePolicy: "Vi startar exakt kl 06:30" },
    },
    {
      title: "Vinprovning med tema Italien",
      description: "Smaka sex utvalda italienska viner med tilltugg. Vi pratar druvor, regioner och matpairing. Avslappnad stämning.",
      location: "Restaurang Bia, Västerås",
      creatorId: lisa,
      startTime: futureDate(11, 19, 0),
      endTime: futureDate(11, 21, 30),
      maxParticipants: 12,
      genderRestriction: "alla" as const,
      minAge: 25,
      tags: ["Vinprovning"],
      whatToExpect: { okAlone: true, experienceLevel: "alla", whoComes: "Vinintresserade 25+", latePolicy: "Kom i tid, vi börjar punklitgt kl 19" },
    },
    {
      title: "Stickcafé på Ica Maxi",
      description: "Ta med ditt stickprojekt och häng med oss i caféet. Nybörjare får gärna hjälp att komma igång. Garn och stickor finns att köpa på plats.",
      location: "Ica Maxi Erikslund, Västerås",
      creatorId: anna,
      startTime: futureDate(2, 14, 0),
      endTime: futureDate(2, 16, 0),
      maxParticipants: 10,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Stickning"],
      whatToExpect: { okAlone: true, experienceLevel: "alla", whoComes: "Mest kvinnor men alla välkomna", latePolicy: "Drop-in, kom och gå som du vill" },
    },
    {
      title: "Historisk stadsvandring",
      description: "Guidad promenad genom Västerås historia — från vikingatid till modern industri. Vi besöker domkyrkan, Anundshög-utställningen och mer.",
      location: "Domkyrkan, Västerås",
      creatorId: omar,
      startTime: futureDate(13, 11, 0),
      endTime: futureDate(13, 13, 0),
      maxParticipants: 15,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Historia", "Vandring"],
      whatToExpect: { okAlone: true, experienceLevel: "alla", whoComes: "Historieintresserade, alla åldrar", latePolicy: "Samling vid domkyrkans entré kl 11" },
    },
    {
      title: "Filmkväll: Studio Ghibli-maraton",
      description: "Vi ser två Studio Ghibli-filmer på storbild! Popcorn och snacks ingår. Rösta på vilka filmer vi ser i kommentarerna.",
      location: "Folkets Hus, Västerås",
      creatorId: erik,
      startTime: futureDate(8, 17, 0),
      endTime: futureDate(8, 22, 0),
      maxParticipants: 8,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Filmkväll"],
      whatToExpect: { okAlone: true, experienceLevel: "alla", whoComes: "Animefans och filmälskare", latePolicy: "Kom gärna 15 min innan för bästa plats" },
    },
    {
      title: "Simning — morgonpass",
      description: "Gemensamt morgonpass i 50-metersbassängen. Vi simmar i eget tempo men peppar varandra. Alla nivåer välkomna.",
      location: "Lögarängsbadet, Västerås",
      creatorId: lisa,
      startTime: futureDate(4, 7, 0),
      endTime: futureDate(4, 8, 0),
      maxParticipants: 15,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Simning"],
      whatToExpect: { okAlone: true, experienceLevel: "alla", whoComes: "Simmare i alla åldrar och nivåer", latePolicy: "Var ombytt och redo kl 07:00" },
    },
    {
      title: "Språkcafé — Svenska/Engelska",
      description: "Öva svenska eller engelska i avslappnad miljö. Vi byter språk varannan halvtimme. Fika ingår!",
      location: "Café Stationen, Västerås",
      creatorId: sara,
      startTime: futureDate(5, 16, 0),
      endTime: futureDate(5, 18, 0),
      maxParticipants: 16,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Språkcafé"],
      whatToExpect: { okAlone: true, experienceLevel: "alla", whoComes: "Språkintresserade, internationell mix", latePolicy: "Drop-in, kom när du kan" },
    },
    {
      title: "Styrketräning utomhus",
      description: "Funktionell styrketräning i Djäknebergets utegym. Jag leder ett 45-minuterspass med kroppsviktsövningar. Inga redskap behövs.",
      location: "Djäkneberget, Västerås",
      creatorId: omar,
      startTime: futureDate(7, 7, 0),
      endTime: futureDate(7, 7, 45),
      maxParticipants: 15,
      genderRestriction: "alla" as const,
      minAge: null,
      tags: ["Styrketräning"],
      whatToExpect: { okAlone: true, experienceLevel: "medel", whoComes: "Träningsintresserade 20-45 år", latePolicy: "Kom uppvärmningsklar kl 07:00" },
    },
  ];

  const insertedActivities = [];
  for (const def of activityDefs) {
    const { tags: tagNames, ...activityData } = def;
    const [inserted] = await db
      .insert(schema.activities)
      .values({
        ...activityData,
        municipalityId: "vasteras",
      })
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
    { activityIndex: 15, userIds: [anna, erik, omar, lisa] },         // Språkcafé
    { activityIndex: 16, userIds: [erik, anna, lisa] },               // Styrketräning
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

  // ── Done ───────────────────────────────────────────────────────────────

  console.log("\nSeed complete!");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
