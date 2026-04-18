import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./topnav";
import { BottomNav } from "./bottom-nav";

interface Interest {
  id: number;
  name: string;
  slug: string;
}

interface AppShellProps {
  children: ReactNode;
  interests: Interest[];
  activeFilters?: string[];
  showAll?: boolean;
  unreadCount: number;
  userInitials: string;
  isAdmin?: boolean;
}

export function AppShell({
  children,
  interests,
  activeFilters = [],
  showAll = false,
  unreadCount,
  userInitials,
  isAdmin = false,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav unreadCount={unreadCount} userInitials={userInitials} />

      {/* 60px = TopNav. --banner-h is 0 unless SiteBanner is rendered;
          see globals.css. Falls back to 0 if the variable is missing. */}
      <div className="flex" style={{ height: "calc(100vh - 60px - var(--banner-h, 0px))" }}>
        <Sidebar interests={interests} activeFilters={activeFilters} showAll={showAll} isAdmin={isAdmin} />

        <main className="flex-1 overflow-y-auto pb-bottomnav lg:pb-0">
          {children}
        </main>
      </div>

      <BottomNav unreadCount={unreadCount} />
    </div>
  );
}
