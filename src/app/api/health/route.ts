import { NextResponse } from "next/server";
import postgres from "postgres";
import { log, errAttrs } from "@/lib/logger";

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
  } catch (err) {
    // This endpoint is polled frequently by Caddy's healthcheck — a
    // single failure is noisy but a sustained stream means real DB
    // trouble. Dash0 alerts should fire on >N/minute.
    log.error("health: db ping failed", errAttrs(err));
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
