import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// The coach page is gated here; /api/coach gates itself, because a redirect to
// /login is something fetch follows silently and hands back as 200 HTML.
const protectedRoutePrefixes = ["/train", "/dashboard", "/settings", "/coach", "/play"];

function isProtectedPath(pathname: string): boolean {
  return protectedRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectWithCookies(url: URL, response: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedPath = isProtectedPath(pathname);
  const loginPath = pathname === "/login";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    if (!protectedPath) return NextResponse.next({ request });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "supabase-config");
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const claimsResult = await supabase.auth.getClaims().catch(() => null);
  const claims = claimsResult?.data?.claims;
  const authenticated = Boolean(claims?.sub) && claims?.is_anonymous !== true;

  if (protectedPath && !authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return redirectWithCookies(loginUrl, response);
  }

  if (loginPath && authenticated) {
    const requestedPath = request.nextUrl.searchParams.get("next");
    const safePath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/train";
    return redirectWithCookies(new URL(safePath, request.url), response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
