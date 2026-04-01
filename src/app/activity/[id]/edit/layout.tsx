import { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserShellData } from "@/lib/queries/user-shell-data";
import { AppShell } from "@/components/layout/app-shell";

export default async function EditActivityLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const shellData = await getUserShellData(session.user.id);

  return (
    <AppShell
      interests={shellData.interests}
      activeFilter={null}
      unreadCount={shellData.unreadCount}
      userInitials={shellData.initials}
      isAdmin={shellData.isAdmin}
    >
      {children}
    </AppShell>
  );
}
