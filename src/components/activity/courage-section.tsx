interface WhatToExpect {
  okAlone?: boolean;
  experienceLevel?: string;
  whoComes?: string;
  latePolicy?: string;
  groupSize?: string;
}

interface CourageSectionProps {
  whatToExpect: WhatToExpect;
}

const rows: { key: keyof WhatToExpect; label: string }[] = [
  { key: "okAlone", label: "Okej att komma ensam?" },
  { key: "experienceLevel", label: "Erfarenhetsnivå" },
  { key: "whoComes", label: "Vilka brukar komma?" },
  { key: "latePolicy", label: "Om jag är sen?" },
  { key: "groupSize", label: "Gruppstorlek" },
];

function formatValue(key: keyof WhatToExpect, value: unknown): string {
  if (key === "okAlone") {
    return value ? "Ja, absolut!" : "Bäst att komma med någon";
  }
  return String(value ?? "–");
}

export function CourageSection({ whatToExpect }: CourageSectionProps) {
  return (
    <section aria-labelledby="courage-heading">
      <h3
        id="courage-heading"
        className="text-base font-semibold text-[#2d2d2d] mb-3"
      >
        Vad kan jag förvänta mig?
      </h3>
      <dl className="bg-[#faf8f2] border border-[#e5dcc8] rounded-lg p-4 space-y-3">
        {rows.map((row) => {
          const value = whatToExpect[row.key];
          if (value == null) return null;
          return (
            <div key={row.key} className="flex flex-col sm:flex-row sm:gap-2">
              <dt className="text-sm text-[#888888]">{row.label}</dt>
              <dd className="text-sm text-[#2d2d2d] font-medium">
                {formatValue(row.key, value)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
