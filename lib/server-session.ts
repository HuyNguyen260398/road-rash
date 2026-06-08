import "server-only";
import { cookies } from "next/headers";
import { fetchAuthSession } from "aws-amplify/auth/server";
import { runWithAmplifyServerContext } from "./amplify-server-utils";

// Server-side Cognito session reader for auth-gated pages (new/edit/my-trips).
// Reads the cookie-backed session through createServerRunner's isolated
// per-request context (RISK-009) — never the global Amplify singleton.

export type ServerSession = {
  /** Cognito `sub` — compare to a trip's authorId for ownership gating. */
  sub: string;
  /** ID token string to pass as the bearer for SSR-side authenticated calls. */
  idToken: string;
  name?: string;
  email?: string;
};

export async function getServerSession(): Promise<ServerSession | null> {
  return runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: async (contextSpec) => {
      try {
        const session = await fetchAuthSession(contextSpec);
        const idToken = session.tokens?.idToken;
        const sub = idToken?.payload.sub;
        if (!idToken || typeof sub !== "string") return null;

        const name = idToken.payload.name;
        const email = idToken.payload.email;
        return {
          sub,
          idToken: idToken.toString(),
          name: typeof name === "string" ? name : undefined,
          email: typeof email === "string" ? email : undefined,
        };
      } catch {
        // No / invalid session — treated as signed out.
        return null;
      }
    },
  });
}
