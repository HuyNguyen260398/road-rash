import { type NextRequest, NextResponse } from "next/server";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { runWithAmplifyServerContext } from "@/lib/amplify-server-utils";

// Route guard for authenticated areas (TASK-014). Public browsing stays open
// (REQ-002): only the matcher-listed prefixes reach this proxy. Auth is checked
// via fetchAuthSession inside an isolated per-request server context using the
// official adapter pattern (RISK-009) — never the global singleton.
//
// Uses Next 16's `proxy` convention (the renamed successor to `middleware`).
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

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

  const loginUrl = new URL("/login", request.url);
  // Preserve where the user was headed so we can return them after sign-in.
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

// Protected subtrees only. The public trip detail view (/trip/[id], singular),
// the home/listing page (/), and static assets are not matched, so they bypass
// the guard entirely.
export const config = {
  matcher: ["/trips/:path*", "/my-trips/:path*", "/saved/:path*"],
};
