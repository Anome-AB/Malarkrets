"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeInitials } from "@/lib/initials";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { blockUser, unblockUser } from "@/actions/blocking";

export interface ParticipantPreview {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /**
   * Sätts av server-render när current viewer redan har blockerat denna
   * deltagare. UI:t visar då "Blockerad"-chip och avblockera-knapp istället
   * för blockera-knappen.
   */
  isBlockedByViewer?: boolean;
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
  /**
   * Current user-id. När satt visar popovern blockera-knapp på alla rader
   * utom den egna. Lämna ut för publika vyer.
   */
  currentUserId?: string;
  /**
   * Anropas när en användare har blockats. Föräldern brukar refresha datan
   * (router.refresh eller motsvarande) så den blockade inte syns kvar.
   */
  onBlocked?: (userId: string) => void;
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
  currentUserId,
  onBlocked,
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

  return (
    <ParticipantPopoverButton
      stack={stack}
      counter={counter}
      participants={participants}
      total={total}
      currentUserId={currentUserId}
      onBlocked={onBlocked}
    />
  );
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
 *
 * När currentUserId är satt visas en blockera-ikon på varje rad utom den
 * egna. Klick öppnar en bekräftelsedialog som förklarar konsekvenserna
 * innan blockUser-action:en körs.
 */
function ParticipantPopoverButton({
  stack,
  counter,
  participants,
  total,
  currentUserId,
  onBlocked,
}: {
  stack: React.ReactNode;
  counter: React.ReactNode;
  participants: ParticipantPreview[];
  total: number;
  currentUserId?: string;
  onBlocked?: (userId: string) => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<ParticipantPreview | null>(null);
  const [isBlocking, startBlockTransition] = useTransition();
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

  function confirmBlock() {
    const target = blockTarget;
    if (!target) return;
    startBlockTransition(async () => {
      const result = await blockUser(target.id);
      if (result.success) {
        toast(`${target.displayName} är nu blockerad`, "success");
        setBlockTarget(null);
        if (onBlocked) {
          onBlocked(target.id);
        } else {
          // Server-renderade kallare (t.ex. /activity/[id]) använder
          // router.refresh för att markera den som blockerad i listan.
          router.refresh();
        }
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  // Avblockering har ingen confirm-dialog - det är en konstruktiv handling
  // som lätt kan ångras genom att blockera igen. Bara en toast bekräftar.
  function handleUnblock(participant: ParticipantPreview) {
    startBlockTransition(async () => {
      const result = await unblockUser(participant.id);
      if (result.success) {
        toast(`${participant.displayName} är avblockerad`, "success");
        if (onBlocked) {
          onBlocked(participant.id);
        } else {
          router.refresh();
        }
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  return (
    <>
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
            className="absolute left-0 top-full mt-2 min-w-[260px] max-w-[340px] max-h-[60vh] overflow-y-auto bg-white border border-border rounded-card shadow-lg z-30 py-2"
          >
            <div className="px-4 pt-1 pb-2 text-xs font-semibold text-secondary uppercase tracking-wider">
              {total === 1 ? "1 deltagare" : `${total} deltagare`}
            </div>
            <ul className="space-y-0.5">
              {participants.map((p) => {
                const isSelf = currentUserId === p.id;
                const isBlocked = !!p.isBlockedByViewer;
                return (
                  <li
                    key={p.id}
                    className="group flex items-center gap-3 px-4 py-1.5 text-sm text-heading hover:bg-background"
                  >
                    <Avatar
                      participant={p}
                      className={`w-7 h-7 text-[10px] ${isBlocked ? "opacity-60" : ""}`}
                    />
                    <span
                      className={`flex-1 min-w-0 truncate ${
                        isBlocked ? "text-secondary" : ""
                      }`}
                    >
                      {p.displayName}
                    </span>
                    {isBlocked && (
                      <span className="shrink-0 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-error">
                        Blockerad
                      </span>
                    )}
                    {currentUserId && !isSelf && !isBlocked && (
                      <button
                        type="button"
                        onClick={() => setBlockTarget(p)}
                        aria-label={`Blockera ${p.displayName}`}
                        title="Blockera"
                        className="shrink-0 p-1 rounded-control text-error/70 hover:text-error hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-error transition-opacity"
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
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                      </button>
                    )}
                    {currentUserId && !isSelf && isBlocked && (
                      <button
                        type="button"
                        onClick={() => handleUnblock(p)}
                        disabled={isBlocking}
                        aria-label={`Avblockera ${p.displayName}`}
                        title="Avblockera"
                        className="shrink-0 p-1 rounded-control text-secondary hover:text-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 transition-colors"
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
                          aria-hidden="true"
                        >
                          {/* user-check: person + bock = "godkänd användare" */}
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <polyline points="16 11 18 13 22 9" />
                        </svg>
                      </button>
                    )}
                  </li>
                );
              })}
              {participants.length < total && (
                <li className="px-4 py-1.5 text-xs text-dimmed italic">
                  {total - participants.length} till visas inte i listan
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!blockTarget}
        title={blockTarget ? `Blockera ${blockTarget.displayName}?` : ""}
        message={
          blockTarget
            ? `Du ser inte längre aktiviteter som ${blockTarget.displayName} arrangerar i flödet, och de ser inte dina. Ni kan dock fortfarande delta i samma aktiviteter som någon annan arrangerar - där syns ni kvar i deltagarlistan. Du kan avblockera senare via din profil.`
            : ""
        }
        confirmLabel="Blockera"
        cancelLabel="Avbryt"
        variant="danger"
        loading={isBlocking}
        onCancel={() => setBlockTarget(null)}
        onConfirm={confirmBlock}
      />
    </>
  );
}
