"use client";

// Importing the config module for its side effect runs Amplify.configure once
// on the client. Rendering null keeps this a pure configuration mount point.
import "@/lib/amplify-config";
// Register Amplify's OAuth redirect-completion listener on EVERY client page.
// This side-effect import is what hooks `attemptCompleteOAuthFlow` into the
// Amplify singleton; without it, the listener is only registered on pages that
// import `signInWithRedirect` (i.e. /login). Our Cognito redirect lands on "/",
// which does not import signInWithRedirect — so the ?code=... was never
// exchanged for tokens and sign-in silently no-op'd. (Amplify v6 invokes the
// listener regardless of whether it's added before or after Amplify.configure.)
import "aws-amplify/auth/enable-oauth-listener";

export default function ConfigureAmplifyClientSide() {
  return null;
}
