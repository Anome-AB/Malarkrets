"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  notificationIcon,
  notificationMessage,
  timeAgo,
  type NotificationType,
} from "@/lib/notifications/copy";
import { markRead } from "@/actions/notifications";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  activityId: string | null;
  activityTitle: string | null;
  params: Record<string, unknown> | null;
  read: boolean;
  createdAt: Date | string;
}

interface Props {
  items: NotificationItem[];
  onItemClick?: () => void;
  emptyMessage?: string;
}

export function NotificationList({ items, onItemClick, emptyMessage }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-secondary text-sm">
        {emptyMessage ?? "Inga notiser ännu."}
      </div>
    );
  }

  function handleItemClick(item: NotificationItem) {
    if (!item.read) {
      startTransition(async () => {
        await markRead(item.id);
      });
    }
    onItemClick?.();
    if (item.activityId) {
      router.push(`/activity/${item.activityId}`);
    }
  }

  return (
    <ul className="divide-y divide-border-light">
      {items.map((item) => {
        const content = (
          <div
            className={`flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-background ${
              item.read ? "bg-white" : "bg-primary-light/50"
            }`}
          >
            <div
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                item.read ? "bg-muted text-dimmed" : "bg-primary-light text-primary"
              }`}
            >
              {notificationIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm ${
                  item.read ? "text-secondary" : "text-heading font-medium"
                }`}
              >
                {notificationMessage(item.type, item.params)}
              </p>
              <p className="text-xs text-dimmed mt-0.5 truncate">
                {item.activityTitle ?? "Aktivitet borttagen"}
                <span className="mx-1.5">•</span>
                {timeAgo(item.createdAt)}
              </p>
            </div>
            {!item.read && (
              <div className="shrink-0 self-center w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </div>
        );

        return (
          <li key={item.id}>
            {item.activityId ? (
              <Link
                href={`/activity/${item.activityId}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleItemClick(item);
                }}
                className="block"
              >
                {content}
              </Link>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleItemClick(item);
                }}
              >
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
