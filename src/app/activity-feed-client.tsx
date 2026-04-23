"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ActivityCard } from "@/components/activity/activity-card";
import { ActivityPanel } from "@/components/activity/activity-panel";
import { Tag } from "@/components/ui/tag";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loadMoreFeed } from "@/actions/feed";
import { saveFeedFilter } from "@/components/layout/feed-link";

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
  endTime?: Date | string | null;
  imageThumbUrl: string | null;
  imageAccentColor?: string | null;
  colorTheme?: string | null;
  genderRestriction?: "alla" | "kvinnor" | "man" | null;
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
  initialHasMore: boolean;
  userId?: string;
  showAll?: boolean;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to an external system (matchMedia); the window object is not available during SSR so this cannot be derived during render.
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
  initialHasMore,
  userId,
  showAll = false,
}: ActivityFeedProps) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<ActivityItem[]>(initialActivities);
  const [offset, setOffset] = useState<number>(initialActivities.length);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(activeFilters.length > 0 || showAll);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset pagination state when the server-rendered first page changes
  // (filter toggle, "Visa alla" toggle, route navigation). Without this
  // the appended batches from a previous filter would bleed into the new
  // view.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to an external source (server-provided initial page). The initial render already uses useState initializers with the same values, but subsequent prop changes (filter/route) must force a state reset.
    setItems(initialActivities);
    setOffset(initialActivities.length);
    setHasMore(initialHasMore);
    setLoadError(null);
  }, [initialActivities, initialHasMore]);

  // Persist the user's current feed filter so "Utforska" + logo-links
  // restore it on return, rather than snapping back to "Mina intressen".
  useEffect(() => {
    const qs = new URLSearchParams();
    if (showAll) qs.set("alla", "1");
    if (activeFilters.length > 0) qs.set("intresse", activeFilters.join(","));
    saveFeedFilter(qs.toString());
  }, [showAll, activeFilters]);

  const filteredActivities = useMemo(() => {
    if (!searchText.trim()) return items;
    const q = searchText.toLowerCase();
    return items.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q),
    );
  }, [items, searchText]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const result = await loadMoreFeed({
        offset,
        intresse: activeFilters,
        alla: showAll,
      });
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setItems((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        const fresh = result.activities.filter((a) => !seen.has(a.id));
        return [...prev, ...fresh];
      });
      setOffset((prev) => prev + result.activities.length);
      setHasMore(result.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, offset, activeFilters, showAll]);

  // Auto-fetch next page when the sentinel scrolls into view. rootMargin
  // 200px triggers slightly before the sentinel is fully visible so the
  // user rarely hits an empty bottom. Pauses while the user has an active
  // search filter (search is client-side over loaded items; fetching more
  // behind the scenes would still be a waste here).
  useEffect(() => {
    if (!sentinelRef.current) return;
    if (!hasMore) return;
    if (searchText.trim()) return;

    const target = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, searchText, loadMore]);

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
            <span className="inline-flex items-center justify-center min-w-pill h-5 px-1.5 rounded-full bg-primary text-white text-xs font-semibold">
              {activeFilters.length}
            </span>
          )}
          {showAll && (
            <span className="inline-flex items-center h-5 px-2 rounded-full bg-accent-light text-accent text-xs font-semibold">
              Visar alla
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
          <div className="mt-2 space-y-2">
            {/* Mirror the sidebar's "Visa alla" / "Mina intressen" toggle. */}
            <div className="inline-flex rounded-control border border-border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => router.push("/?alla=1")}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  showAll
                    ? "bg-primary text-white"
                    : "bg-white text-secondary hover:bg-background"
                }`}
              >
                Visa alla
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className={`px-3 py-1.5 font-medium border-l border-border transition-colors ${
                  !showAll
                    ? "bg-primary text-white"
                    : "bg-white text-secondary hover:bg-background"
                }`}
              >
                Mina intressen
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {userInterests.map((interest) => (
                <Tag
                  key={interest.id}
                  label={interest.name}
                  active={activeFilters.includes(interest.slug)}
                  onClick={() => handleFilterClick(interest.slug)}
                />
              ))}
            </div>
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
          <div className="grid grid-cols-activity-feed gap-5">
            {filteredActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={{
                  id: activity.id,
                  title: activity.title,
                  description: activity.description,
                  location: activity.location,
                  startTime: activity.startTime,
                  endTime: activity.endTime,
                  tags: activity.tags,
                  participantCount: activity.participantCount,
                  maxParticipants: activity.maxParticipants,
                  whatToExpect: activity.whatToExpect as WhatToExpect | null,
                  imageThumbUrl: activity.imageThumbUrl,
                  imageAccentColor: activity.imageAccentColor,
                  colorTheme: activity.colorTheme,
                  genderRestriction: activity.genderRestriction,
                }}
                isCreator={!!userId && activity.creatorId === userId}
                userStatus={activity.userStatus}
                onClick={handleCardClick}
              />
            ))}
          </div>

          {/* Sentinel for IntersectionObserver-driven lazy loading. */}
          {hasMore && !searchText.trim() && (
            <div
              ref={sentinelRef}
              className="flex justify-center py-8"
              aria-live="polite"
            >
              {loadingMore ? (
                <span className="text-sm text-secondary">Laddar fler…</span>
              ) : loadError ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-error">{loadError}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => loadMore()}
                  >
                    Försök igen
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-dimmed">
                  Scrolla för att se fler
                </span>
              )}
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
