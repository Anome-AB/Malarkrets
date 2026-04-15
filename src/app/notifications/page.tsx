import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getUserShellData } from "@/lib/queries/user-shell-data";
import { getRecentNotifications } from "@/lib/queries/notifications";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationsClient } from "./notifications-client";
import type { NotificationItem } from "@/components/notifications/notification-list";
import type { NotificationType } from "@/lib/notifications/copy";

export const metadata: Metadata = {
  title: "Notiser - Mälarkrets",
};

export default async function NotificationsPage() {
  const user = await requireAuth();
  const shellData = await getUserShellData(user.id);

  if (!shellData.userProfile) {
    redirect("/api/auth/signout");
  }

  const rows = await getRecentNotifications(user.id!, 50);
  const items: NotificationItem[] = rows.map((r) => ({
    id: r.id,
    type: r.type as NotificationType,
    activityId: r.activityId,
    activityTitle: r.activityTitle,
    params: (r.params as Record<string, unknown> | null) ?? null,
    read: r.read ?? false,
    createdAt: r.createdAt!,
  }));

  return (
    <AppShell
      interests={shellData.interests}
      unreadCount={shellData.unreadCount}
      userInitials={shellData.initials}
      isAdmin={shellData.isAdmin}
    >
      <NotificationsClient items={items} />
    </AppShell>
  );
}
