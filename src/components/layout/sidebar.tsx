"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Interest {
  id: number;
  name: string;
  slug: string;
}

interface SidebarProps {
  interests: Interest[];
  activeFilter: string | null;
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
    label: "Mina anmälningar",
    href: "/profile",
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

export function Sidebar({ interests, activeFilter, isAdmin = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-[200px] bg-white border-r border-[#dddddd] hidden lg:block h-full overflow-y-auto flex flex-col">
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
                      ? "bg-[#e8f0ec] text-[#3d6b5e] font-semibold"
                      : "text-[#2d2d2d] hover:bg-[#f8f7f4]"
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
                    ? "bg-[#e8f0ec] text-[#3d6b5e] font-semibold"
                    : "text-[#2d2d2d] hover:bg-[#f8f7f4]"
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
        <div className="px-4 py-3 border-t border-[#dddddd]">
          <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-2">
            Intressen
          </h3>
          <ul className="space-y-1">
            <li>
              <Link
                href="/"
                className={`flex items-center min-h-[44px] px-3 py-2 text-xs rounded-md transition-colors ${
                  activeFilter === null
                    ? "bg-[#e8f0ec] text-[#3d6b5e] font-bold"
                    : "text-[#666666] hover:bg-[#f8f7f4] hover:text-[#2d2d2d]"
                }`}
              >
                Alla
              </Link>
            </li>
            {interests.map((interest) => {
              const isActive = activeFilter === interest.slug;
              return (
                <li key={interest.id}>
                  <Link
                    href={`/?intresse=${interest.slug}`}
                    className={`flex items-center min-h-[44px] px-3 py-2 text-xs rounded-md transition-colors ${
                      isActive
                        ? "bg-[#e8f0ec] text-[#3d6b5e] font-semibold"
                        : "text-[#666666] hover:bg-[#f8f7f4] hover:text-[#2d2d2d]"
                    }`}
                  >
                    {interest.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Logga ut */}
      <div className="mt-auto px-4 py-2 border-t border-[#dddddd]">
        <button
          onClick={() => {
            window.location.href = "/api/auth/signout";
          }}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#666666] hover:bg-[#f8f7f4] hover:text-[#dc3545] transition-colors rounded-md w-full"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logga ut
        </button>
      </div>
    </aside>
  );
}
