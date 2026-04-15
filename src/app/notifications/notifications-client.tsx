"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  NotificationList,
  type NotificationItem,
} from "@/components/notifications/notification-list";
import { markAllRead } from "@/actions/notifications";

interface Props {
  items: NotificationItem[];
}

export function NotificationsClient({ items: initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [, startTransition] = useTransition();

  const unread = items.filter((n) => !n.read);
  const read = items.filter((n) => n.read);

  function handleMarkAllRead() {
    startTransition(async () => {
      const result = await markAllRead();
      if (result.success) {
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        router.refresh();
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-heading">Notiser</h1>
        {unread.length > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-sm text-primary hover:underline"
          >
            Markera alla som lästa
          </button>
        )}
      </div>

      {items.length === 0 && (
        <Card>
          <div className="py-10 text-center text-secondary">
            <div className="inline-flex w-12 h-12 rounded-full bg-muted items-center justify-center text-dimmed mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <p className="text-sm">Du har inga notiser ännu.</p>
          </div>
        </Card>
      )}

      {unread.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-dimmed uppercase tracking-wide px-1 mb-2">
            Olästa
          </h2>
          <Card className="!p-0 overflow-hidden">
            <NotificationList items={unread} />
          </Card>
        </section>
      )}

      {read.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-dimmed uppercase tracking-wide px-1 mb-2">
            Tidigare
          </h2>
          <Card className="!p-0 overflow-hidden">
            <NotificationList items={read} />
          </Card>
        </section>
      )}
    </div>
  );
}
