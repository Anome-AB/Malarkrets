"use client";

import { getColorHex } from "@/lib/color-themes";

interface WhatToExpect {
  okAlone?: boolean;
  experienceLevel?: string;
  whoComes?: string;
  latePolicy?: string;
  groupSize?: string;
  courageMessage?: string;
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
    endTime?: Date | string | null;
    tags: Tag[];
    participantCount: number;
    maxParticipants: number | null;
    whatToExpect: WhatToExpect | null;
    imageThumbUrl: string | null;
    imageMediumUrl?: string | null;
    imageAccentColor?: string | null;
    colorTheme?: string | null;
    genderRestriction?: "alla" | "kvinnor" | "man" | null;
  };
  isCreator?: boolean;
  userStatus?: "interested" | "attending" | null;
  onClick?: (id: string) => void;
}

// Fallback used when an activity has neither an extracted accent nor a colorTheme
// (legacy rows that predate the image pipeline change). Neutral stone, so any
// white text on top stays legible without guessing.
const FALLBACK_ACCENT = "#7a8088";

function weekdayShort(d: Date): string {
  return d.toLocaleDateString("sv-SE", { weekday: "short" }).replace(".", "");
}
function monthShort(d: Date): string {
  return d.toLocaleDateString("sv-SE", { month: "short" }).replace(".", "");
}
function timeHHmm(d: Date): string {
  return d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}
function dateFull(d: Date): string {
  return d.toLocaleDateString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// When a location has three parts (name, address, city) the street address
// is redundant on a card. The name alone identifies the place and the city
// orients the user. Collapse to "name, city". Two-part locations pass through
// unchanged (either "name, city" or "address, city").
function formatLocation(raw: string): string {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) return `${parts[0]}, ${parts[parts.length - 1]}`;
  return parts.join(", ");
}

function ParticipantDots({
  count,
  max,
}: {
  count: number;
  max: number | null;
}) {
  const shown = Math.min(count, 5);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-[3px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${i < shown ? "bg-primary" : "bg-border"}`}
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

export function ActivityCard({
  activity,
  isCreator = false,
  userStatus,
  onClick,
}: ActivityCardProps) {
  const wte = activity.whatToExpect;
  const start =
    typeof activity.startTime === "string"
      ? new Date(activity.startTime)
      : activity.startTime;

  const hasValidDate = !isNaN(start.getTime());
  const weekday = hasValidDate ? weekdayShort(start) : "";
  const day = hasValidDate ? String(start.getDate()).padStart(2, "0") : "";
  const month = hasValidDate ? monthShort(start) : "";

  const end = activity.endTime
    ? typeof activity.endTime === "string"
      ? new Date(activity.endTime)
      : activity.endTime
    : null;
  const hasEnd = end != null && !isNaN(end.getTime());
  const timeRange = hasEnd
    ? `${timeHHmm(start)}–${timeHHmm(end)}`
    : timeHHmm(start);

  const heroImage = activity.imageMediumUrl ?? activity.imageThumbUrl;
  const themeHex = getColorHex(activity.colorTheme);
  const accent = activity.imageAccentColor ?? themeHex ?? FALLBACK_ACCENT;

  // When the activity has an image: show it tinted 35–52 % with the accent.
  // When it's color-only: use the theme hex flat, with a 135° lightness shift
  // so the block still has the gradient character of the image variant.
  const dateBlockStyle: React.CSSProperties = {
    backgroundColor: accent,
    backgroundImage: heroImage
      ? [
          `linear-gradient(135deg, color-mix(in srgb, ${accent} 35%, transparent), color-mix(in srgb, ${accent} 52%, transparent))`,
          `url(${heroImage})`,
        ].join(", ")
      : `linear-gradient(135deg, color-mix(in srgb, ${accent} 60%, white) 0%, ${accent} 55%, color-mix(in srgb, ${accent} 80%, black) 100%)`,
    backgroundSize: "cover, cover",
    backgroundPosition: "center, center",
  };

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
      className="group relative flex overflow-hidden bg-surface border border-border rounded-card hover:shadow-md hover:border-primary/60 transition cursor-pointer h-[120px] md:h-[200px]"
    >
      {/* Date block (left), fixed 200x200 on desktop */}
      <div
        className="relative flex shrink-0 flex-col items-center justify-center text-white w-[120px] h-[120px] md:w-[200px] md:h-[200px] p-2 md:p-5 text-center"
        style={dateBlockStyle}
      >
        {/* Gender-restriction indicator: FontAwesome Venus/Mars glyph in
            solid white with a drop-shadow so it reads on any background.
            Only shown when the activity is restricted (not "alla"). */}
        {(activity.genderRestriction === "kvinnor" ||
          activity.genderRestriction === "man") && (
          <svg
            className="absolute top-2 left-2 md:top-3 md:left-3 w-5 h-5 md:w-6 md:h-6 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]"
            viewBox="0 0 640 640"
            fill="currentColor"
            role="img"
            aria-label={
              activity.genderRestriction === "kvinnor"
                ? "Endast för kvinnor"
                : "Endast för män"
            }
          >
            <title>
              {activity.genderRestriction === "kvinnor"
                ? "Endast för kvinnor"
                : "Endast för män"}
            </title>
            {activity.genderRestriction === "kvinnor" ? (
              <path d="M208 240C208 178.1 258.1 128 320 128C381.9 128 432 178.1 432 240C432 301.9 381.9 352 320 352C258.1 352 208 301.9 208 240zM351.9 413.1C433.9 398.1 496 326.3 496 240C496 142.8 417.2 64 320 64C222.8 64 144 142.8 144 240C144 326.3 206.1 398.1 288.1 413.1C288 414.1 288 415 288 416L288 480L256 480C238.3 480 224 494.3 224 512C224 529.7 238.3 544 256 544L288 544L288 576C288 593.7 302.3 608 320 608C337.7 608 352 593.7 352 576L352 544L384 544C401.7 544 416 529.7 416 512C416 494.3 401.7 480 384 480L352 480L352 416C352 415 352 414.1 351.9 413.1z" />
            ) : (
              <path d="M384 96C384 78.3 398.3 64 416 64L544 64C561.7 64 576 78.3 576 96L576 224C576 241.7 561.7 256 544 256C526.3 256 512 241.7 512 224L512 173.3L417 268.3C436.5 296.7 448 331 448 368.1C448 465.3 369.2 544.1 272 544.1C174.8 544.1 96 465.2 96 368C96 270.8 174.8 192 272 192C309 192 343.4 203.4 371.8 223L466.8 128L416.1 128C398.4 128 384.1 113.7 384.1 96zM272 480C333.9 480 384 429.9 384 368C384 306.1 333.9 256 272 256C210.1 256 160 306.1 160 368C160 429.9 210.1 480 272 480z" />
            )}
          </svg>
        )}
        <span
          className="text-[10px] md:text-[13px] font-display font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] opacity-95"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.3)" }}
        >
          {weekday}
        </span>
        <span
          className="font-display font-black leading-none my-1 text-[30px] md:text-[60px]"
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.35)" }}
        >
          {day}
        </span>
        <span
          className="text-[10px] md:text-[13px] font-display font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] opacity-95"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.3)" }}
        >
          {month}
        </span>
      </div>

      {/* ───── Info block (right) ───── */}
      <div className="flex-1 min-w-0 p-3 md:p-5 flex flex-col">
        {/* Title + badge share the top row via flex. Title truncates at the
            badge's left edge, so the break point shifts with viewport width
            instead of being pinned to a fixed pr-24. No wrap, just ellipsis. */}
        <div className="flex items-start gap-2">
          <h3 className="flex-1 min-w-0 font-display font-bold text-heading tracking-tight text-sm md:text-lg leading-tight truncate">
            {activity.title}
          </h3>
          {isCreator && (
            <span className="shrink-0 inline-block text-[10px] md:text-xs font-semibold px-2 py-0.5 rounded-full bg-success-bg text-success-text">
              Arrangerar
            </span>
          )}
          {userStatus === "attending" && !isCreator && (
            <span className="shrink-0 inline-block text-[10px] md:text-xs font-semibold px-2 py-0.5 rounded-full bg-success-bg text-success-text">
              Kommer
            </span>
          )}
          {userStatus === "interested" && !isCreator && (
            <span className="shrink-0 inline-block text-[10px] md:text-xs font-semibold px-2 py-0.5 rounded-full bg-alert-bg text-alert-text">
              Intresserad
            </span>
          )}
        </div>

        {/* Meta: time + location (one line each on desktop) */}
        <p className="text-xs md:text-sm text-secondary mt-0.5 md:mt-1 truncate">
          <span className="md:hidden">{dateFull(start)} · {timeRange}</span>
          <span className="hidden md:inline">{timeRange}</span>
        </p>
        <p className="text-[11px] md:text-sm text-dimmed md:text-secondary truncate">
          {formatLocation(activity.location)}
        </p>

        {/* Welcome message from the organiser. Replaces tags so the card
            carries voice rather than a category label. Tags still live in
            the sidebar filter for discovery. */}
        {wte?.courageMessage && (
          <p className="text-[11px] md:text-sm text-primary italic mt-1 md:mt-2 line-clamp-1 md:line-clamp-2">
            “{wte.courageMessage}”
          </p>
        )}

        {/* Footer: participants only. The courage-message heart icon is now
            redundant because the message itself is visible above. */}
        <div className="mt-auto pt-2 md:pt-3 md:border-t md:border-border flex items-center justify-between gap-2">
          <ParticipantDots
            count={activity.participantCount}
            max={activity.maxParticipants}
          />
        </div>
      </div>
    </article>
  );
}
