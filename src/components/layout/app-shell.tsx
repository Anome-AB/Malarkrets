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

      <div className="flex" style={{ height: "calc(100vh - 60px)" }}>
        <Sidebar interests={interests} activeFilters={activeFilters} showAll={showAll} isAdmin={isAdmin} />

        <main className="flex-1 overflow-y-auto pb-bottomnav lg:pb-0">
          {children}
        </main>
      </div>

      <BottomNav unreadCount={unreadCount} />
    </div>
  );
}
