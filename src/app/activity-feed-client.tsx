"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ActivityCard } from "@/components/activity/activity-card";
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
}

export function ActivityFeed({
  initialActivities,
  userInterests,
  activeFilter,
  nextCursor,
}: ActivityFeedProps) {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

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
    router.push(`/activity/${id}`);
  }

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
      <div className="mb-6 max-w-md">
        <Input
          type="search"
          placeholder="Sök aktiviteter..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>
  );
}
