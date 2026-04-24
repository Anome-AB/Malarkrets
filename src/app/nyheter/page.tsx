import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Nyheter · Mälarkrets",
  description: "Vad som är nytt i Mälarkrets — ändringar, fixar och tillägg.",
};

// Release-notes läses från public/release-notes.json vid build-tid.
// Manuellt kurerad tills vidare — se docs/RELEASE_NOTES.md (framtida) för
// rutinen. Strukturen är framtidssäker mot en eventuell LLM-driven
// auto-generering senare (fas 3 i planen).

type Section = {
  added?: string[];
  improved?: string[];
  fixed?: string[];
};

type Release = {
  version: string;
  date: string;
  title: string;
  summary?: string;
  sections: Section;
};

type ReleaseNotes = {
  releases: Release[];
};

function formatSwedishDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function loadReleases(): Release[] {
  const filePath = join(process.cwd(), "public", "release-notes.json");
  const raw = readFileSync(filePath, "utf8");
  const data: ReleaseNotes = JSON.parse(raw);
  return data.releases;
}

const SECTION_LABELS: Record<keyof Section, string> = {
  added: "Nytt",
  improved: "Förbättrat",
  fixed: "Fixat",
};

function SectionBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary mb-2">
        {label}
      </h3>
      <ul className="space-y-1.5 list-disc list-outside pl-5 marker:text-dimmed">
        {items.map((item, i) => (
          <li key={i} className="text-body">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function NyheterPage() {
  const releases = loadReleases();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-white">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <nav className="mb-6 text-sm">
            <Link href="/" className="text-white/80 hover:text-white">
              ← Tillbaka till startsidan
            </Link>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Nyheter</h1>
          <p className="text-white/85">
            Vad som hänt i Mälarkrets — nya funktioner, förbättringar och fixar.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {releases.length === 0 ? (
          <p className="text-secondary">Inga releases ännu.</p>
        ) : (
          releases.map((release) => (
            <Card key={release.version}>
              <header className="mb-4 flex items-baseline justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs uppercase tracking-wide text-dimmed">
                    {formatSwedishDate(release.date)}
                  </div>
                  <h2 className="text-xl font-semibold text-heading mt-1">
                    {release.title}
                  </h2>
                </div>
                <span className="text-xs text-dimmed font-mono">
                  v{release.version}
                </span>
              </header>

              {release.summary && (
                <p className="text-body mb-5">{release.summary}</p>
              )}

              <div className="space-y-5">
                {release.sections.added && release.sections.added.length > 0 && (
                  <SectionBlock
                    label={SECTION_LABELS.added}
                    items={release.sections.added}
                  />
                )}
                {release.sections.improved &&
                  release.sections.improved.length > 0 && (
                    <SectionBlock
                      label={SECTION_LABELS.improved}
                      items={release.sections.improved}
                    />
                  )}
                {release.sections.fixed && release.sections.fixed.length > 0 && (
                  <SectionBlock
                    label={SECTION_LABELS.fixed}
                    items={release.sections.fixed}
                  />
                )}
              </div>
            </Card>
          ))
        )}

        {/* Footer-länk till /feedback tillkommer när GreenLion bygger
            feedback-flödet (fas 2 i release-notes-planen). */}
      </main>
    </div>
  );
}
