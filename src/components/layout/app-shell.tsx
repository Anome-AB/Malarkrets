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
  activeFilter: string | null;
  unreadCount: number;
  userInitials: string;
  isAdmin?: boolean;
}

export function AppShell({
  children,
  interests,
  activeFilter,
  unreadCount,
  userInitials,
  isAdmin = false,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#f8f7f4] flex flex-col">
      <TopNav unreadCount={unreadCount} userInitials={userInitials} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar interests={interests} activeFilter={activeFilter} isAdmin={isAdmin} />

        <main className="flex-1 overflow-y-auto pb-[56px] lg:pb-0">
          {children}
        </main>
      </div>

      <BottomNav unreadCount={unreadCount} />
    </div>
  );
}
