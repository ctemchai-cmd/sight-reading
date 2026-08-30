import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const protectedRoutePrefixes = ["/train", "/dashboard", "/settings"];

function isProtectedPath(pathname: string): boolean {
  return protectedRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function getAllowedEmails(): Set<string> {
  return new Set(
    (process.env.PRIVATE_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
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

  if (pathname === "/signup") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "invite-only");
    return NextResponse.redirect(loginUrl);
  }

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
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase() : null;
  const allowedEmails = getAllowedEmails();
  const authenticated = Boolean(claims?.sub) && claims?.is_anonymous !== true;
  const authorized = authenticated && email !== null && allowedEmails.has(email);

  if (protectedPath && !authorized) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    if (authenticated && allowedEmails.size === 0) loginUrl.searchParams.set("error", "access-config");
    else if (authenticated) loginUrl.searchParams.set("error", "unauthorized");
    return redirectWithCookies(loginUrl, response);
  }

  if (loginPath && authorized) {
    const requestedPath = request.nextUrl.searchParams.get("next");
    const safePath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/train";
    return redirectWithCookies(new URL(safePath, request.url), response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
