import { NextResponse } from "next/server";
import postgres from "postgres";

export async function GET() {
  try {
    const sql = postgres(process.env.DATABASE_URL!, {
      connect_timeout: 5,
      idle_timeout: 5,
      max: 1,
    });
    await sql`SELECT 1`;
    await sql.end();
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
