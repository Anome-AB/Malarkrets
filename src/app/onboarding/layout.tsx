import { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { getUserShellData } from "@/lib/queries/user-shell-data";
import { AppShell } from "@/components/layout/app-shell";

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  // Onboarding may be accessed before user has interests, so shell data might be minimal
  if (session?.user?.id) {
    const shellData = await getUserShellData(session.user.id);
    return (
      <AppShell
        interests={shellData.interests}
        unreadCount={shellData.unreadCount}
        userInitials={shellData.initials}
        isAdmin={shellData.isAdmin}
      >
        {children}
      </AppShell>
    );
  }

  // Unauthenticated - render without shell
  return <>{children}</>;
}
