"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "@/components/activity/activity-card";
import { ActivityPanel } from "@/components/activity/activity-panel";
import { FeedLink } from "@/components/layout/feed-link";

// Matchar feedens beteende: på desktop öppnar vi den glidande sidopanelen
// istället för att navigera till /activity/<id>. På mobil saknar vi yta för
// en split-vy så då navigerar vi som vanligt.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing till matchMedia (extern); ej tillgänglig under SSR.
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

interface WhatToExpect {
  okAlone?: boolean;
  experienceLevel?: string;
  whoComes?: string;
  latePolicy?: string;
  groupSize?: string;
}

interface Tag {
  id: number;
  name: string;
  slug: string;
}

interface Activity {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: Date | string;
  endTime?: Date | string | null;
  imageThumbUrl: string | null;
  imageAccentColor?: string | null;
  colorTheme?: string | null;
  genderRestriction?: "alla" | "kvinnor" | "man" | null;
  maxParticipants: number | null;
  whatToExpect: WhatToExpect | null;
  tags: Tag[];
  participantCount: number;
  attendingPreview?: Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
  }>;
  cancelledAt: Date | string | null;
  cancelledReason: string | null;
  publishedAt?: Date | string | null;
}

interface ParticipatingActivity extends Activity {
  status: "interested" | "attending";
}

interface MyActivitiesClientProps {
  createdActivities: Activity[];
  participatingActivities: ParticipatingActivity[];
}

export function MyActivitiesClient({
  createdActivities,
  participatingActivities,
}: MyActivitiesClientProps) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  const handleClick = useCallback(
    (id: string) => {
      if (isDesktop) {
        setSelectedActivityId(id);
      } else {
        router.push(`/activity/${id}`);
      }
    },
    [isDesktop, router],
  );

  const handlePanelClose = useCallback(() => {
    setSelectedActivityId(null);
  }, []);

  // Splitta arrangerade aktiviteter på utkast vs publicerade. Utkast har
  // publishedAt === null. Cancelled aktiviteter är publicerade och hör hemma
  // bland "Aktiviteter jag arrangerar" - de har redan en Inställd-badge.
  const drafts = createdActivities.filter((a) => !a.publishedAt);
  const published = createdActivities.filter((a) => a.publishedAt);

  function renderCreatedCard(activity: Activity) {
    // Utkast-badgen renderas inuti ActivityCard via isDraft-prop:en så att den
    // hamnar bredvid titeln (samma position som Arrangerar normalt). Inställd
    // är fortfarande en overlay-chip i topp-höger eftersom det är ett mer
    // alarmerande tillstånd som ska sticka ut.
    const isDraft = !activity.publishedAt;
    return (
      <div key={activity.id} className="relative">
        <ActivityCard
          activity={activity}
          isCreator
          isDraft={isDraft}
          onClick={handleClick}
          reserveTopActionSpace
        />
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          {activity.cancelledAt && (
            <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
              Inställd
            </span>
          )}
          {/* Kopiera-knapp finns på alla egna aktiviteter (inkl. avbokade
              och utkast). Borttagna visas inte i listan över huvud taget. */}
          <Link
            href={`/activity/new?from=${activity.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-white border border-primary rounded-lg hover:bg-primary-light transition-colors"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Kopiera ${activity.title} till ny aktivitet`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Kopiera
          </Link>
          {!activity.cancelledAt && (
            <Link
              href={`/activity/${activity.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-white border border-primary rounded-lg hover:bg-primary-light transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Redigera
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-bold text-heading mb-8">
        Mina aktiviteter
      </h1>

      {/* Section: Utkast - visas bara om det finns minst ett utkast. Ligger
          överst eftersom det är aktivt arbete som väntar på att publiceras. */}
      {drafts.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-bold text-heading mb-4">
            Utkast
          </h2>
          <div className="grid grid-cols-activity-list gap-5">
            {drafts.map(renderCreatedCard)}
          </div>
        </section>
      )}

      {/* Section: Activities I created (published). Empty state visas bara
          när användaren inte har några skapade alls - finns utkast räknas det
          som "har skapat aktiviteter" även om inget är publicerat ännu. */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-heading mb-4">
          Aktiviteter jag arrangerar
        </h2>
        {published.length === 0 ? (
          createdActivities.length === 0 ? (
            <Card className="text-center">
              <p className="text-secondary mb-3">
                Du har inte skapat några aktiviteter ännu.
              </p>
              <Link href="/activity/new">
                <Button>Skapa aktivitet</Button>
              </Link>
            </Card>
          ) : (
            <Card className="text-center">
              <p className="text-secondary">
                Inga publicerade aktiviteter ännu - se utkasten ovan.
              </p>
            </Card>
          )
        ) : (
          <div className="grid grid-cols-activity-list gap-5">
            {published.map(renderCreatedCard)}
          </div>
        )}
      </section>

      {/* Section 2: Activities I'm participating in */}
      <section>
        <h2 className="text-lg font-bold text-heading mb-4">
          Aktiviteter jag är anmäld till
        </h2>
        {participatingActivities.length === 0 ? (
          <Card className="text-center">
            <p className="text-secondary mb-3">
              Du har inte anmält dig till några aktiviteter.
            </p>
            <FeedLink>
              <Button>Utforska aktiviteter</Button>
            </FeedLink>
          </Card>
        ) : (
          <div className="grid grid-cols-activity-list gap-5">
            {participatingActivities.map((activity) => (
              <div key={activity.id} className="relative">
                <ActivityCard
                  activity={activity}
                  onClick={handleClick}
                />
                {activity.cancelledAt ? (
                  <span className="absolute top-3 right-3 inline-block text-xs font-semibold px-2.5 py-1 rounded-full z-10 bg-red-100 text-red-700">
                    Inställd
                  </span>
                ) : (
                  <span
                    className={`absolute top-3 right-3 inline-block text-xs font-semibold px-2.5 py-1 rounded-full z-10 ${
                      activity.status === "attending"
                        ? "bg-success-bg text-success-text"
                        : "bg-alert-bg text-alert-text"
                    }`}
                  >
                    {activity.status === "attending" ? "Kommer" : "Intresserad"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sliding panel (desktop only) - speglar feedens beteende så
          användaren får samma vy oavsett om de klickar från Utforska eller
          Mina aktiviteter. */}
      {selectedActivityId && (
        <ActivityPanel
          activityId={selectedActivityId}
          open={!!selectedActivityId}
          onClose={handlePanelClose}
        />
      )}
    </div>
  );
}
