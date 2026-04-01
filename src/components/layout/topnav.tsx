"use client";

import Link from "next/link";

interface TopNavProps {
  unreadCount: number;
  userInitials: string;
}

export function TopNav({ unreadCount, userInitials }: TopNavProps) {
  return (
    <nav className="bg-[#3d6b5e] text-white h-[60px] flex justify-between items-center px-6">
      <Link href="/" className="text-xl font-semibold">
        Mälarkrets
      </Link>

      <div className="flex items-center gap-4">
        <Link
          href="/activity/new"
          className="text-sm hover:underline hidden sm:inline"
        >
          Skapa aktivitet
        </Link>

        <Link href="#" className="relative">
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
            <span className="absolute -top-1.5 -right-1.5 bg-[#e07a3a] text-white text-[10px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold select-none">
          {userInitials}
        </div>
      </div>
    </nav>
  );
}
