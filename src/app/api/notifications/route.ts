import { auth } from "@/lib/auth";
import {
  getUnreadNotifications,
  getNotificationCount,
} from "@/lib/queries/notifications";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Ej inloggad" }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    getUnreadNotifications(session.user.id),
    getNotificationCount(session.user.id),
  ]);

  return Response.json({ notifications, unreadCount });
}
