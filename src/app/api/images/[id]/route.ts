import { db } from "@/lib/db";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = await db
    .select({ data: images.data, contentType: images.contentType })
    .from(images)
    .where(eq(images.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(row.data, {
    headers: {
      "Content-Type": row.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
