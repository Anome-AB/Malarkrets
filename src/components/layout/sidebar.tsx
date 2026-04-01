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

export function Sidebar({ interests, activeFilter }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-[200px] bg-white border-r border-[#dddddd] hidden lg:block h-full overflow-y-auto">
      <nav className="py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
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
        </ul>
      </nav>

      {interests.length > 0 && (
        <div className="px-4 py-3 border-t border-[#dddddd]">
          <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-2">
            Intressen
          </h3>
          <ul className="space-y-1">
            {interests.map((interest) => {
              const isActive = activeFilter === interest.slug;
              return (
                <li key={interest.id}>
                  <Link
                    href={`/?intresse=${interest.slug}`}
                    className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${
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
    </aside>
  );
}
