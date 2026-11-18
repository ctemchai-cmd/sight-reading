import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession, safeNextPath } from "@/lib/auth";

// The coach page is gated here; /api/coach gates itself, because a redirect to
// /login is something fetch follows silently and hands back as 200 HTML.
const protectedRoutePrefixes = ["/train", "/settings", "/coach", "/play"];

function isProtectedPath(pathname: string): boolean {
  return protectedRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = isValidSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (isProtectedPath(pathname) && !authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
