import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication.
  // /api/images: activity images are served as bytea from the DB via a public
  //   endpoint (same publicness model as the old MinIO bucket). UUIDs are
  //   unguessable, so "unlisted public" is fine for this content.
  // /api/health: container healthcheck and external monitoring — must not
  //   redirect (a 307 passes `wget --spider` but hides real failures).
  // /nyheter: release notes for testers. Linked from the site-banner which
  //   also renders for unauthenticated visitors — login-wall makes no sense.
  const publicPatterns = [
    /^\/auth(\/|$)/,
    /^\/api\/auth(\/|$)/,
    /^\/api\/images(\/|$)/,
    /^\/api\/health(\/|$)/,
    /^\/activity(\/|$)/,
    /^\/nyheter(\/|$)/,
    /^\/$/,
  ];

  const isPublic = publicPatterns.some((pattern) => pattern.test(pathname));
  if (isPublic) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public assets with file extensions
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
