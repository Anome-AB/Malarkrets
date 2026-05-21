import type { ReactNode } from "react";

export type NotificationType =
  | "activity_updated"
  | "participant_joined"
  | "participant_left"
  | "activity_deleted"
  | "activity_cancelled"
  | "activity_edited_by_admin";

type Params = Record<string, unknown> | null;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function notificationMessage(
  type: NotificationType,
  params: Params,
  activityTitle: string | null = null,
): string {
  const p = (params ?? {}) as Record<string, unknown>;
  // Prio: aktiv FK-join > params.activityTitle (sparat vid creation) >
  // generic fallback. Andra steget täcker hard-deletade aktiviteter där
  // notification.activityId blivit null via ON DELETE SET NULL.
  const titleRaw =
    activityTitle ?? asString(p.activityTitle, "") ?? "";
  const titleQuoted = titleRaw ? `"${titleRaw}"` : "En aktivitet";
  const actor = asString(p.actorName, "En deltagare");
  const reason = asString(p.reason);
  const changed = asString(p.changedFields);
  switch (type) {
    case "participant_joined":
      return `${actor} har anmält sig till ${titleQuoted}`;
    case "participant_left":
      return `${actor} har avanmält sig från ${titleQuoted}`;
    case "activity_updated":
      return `${titleQuoted} har uppdaterats`;
    case "activity_cancelled":
      return `${titleQuoted} har avbokats${reason ? ` - ${reason}` : ""}`;
    case "activity_deleted":
      return asString(p.isForCreator)
        ? `Din aktivitet ${titleQuoted} har tagits bort av en administratör`
        : `${titleQuoted} har tagits bort`;
    case "activity_edited_by_admin":
      return `En administratör har redigerat ${titleQuoted}${changed ? ` (${changed})` : ""}`;
  }
}

/**
 * Eventuell extra detaljrad under headlinen, t.ex. admins motivering vid
 * moderationsåtgärd. Returnerar null om inget extra ska visas.
 */
export function notificationDetail(
  type: NotificationType,
  params: Params,
): string | null {
  const p = (params ?? {}) as Record<string, unknown>;
  const reason = asString(p.reason);
  if (!reason) return null;
  switch (type) {
    case "activity_edited_by_admin":
    case "activity_deleted":
      return `Anledning: ${reason}`;
    default:
      return null;
  }
}

export function notificationIcon(type: NotificationType): ReactNode {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "participant_joined":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      );
    case "participant_left":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="17" y1="11" x2="23" y2="11" />
        </svg>
      );
    case "activity_updated":
    case "activity_edited_by_admin":
      return (
        <svg {...common}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );
    case "activity_cancelled":
      return (
        <svg {...common}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "activity_deleted":
      return (
        <svg {...common}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      );
  }
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "nyss";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `för ${minutes} min sedan`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `för ${hours} tim sedan`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `för ${days} ${days === 1 ? "dag" : "dagar"} sedan`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `för ${weeks} ${weeks === 1 ? "vecka" : "veckor"} sedan`;
  return d.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}
