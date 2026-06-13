"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAuthSession,
  getCurrentUser,
  signInWithRedirect,
  signOut,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { AlertTriangleIcon, LogInIcon, LogOutIcon, MapIcon } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <AppShell>
      <div className="flex min-h-[calc(100dvh-9rem)] items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MapIcon className="size-6" aria-hidden />
            </div>
            <CardTitle className="text-2xl">Sign in to Road Rash</CardTitle>
            <CardDescription>
              Sign in to create routes and save your favorite trips.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {loading ? (
              <p className="text-sm text-muted-foreground">
                Checking your session…
              </p>
            ) : user ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Signed in as{" "}
                  <span className="font-medium text-foreground">
                    {user.email ?? user.username}
                  </span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full"
                >
                  <LogOutIcon className="size-4" aria-hidden />
                  Sign out
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={handleSignIn}
                disabled={!authConfigStatus.configured}
                className="w-full"
              >
                <LogInIcon className="size-4" aria-hidden />
                Continue with Google
              </Button>
            )}

            {visibleError ? (
              <p className="flex items-center justify-center gap-2 text-sm text-destructive">
                <AlertTriangleIcon className="size-4 shrink-0" aria-hidden />
                <span>{visibleError}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
