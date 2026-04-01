"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  maxParticipants: number | null;
  whatToExpect: unknown;
  tags: Array<{ id: number; name: string; slug: string }>;
  participantCount: number;
  creatorId: string | null;
}

interface Interest {
  id: number;
  name: string;
  slug: string;
}

interface ActivityFeedProps {
  initialActivities: ActivityItem[];
  userInterests: Interest[];
  activeFilter: string | null;
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
  activeFilter,
  nextCursor,
  userId,
}: ActivityFeedProps) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [searchText, setSearchText] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

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
    if (activeFilter === slug) {
      router.push("/");
    } else {
      router.push(`/?intresse=${slug}`);
    }
  }

  function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    const params = new URLSearchParams();
    if (activeFilter) params.set("intresse", activeFilter);
    params.set("cursor", nextCursor);
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="p-4 lg:p-6">
      <h1 className="text-xl font-semibold text-[#2d2d2d] mb-4">Aktiviteter i Västerås</h1>

      {/* Interest tag filter bar (mobile only, sidebar handles desktop) */}
      <div className="flex flex-wrap gap-2 mb-4 lg:hidden">
        {userInterests.map((interest) => (
          <Tag
            key={interest.id}
            label={interest.name}
            active={activeFilter === interest.slug}
            onClick={() => handleFilterClick(interest.slug)}
          />
        ))}
      </div>

      {/* Search */}
      <div className="mb-6 max-w-md relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999] pointer-events-none"
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

      {/* Activity grid */}
      {filteredActivities.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[#666666] text-lg">
            Inga aktiviteter hittades.
          </p>
          <p className="text-[#999999] text-sm mt-1">
            Prova att ändra filter eller sök efter något annat.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                }}
                isCreator={!!userId && activity.creatorId === userId}
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
