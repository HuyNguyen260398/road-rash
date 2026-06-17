import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { runWithAmplifyServerContext } from "@/lib/amplify-server-utils";
import { routing } from "@/i18n/routing";

// next-intl locale detection/routing. Runs on every matched request and may
// return a redirect (e.g. "/" -> "/en"), a rewrite, or NextResponse.next()
// with the NEXT_LOCALE cookie + headers set.
const handleI18nRouting = createMiddleware(routing);

// Authenticated subtrees, AFTER the locale prefix (e.g. /en/trips, /vi/saved).
// Built from routing.locales so it stays in sync with the configured locales.
const PROTECTED = new RegExp(
  `^/(${routing.locales.join("|")})/(trips|my-trips|saved)(/|$)`,
);

// Route guard for authenticated areas (TASK-014), now composed with i18n
// locale routing. Public browsing stays open (REQ-002): only the PROTECTED
// subtrees are auth-checked. Auth is verified via fetchAuthSession inside an
// isolated per-request server context using the official adapter pattern
// (RISK-009) — never the global singleton. Uses Next 16's `proxy` convention.
export async function proxy(request: NextRequest) {
  // 1) Locale routing first; thread its response through so the locale cookie
  //    and headers survive the auth check below.
  const response = handleI18nRouting(request);

  // 2) Only guard the protected subtrees; everything else gets the i18n
  //    response as-is (incl. the "/" -> "/<locale>" redirect for un-prefixed
  //    paths, which the next request will then re-evaluate against PROTECTED).
  if (!PROTECTED.test(request.nextUrl.pathname)) {
    return response;
  }

  const authenticated = await runWithAmplifyServerContext({
    nextServerContext: { request, response },
    operation: async (contextSpec) => {
      try {
        const session = await fetchAuthSession(contextSpec);
        // Tokens are present only for an authenticated, unexpired session.
        return session.tokens !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (authenticated) {
    return response;
  }

  // Locale-aware redirect to the sign-in page (login now lives under [locale]).
  const locale = request.nextUrl.pathname.split("/")[1];
  return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
}

// next-intl must see all routes for locale detection/prefixing; the auth guard
// is gated to PROTECTED above. The "/" path is intentionally NOT excluded so
// the Cognito redirect (/?code=...) gets locale-routed to /<locale>?code=...
export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
