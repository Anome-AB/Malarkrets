"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "@/components/activity/activity-card";

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
  imageThumbUrl: string | null;
  colorTheme?: string | null;
  maxParticipants: number | null;
  whatToExpect: WhatToExpect | null;
  tags: Tag[];
  participantCount: number;
  cancelledAt: Date | string | null;
  cancelledReason: string | null;
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

  const handleClick = (id: string) => {
    router.push(`/activity/${id}`);
  };

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-bold text-heading mb-8">
        Mina aktiviteter
      </h1>

      {/* Section 1: Activities I created */}
      <section className="mb-10">
        <h2 className="text-lg font-bold text-heading mb-4">
          Aktiviteter jag arrangerar
        </h2>
        {createdActivities.length === 0 ? (
          <Card className="text-center">
            <p className="text-secondary mb-3">
              Du har inte skapat några aktiviteter ännu.
            </p>
            <Link href="/activity/new">
              <Button>Skapa aktivitet</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-activity-feed gap-5">
            {createdActivities.map((activity) => (
              <div key={activity.id} className="relative">
                <ActivityCard
                  activity={activity}
                  isCreator={true}
                  onClick={handleClick}
                />
                {activity.cancelledAt ? (
                  <span className="absolute top-3 right-3 inline-block text-xs font-semibold px-2.5 py-1 rounded-full z-10 bg-red-100 text-red-700">
                    Inställd
                  </span>
                ) : (
                  <Link
                    href={`/activity/${activity.id}/edit`}
                    className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-white border border-primary rounded-lg hover:bg-primary-light transition-colors z-10"
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
            ))}
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
            <Link href="/">
              <Button>Utforska aktiviteter</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-activity-feed gap-5">
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
    </div>
  );
}
