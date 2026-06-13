"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAuthSession,
  getCurrentUser,
  signInWithRedirect,
  signOut,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { authConfigStatus } from "@/lib/amplify-config";

type AuthState = {
  username: string;
  email?: string;
};

export default function LoginPage() {
  const [user, setUser] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const visibleError =
    error ?? (!authConfigStatus.configured ? authConfigStatus.message : null);

  const refreshUser = useCallback(async () => {
    try {
      const current = await getCurrentUser();
      const session = await fetchAuthSession();
      const email = session.tokens?.idToken?.payload.email;
      setUser({
        username: current.username,
        email: typeof email === "string" ? email : undefined,
      });
    } catch {
      // No authenticated user — expected when signed out.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Bootstrap session on mount. refreshUser awaits before any setState, so
    // the state updates are async (post-await), not the synchronous cascade
    // this rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUser();

    // React to the redirect coming back from the Hosted UI / Google.
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
        case "signInWithRedirect":
          void refreshUser();
          break;
        case "signedOut":
          setUser(null);
          break;
        case "signInWithRedirect_failure":
          setError("Sign-in failed. Please try again.");
          break;
      }
    });

    return unsubscribe;
  }, [refreshUser]);

  const handleSignIn = async () => {
    setError(null);
    if (!authConfigStatus.configured) {
      setError(authConfigStatus.message);
      return;
    }

    try {
      await signInWithRedirect({ provider: "Google" });
    } catch {
      setError("Could not start sign-in. Please try again.");
    }
  };

  const handleSignOut = async () => {
    setError(null);
    try {
      await signOut();
    } catch {
      setError("Could not sign out. Please try again.");
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-black/10 p-8 text-center dark:border-white/15">
        <h1 className="text-2xl font-semibold">Sign in to road-rash</h1>

        {loading ? (
          <p className="text-sm opacity-70">Checking your session…</p>
        ) : user ? (
          <div className="space-y-4">
            <p className="text-sm opacity-80">
              Signed in as{" "}
              <span className="font-medium">{user.email ?? user.username}</span>
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSignIn}
            disabled={!authConfigStatus.configured}
            className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue with Google
          </button>
        )}

        {visibleError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {visibleError}
          </p>
        ) : null}
      </div>
    </main>
  );
}
