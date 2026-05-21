"use client";

import { useEffect, useRef, useState } from "react";
import { computeInitials } from "@/lib/initials";

export interface ParticipantPreview {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface ParticipantAvatarsProps {
  /**
   * Lista över avatar-data. Behöver inte vara komplett - om listan är kortare
   * än `total` visas en "+N"-bricka för resten.
   */
  participants: ParticipantPreview[];
  /** Totalt antal deltagare (för "+N"-bricka och text-räknare). */
  total: number;
  /** Tak för aktiviteten. När null visas bara "{total} deltagare". */
  max: number | null;
  /**
   * Visuell variant.
   * - "compact": små avatarer (20px), ingen popover. För kort i feed/lista.
   * - "full": större avatarer (28px), klickbar för popover med fullständig
   *   lista. För detalj/panel-vyer.
   */
  variant?: "compact" | "full";
}

const SIZE_BY_VARIANT = {
  compact: {
    avatar: "w-5 h-5 text-[8px]",
    ring: "ring-1 ring-white",
    overlap: "-ml-1.5",
    moreText: "text-[8px]",
  },
  full: {
    avatar: "w-7 h-7 text-[10px]",
    ring: "ring-2 ring-white",
    overlap: "-ml-2",
    moreText: "text-[10px]",
  },
} as const;

/**
 * Renderar en överlappande stack av deltagar-avatarer med en räknare bredvid.
 * Default visar de första 5 från `participants`-listan; återstoden adderas
 * som en "+N"-cirkel sist i stacken om `total > participants.length`.
 *
 * I "full"-variant kan stacken klickas för att öppna en popover med alla namn.
 */
export function ParticipantAvatars({
  participants,
  total,
  max,
  variant = "full",
}: ParticipantAvatarsProps) {
  const sizes = SIZE_BY_VARIANT[variant];
  const visible = participants.slice(0, 5);
  const hiddenCount = Math.max(0, total - visible.length);

  if (total === 0) {
    // Inga anmälda - bara textraden, ingen stack.
    return (
      <div className="flex items-center gap-2 text-sm text-secondary">
        <span>
          0
          {max != null ? ` / ${max}` : ""} deltagare
        </span>
      </div>
    );
  }

  const stack = (
    <div className="flex items-center" aria-hidden="true">
      {visible.map((p, i) => (
        <Avatar
          key={p.id}
          participant={p}
          className={`${sizes.avatar} ${sizes.ring} ${i === 0 ? "" : sizes.overlap}`}
        />
      ))}
      {hiddenCount > 0 && (
        <span
          className={`${sizes.avatar} ${sizes.ring} ${sizes.overlap} rounded-full bg-muted text-secondary font-semibold flex items-center justify-center ${sizes.moreText}`}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );

  const counter = (
    <span className="text-sm text-secondary">
      {total}
      {max != null ? ` / ${max}` : ""} deltagare
    </span>
  );

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2">
        {stack}
        <span className="text-xs text-secondary">
          {total}
          {max != null ? ` / ${max}` : ""} deltagare
        </span>
      </div>
    );
  }

  return <ParticipantPopoverButton stack={stack} counter={counter} participants={participants} total={total} />;
}

function Avatar({
  participant,
  className = "",
}: {
  participant: ParticipantPreview;
  className?: string;
}) {
  const initials = computeInitials(participant.displayName);
  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center rounded-full bg-primary-light text-primary font-semibold overflow-hidden ${className}`}
      title={participant.displayName}
    >
      {participant.avatarUrl ? (
        <img
          src={participant.avatarUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}

/**
 * Klickbar wrapper kring stacken + räknaren. Öppnar en popover med alla
 * deltagares namn + avatar. ESC och click-outside stänger popovern.
 */
function ParticipantPopoverButton({
  stack,
  counter,
  participants,
  total,
}: {
  stack: React.ReactNode;
  counter: React.ReactNode;
  participants: ParticipantPreview[];
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Visa lista över ${total} deltagare`}
        className="flex items-center gap-2 rounded-control px-1.5 py-1 -mx-1.5 -my-1 hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
      >
        {stack}
        {counter}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Deltagarlista"
          className="absolute left-0 top-full mt-2 min-w-[220px] max-w-[320px] max-h-[60vh] overflow-y-auto bg-white border border-border rounded-card shadow-lg z-30 py-2"
        >
          <div className="px-4 pt-1 pb-2 text-xs font-semibold text-secondary uppercase tracking-wider">
            {total === 1 ? "1 deltagare" : `${total} deltagare`}
          </div>
          <ul className="space-y-0.5">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 px-4 py-1.5 text-sm text-heading"
              >
                <Avatar
                  participant={p}
                  className="w-7 h-7 text-[10px]"
                />
                <span className="truncate">{p.displayName}</span>
              </li>
            ))}
            {participants.length < total && (
              <li className="px-4 py-1.5 text-xs text-dimmed italic">
                {total - participants.length} till visas inte i listan
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
