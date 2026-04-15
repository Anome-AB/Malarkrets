"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { logOut } from "@/actions/auth";

interface TopNavProps {
  unreadCount: number;
  userInitials: string;
}

export function TopNav({ unreadCount, userInitials }: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <nav className="bg-primary text-white h-topnav flex justify-between items-center px-6">
      <Link href="/" className="text-xl font-semibold">
        Mälarkrets
      </Link>

      <div className="flex items-center gap-4">
        <NotificationDropdown initialUnreadCount={unreadCount} />

        {/* Avatar + dropdown menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold select-none hover:bg-white/30 transition-colors"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            {userInitials}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-border py-1 z-50">
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 text-sm text-heading hover:bg-background transition-colors"
              >
                Min profil
              </Link>
              <div className="border-t border-border-light my-1" />
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShowLogout(true);
                }}
                className="block w-full text-left px-4 py-2.5 text-sm text-error hover:bg-background transition-colors"
              >
                Logga ut
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={async () => {
          setLoggingOut(true);
          await logOut();
        }}
        title="Logga ut"
        message="Är du säker på att du vill logga ut?"
        confirmLabel="Logga ut"
        cancelLabel="Avbryt"
        variant="danger"
        loading={loggingOut}
      />
    </nav>
  );
}
