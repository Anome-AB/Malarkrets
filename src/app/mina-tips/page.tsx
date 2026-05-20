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
    description: "Vi har läst tipset och planerar in det.",
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
            <Link
              href="/tipsa"
              className="inline-flex items-center justify-center min-h-touch-target rounded-control px-5 py-2.5 text-sm font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
            >
              Skicka ditt första tips
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {tips.map((tip) => {
            const status = STATUS_DISPLAY[tip.status];
            return (
              <Card key={tip.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-heading">
                      <span aria-hidden="true">
                        {tip.kind === "bug" ? "🐞" : "💡"}
                      </span>
                      <span>{tip.kind === "bug" ? "Bugg" : "Idé"}</span>
                    </div>
                    <span className="text-xs text-secondary font-mono">
                      {formatRelative(tip.createdAt)}
                    </span>
                  </div>

                  <p className="text-heading whitespace-pre-wrap">
                    {tip.description}
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

                  {tip.adminNotes && (
                    <div className="rounded-control bg-primary-light px-4 py-3 text-sm text-heading">
                      <span className="font-semibold">Svar från oss:</span>{" "}
                      {tip.adminNotes}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
