"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { logOut } from "@/actions/auth";

interface Interest {
  id: number;
  name: string;
  slug: string;
}

interface SidebarProps {
  interests: Interest[];
  activeFilters?: string[];
  showAll?: boolean;
  isAdmin?: boolean;
}

const navItems = [
  {
    label: "Utforska",
    href: "/",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: "Mina aktiviteter",
    href: "/my-activities",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Skapa aktivitet",
    href: "/activity/new",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    label: "Min profil",
    href: "/profile",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export function Sidebar({ interests, activeFilters = [], showAll = false, isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <aside className="w-sidebar bg-white border-r border-border hidden lg:flex flex-col h-full overflow-y-auto">
      <nav className="py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? "bg-primary-light text-primary font-semibold"
                      : "text-heading hover:bg-background"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            );
          })}
          {isAdmin && (
            <li>
              <Link
                href="/admin"
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  pathname === "/admin"
                    ? "bg-primary-light text-primary font-semibold"
                    : "text-heading hover:bg-background"
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Admin
              </Link>
            </li>
          )}
        </ul>
      </nav>

      {interests.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
            Intressen
          </h3>
          <div className="space-y-1 mb-3">
            <Link
              href="/?alla=1"
              className={`block px-3 py-1.5 text-xs rounded-md transition-colors ${
                showAll
                  ? "bg-primary-light text-primary font-bold"
                  : "text-secondary hover:bg-background hover:text-heading"
              }`}
            >
              Visa alla
            </Link>
            <Link
              href="/"
              className={`block px-3 py-1.5 text-xs rounded-md transition-colors ${
                activeFilters.length === 0 && !showAll
                  ? "bg-primary-light text-primary font-bold"
                  : "text-secondary hover:bg-background hover:text-heading"
              }`}
            >
              Mina intressen
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {interests.map((interest) => {
              const isActive = activeFilters.includes(interest.slug);
              // Toggle: add or remove this slug from the filter list
              const nextFilters = isActive
                ? activeFilters.filter((s) => s !== interest.slug)
                : [...activeFilters, interest.slug];
              const href = nextFilters.length > 0
                ? `/?intresse=${nextFilters.join(",")}`
                : "/";
              return (
                <Link
                  key={interest.id}
                  href={href}
                  className={`inline-block px-2 py-1 text-xs rounded-full transition-colors ${
                    isActive
                      ? "bg-primary text-white font-medium"
                      : "bg-muted text-secondary hover:bg-primary-light hover:text-primary"
                  }`}
                >
                  {interest.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Logga ut */}
      <div className="mt-auto px-4 py-2 border-t border-border">
        <button
          onClick={() => setShowLogout(true)}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:bg-background hover:text-error transition-colors rounded-md w-full"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logga ut
        </button>
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
    </aside>
  );
}
