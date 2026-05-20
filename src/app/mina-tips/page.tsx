import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getMyTips, type MyTip } from "@/actions/feedback-tips";

export const metadata = {
  title: "Mina tips - Mälarkrets",
};

interface StatusDisplay {
  label: string;
  dot: string;
  description: string;
}

const STATUS_DISPLAY: Record<MyTip["status"], StatusDisplay> = {
  open: {
    label: "Inkommit",
    dot: "bg-border",
    description: "Vi har fått ditt tips och tittar på det snart.",
  },
  triaged: {
    label: "Vi har sett det",
    dot: "bg-accent",
    description: "Vi har läst tipset och tänker över det.",
  },
  in_progress: {
    label: "På gång",
    dot: "bg-primary",
    description: "Någon jobbar på det här just nu.",
  },
  done: {
    label: "Klart",
    dot: "bg-primary",
    description: "Det här är fixat och med i en kommande release.",
  },
  wont_fix: {
    label: "Vi tar inte det här",
    dot: "bg-secondary",
    description: "Vi har valt att inte gå vidare med det här just nu.",
  },
  duplicate: {
    label: "Samma som ett annat tips",
    dot: "bg-secondary",
    description: "Vi har samlat ihop det här med ett liknande tips.",
  },
};

function formatRelative(date: Date): string {
  const d = new Date(date);
  const now = Date.now();
  const diffMin = Math.floor((now - d.getTime()) / 60000);
  if (diffMin < 1) return "alldeles nyss";
  if (diffMin < 60) return `${diffMin} min sedan`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h sedan`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD} dagar sedan`;
  return d.toLocaleDateString("sv-SE");
}

export default async function MinaTipsPage() {
  const tips = await getMyTips();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-heading">
            Mina tips
          </h1>
          <p className="text-secondary mt-1">
            Här ser du tipsen du skickat in och vad som händer med dem.
          </p>
        </div>
        <Link
          href="/tipsa"
          className="inline-flex items-center justify-center min-h-touch-target rounded-control px-5 py-2.5 text-sm font-medium bg-primary text-white hover:bg-primary-hover transition-colors whitespace-nowrap"
        >
          Skicka ett nytt tips
        </Link>
      </div>

      {tips.length === 0 ? (
        <Card>
          <div className="text-center py-8 space-y-3">
            <div className="text-4xl" aria-hidden="true">📭</div>
            <p className="text-secondary">
              Du har inte skickat något tips än.
            </p>
          </div>
        </Card>
      ) : (
        <ul className="space-y-4">
          {tips.map((tip) => {
            const status = STATUS_DISPLAY[tip.status];
            const hasActivity =
              tip.lastActivityAt.getTime() - tip.createdAt.getTime() > 1000;
            return (
              <li key={tip.id}>
                <Link
                  href={`/mina-tips/${tip.id}`}
                  className={`block rounded-card bg-white border p-6 hover:shadow-md transition-all ${
                    tip.hasUnread
                      ? "border-accent shadow-sm hover:border-accent"
                      : "border-border hover:border-primary"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-heading">
                        <span aria-hidden="true">
                          {tip.kind === "bug"
                            ? "🐞"
                            : tip.kind === "idea"
                              ? "💡"
                              : "🏷️"}
                        </span>
                        <span>
                          {tip.kind === "bug"
                            ? "Bugg"
                            : tip.kind === "idea"
                              ? "Förslag"
                              : "Intresseförslag"}
                        </span>
                        {tip.commentCount > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-secondary">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                            {tip.commentCount} svar
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {tip.hasUnread && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-white text-xs font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden="true" />
                            Nytt
                          </span>
                        )}
                        <span className="text-xs text-secondary font-mono">
                          {formatRelative(tip.lastActivityAt)}
                        </span>
                      </div>
                    </div>

                    <p className="text-heading whitespace-pre-wrap line-clamp-3">
                      {tip.description ||
                        (tip.kind === "interest"
                          ? "Förslag på nya intressen. Klicka för att se vilka."
                          : "")}
                    </p>

                    <div className="flex items-center gap-2 pt-2 border-t border-border-light">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${status.dot}`}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium text-heading">
                        {status.label}
                      </span>
                      <span className="text-sm text-secondary">
                        · {status.description}
                      </span>
                    </div>

                    {hasActivity && (
                      <p className="text-xs text-primary font-medium">
                        Senaste aktivitet {formatRelative(tip.lastActivityAt)} →
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
