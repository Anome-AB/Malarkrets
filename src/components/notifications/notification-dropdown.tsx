"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotificationList, type NotificationItem } from "./notification-list";
import { markAllRead } from "@/actions/notifications";

interface Props {
  initialUnreadCount: number;
}

export function NotificationDropdown({ initialUnreadCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external data fetch into local UI state; refactor to a data-fetching lib is out of scope here.
    setLoading(true);
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function handleMarkAllRead() {
    startTransition(async () => {
      const result = await markAllRead();
      if (result.success) {
        setItems((prev) =>
          prev ? prev.map((n) => ({ ...n, read: true })) : prev,
        );
        setUnreadCount(0);
        router.refresh();
      }
    });
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-11 h-11 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors"
        aria-label="Notiser"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-warning text-white text-nano font-bold rounded-full size-badge flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-card shadow-xl border border-border z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-heading">Notiser</span>
            {items && items.some((n) => !n.read) && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline"
              >
                Markera alla som lästa
              </button>
            )}
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {loading && !items && (
              <div className="px-6 py-10 text-center text-secondary text-sm">
                Laddar…
              </div>
            )}
            {items && (
              <NotificationList
                items={items}
                onItemClick={() => setOpen(false)}
                emptyMessage="Inga olästa notiser."
              />
            )}
          </div>

          <div className="border-t border-border">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-sm text-primary py-3 hover:bg-background transition-colors"
            >
              Visa alla →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
