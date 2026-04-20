interface WhatToExpect {
  okAlone?: boolean;
  audience?: string | string[];
  experienceLevel?: string;
  whoComes?: string;
  latePolicy?: string;
  groupSize?: string;
  courageMessage?: string;
}

interface CourageSectionProps {
  whatToExpect: WhatToExpect;
}

const AUDIENCE_LABELS: Record<string, string> = {
  alla: "Alla",
  par: "Par",
  familj: "Familjer",
  // Legacy values from the old multi-select
  alone: "Alla",
  with_friend: "Alla",
  family: "Familjer",
  pair: "Par",
};

function getAudienceLabel(wte: WhatToExpect): string | null {
  if (typeof wte.audience === "string" && wte.audience) {
    return AUDIENCE_LABELS[wte.audience] ?? null;
  }
  if (Array.isArray(wte.audience) && wte.audience.length > 0) {
    // Legacy: take first matching label
    return AUDIENCE_LABELS[wte.audience[0]] ?? null;
  }
  // Backwards compat with very old okAlone boolean
  if (wte.okAlone === true || wte.okAlone === false) return "Alla";
  return null;
}

export function CourageSection({ whatToExpect }: CourageSectionProps) {
  const audienceLabel = getAudienceLabel(whatToExpect);

  return (
    <section aria-labelledby="courage-heading">
      <h3
        id="courage-heading"
        className="text-base font-semibold text-heading mb-3"
      >
        Vad kan jag förvänta mig?
      </h3>
      {whatToExpect.courageMessage && (
        <p className="flex items-start gap-2 bg-courage-bg border border-courage-border rounded-lg p-4 mb-3 text-sm text-heading italic">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mt-0.5 text-primary"
            role="img"
            aria-label="Välkomstmeddelande från arrangören"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {whatToExpect.courageMessage}
        </p>
      )}
      <dl className="bg-courage-bg border border-courage-border rounded-lg p-4 space-y-3">
        {audienceLabel && (
          <div className="flex flex-col sm:flex-row sm:gap-2">
            <dt className="text-sm text-dimmed">Passar för</dt>
            <dd className="text-sm text-heading font-medium">{audienceLabel}</dd>
          </div>
        )}
        {whatToExpect.experienceLevel && (
          <div className="flex flex-col sm:flex-row sm:gap-2">
            <dt className="text-sm text-dimmed">Erfarenhetsnivå</dt>
            <dd className="text-sm text-heading font-medium">{whatToExpect.experienceLevel}</dd>
          </div>
        )}
        {whatToExpect.whoComes && (
          <div className="flex flex-col sm:flex-row sm:gap-2">
            <dt className="text-sm text-dimmed">Vilka brukar komma?</dt>
            <dd className="text-sm text-heading font-medium">{whatToExpect.whoComes}</dd>
          </div>
        )}
        {whatToExpect.latePolicy && (
          <div className="flex flex-col sm:flex-row sm:gap-2">
            <dt className="text-sm text-dimmed">Om jag är sen?</dt>
            <dd className="text-sm text-heading font-medium">{whatToExpect.latePolicy}</dd>
          </div>
        )}
        {whatToExpect.groupSize && (
          <div className="flex flex-col sm:flex-row sm:gap-2">
            <dt className="text-sm text-dimmed">Gruppstorlek</dt>
            <dd className="text-sm text-heading font-medium">{whatToExpect.groupSize}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
