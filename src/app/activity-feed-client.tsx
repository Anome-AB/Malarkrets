"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ActivityCard } from "@/components/activity/activity-card";
import { ActivityPanel } from "@/components/activity/activity-panel";
import { Tag } from "@/components/ui/tag";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface WhatToExpect {
  okAlone?: boolean;
  experienceLevel?: string;
  whoComes?: string;
  latePolicy?: string;
}

interface ActivityItem {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: Date | string;
  imageThumbUrl: string | null;
  colorTheme?: string | null;
  maxParticipants: number | null;
  whatToExpect: unknown;
  tags: Array<{ id: number; name: string; slug: string }>;
  participantCount: number;
  creatorId: string | null;
  userStatus?: "interested" | "attending" | null;
}

interface Interest {
  id: number;
  name: string;
  slug: string;
}

interface ActivityFeedProps {
  initialActivities: ActivityItem[];
  userInterests: Interest[];
  activeFilters: string[];
  nextCursor: string | null;
  userId?: string;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export function ActivityFeed({
  initialActivities,
  userInterests,
  activeFilters,
  nextCursor,
  userId,
}: ActivityFeedProps) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [searchText, setSearchText] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(activeFilters.length > 0);

  const filteredActivities = useMemo(() => {
    if (!searchText.trim()) return initialActivities;
    const q = searchText.toLowerCase();
    return initialActivities.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q),
    );
  }, [initialActivities, searchText]);

  function handleCardClick(id: string) {
    if (isDesktop) {
      setSelectedActivityId(id);
    } else {
      router.push(`/activity/${id}`);
    }
  }

  const handlePanelClose = useCallback(() => {
    setSelectedActivityId(null);
  }, []);

  function handleFilterClick(slug: string) {
    const isActive = activeFilters.includes(slug);
    const nextFilters = isActive
      ? activeFilters.filter((s) => s !== slug)
      : [...activeFilters, slug];
    if (nextFilters.length > 0) {
      router.push(`/?intresse=${nextFilters.join(",")}`);
    } else {
      router.push("/");
    }
  }

  function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    const params = new URLSearchParams();
    if (activeFilters.length > 0) params.set("intresse", activeFilters.join(","));
    params.set("cursor", nextCursor);
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="p-4 lg:p-6">
      <h1 className="text-2xl font-bold text-heading mb-4">Aktiviteter i Västerås</h1>

      {/* Interest filter bar (mobile only, sidebar handles desktop) */}
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-heading py-2"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filtrera
          {activeFilters.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-white text-xs font-semibold">
              {activeFilters.length}
            </span>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${filtersExpanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {filtersExpanded && (
          <div className="flex flex-wrap gap-2 mt-2">
            {userInterests.map((interest) => (
              <Tag
                key={interest.id}
                label={interest.name}
                active={activeFilters.includes(interest.slug)}
                onClick={() => handleFilterClick(interest.slug)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Search + Create */}
      <div className="flex gap-3 items-center mb-6">
      <div className="flex-1 max-w-md relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-dimmed pointer-events-none"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <Input
          type="search"
          placeholder="Sök aktiviteter..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="pl-10"
        />
      </div>
        <Link href="/activity/new">
          <Button size="sm">Skapa aktivitet</Button>
        </Link>
      </div>

      {/* Activity grid */}
      {filteredActivities.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-secondary text-lg">
            Inga aktiviteter hittades.
          </p>
          <p className="text-dimmed text-sm mt-1">
            Prova att ändra filter eller sök efter något annat.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(400px,1fr))] gap-5">
            {filteredActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={{
                  id: activity.id,
                  title: activity.title,
                  description: activity.description,
                  location: activity.location,
                  startTime: activity.startTime,
                  tags: activity.tags,
                  participantCount: activity.participantCount,
                  maxParticipants: activity.maxParticipants,
                  whatToExpect: activity.whatToExpect as WhatToExpect | null,
                  imageThumbUrl: activity.imageThumbUrl,
                  colorTheme: activity.colorTheme,
                }}
                isCreator={!!userId && activity.creatorId === userId}
                userStatus={activity.userStatus}
                onClick={handleCardClick}
              />
            ))}
          </div>

          {nextCursor && !searchText.trim() && (
            <div className="flex justify-center mt-8">
              <Button
                variant="secondary"
                loading={loadingMore}
                onClick={handleLoadMore}
              >
                Ladda mer
              </Button>
            </div>
          )}
        </>
      )}

      {/* Sliding panel (desktop only) */}
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
