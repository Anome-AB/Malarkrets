"use client";

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
            className="w-2.5 h-2.5 rounded-full bg-[#3d6b5e] border border-white"
          />
        ))}
      </div>
      <span className="text-xs text-[#666666]">
        {count}
        {max != null ? ` / ${max}` : ""} deltagare
      </span>
    </div>
  );
}

export function ActivityCard({ activity, isCreator = false, userStatus, onClick }: ActivityCardProps) {
  const wte = activity.whatToExpect;

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
      className="bg-white border border-[#dddddd] rounded-[10px] p-4 hover:shadow-md hover:border-[#3d6b5e] transition cursor-pointer"
    >
      {activity.imageThumbUrl && (
        <img
          src={activity.imageThumbUrl}
          alt=""
          className="w-full h-40 object-cover rounded-lg mb-3"
        />
      )}

      {(isCreator || userStatus) && (
        <div className="flex gap-1.5 mb-1">
          {isCreator && (
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-[#d4edda] text-[#155724]">
              Du arrangerar
            </span>
          )}
          {userStatus === "attending" && !isCreator && (
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-[#d4edda] text-[#155724]">
              Deltar
            </span>
          )}
          {userStatus === "interested" && !isCreator && (
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-[#fff3cd] text-[#856404]">
              Intresserad
            </span>
          )}
        </div>
      )}

      <h3 className="text-base font-semibold text-[#2d2d2d]">
        {activity.title}
      </h3>

      <p className="text-sm text-[#666666] mt-1">
        {formatDate(activity.startTime)} &middot; {activity.location}
      </p>

      {activity.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {activity.tags.map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-2 py-0.5 rounded-full bg-[#e8f0ec] text-[#3d6b5e]"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-[#dddddd]">
        <ParticipantDots
          count={activity.participantCount}
          max={activity.maxParticipants}
        />
      </div>
    </article>
  );
}
