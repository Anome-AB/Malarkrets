"use client";

import { getColorHex } from "@/lib/color-themes";

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

interface ActivityCardProps {
  activity: {
    id: string;
    title: string;
    description: string;
    location: string;
    startTime: Date | string;
    tags: Tag[];
    participantCount: number;
    maxParticipants: number | null;
    whatToExpect: WhatToExpect | null;
    imageThumbUrl: string | null;
    colorTheme?: string | null;
  };
  isCreator?: boolean;
  userStatus?: "interested" | "attending" | null;
  onClick?: (id: string) => void;
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ParticipantDots({
  count,
  max,
}: {
  count: number;
  max: number | null;
}) {
  const dots = Math.min(count, 5);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1">
        {Array.from({ length: dots }).map((_, i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-primary border border-white"
          />
        ))}
      </div>
      <span className="text-xs text-secondary">
        {count}
        {max != null ? ` / ${max}` : ""} deltagare
      </span>
    </div>
  );
}

export function ActivityCard({ activity, isCreator = false, userStatus, onClick }: ActivityCardProps) {
  const wte = activity.whatToExpect;
  const colorHex = getColorHex(activity.colorTheme);
  const hasBg = !!activity.imageThumbUrl || !!colorHex;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(activity.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(activity.id);
        }
      }}
      className="relative overflow-hidden flex flex-col bg-white border border-border rounded-[10px] p-4 hover:shadow-md hover:border-primary transition cursor-pointer h-full"
      style={
        activity.imageThumbUrl
          ? { backgroundImage: `url(${activity.imageThumbUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : colorHex
            ? {
                backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${colorHex} 60%, white) 0%, ${colorHex} 55%, color-mix(in srgb, ${colorHex} 80%, black) 100%)`,
              }
            : undefined
      }
    >
      {/* Content on gradient white pill — solid 90% left, fades to 10% right (only over image/color bg) */}
      <div
        className={`relative flex flex-col flex-1 ${hasBg ? "backdrop-blur-[2px] rounded-[8px] p-3 -m-1" : ""}`}
        style={
          hasBg
            ? {
                background:
                  "linear-gradient(to right, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.1) 100%)",
              }
            : undefined
        }
      >

      {(isCreator || userStatus) && (
        <div className="flex justify-end gap-1.5 mb-1">
          {isCreator && (
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-success-bg text-success-text">
              Arrangerar
            </span>
          )}
          {userStatus === "attending" && !isCreator && (
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-success-bg text-success-text">
              Kommer
            </span>
          )}
          {userStatus === "interested" && !isCreator && (
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-alert-bg text-alert-text">
              Intresserad
            </span>
          )}
        </div>
      )}

      <h3 className="text-base font-semibold text-heading">
        {activity.title}
      </h3>

      <p className="text-sm text-secondary mt-1">
        {formatDate(activity.startTime)}
      </p>
      {(() => {
        // Split address into name + rest on own lines if we have multiple parts
        const parts = activity.location.split(",").map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 3) {
          // "Name, street, city" → name on own line, rest below
          return (
            <>
              <p className="text-sm text-secondary font-medium">{parts[0]}</p>
              <p className="text-sm text-secondary">{parts.slice(1).join(", ")}</p>
            </>
          );
        }
        return <p className="text-sm text-secondary">{activity.location}</p>;
      })()}

      {activity.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {activity.tags.map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-2 py-0.5 rounded-full bg-primary-light text-primary"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-border">
        <ParticipantDots
          count={activity.participantCount}
          max={activity.maxParticipants}
        />
      </div>
      </div>
    </article>
  );
}
