import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { courageMessages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Ej inloggad" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const audience = searchParams.get("audience") ?? "alla";

  const messages = await db
    .select({ id: courageMessages.id, message: courageMessages.message })
    .from(courageMessages)
    .where(eq(courageMessages.audience, audience));

  return Response.json({ messages: messages.map((m) => m.message) });
}
