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

  // Redirect unauthenticated users to the login page. Return-to-origin after
  // sign-in is out of scope for M1: the OAuth flow lands on the configured
  // redirect URL, so deep-link return would need its own state handling and
  // can be added later if the product calls for it.
  return NextResponse.redirect(new URL("/login", request.url));
}

// Protected subtrees only. The public trip detail view (/trip/[id], singular),
// the home/listing page (/), and static assets are not matched, so they bypass
// the guard entirely.
export const config = {
  matcher: ["/trips/:path*", "/my-trips/:path*", "/saved/:path*"],
};
