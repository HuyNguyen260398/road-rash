import { Amplify } from "aws-amplify";
import type { ResourcesConfig } from "aws-amplify";
import { getAuthConfigStatus, getGoogleProviderEnabled } from "./auth-config";

// Manual Amplify configuration (GUD-001/CON-004): no amplify_outputs.json.
// Values come from NEXT_PUBLIC_* env vars populated by Terraform Cognito
// outputs (see infra/envs/*/main.tf -> amplify_environment_variables).
//
// OAuth redirect targets must also be registered in the Cognito app client's
// callback/logout URLs (infra: app_callback_urls / app_logout_urls). On the
// client we use the live origin so deployed environments self-resolve; on the
// server we fall back to NEXT_PUBLIC_APP_URL / localhost (redirects are only
// initiated client-side, so the fallback is never actually navigated to).
const appOrigin =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

const redirectUrls = [`${appOrigin}/`];

const authEnv = {
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "",
  userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID ?? "",
  identityPoolId: process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID ?? "",
  domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "",
  googleProviderEnabled: getGoogleProviderEnabled(
    process.env.NEXT_PUBLIC_COGNITO_GOOGLE_ENABLED,
  ),
};

export const authConfigStatus = getAuthConfigStatus(authEnv);

export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: authEnv.userPoolId,
      userPoolClientId: authEnv.userPoolClientId,
      identityPoolId: authEnv.identityPoolId,
      loginWith: {
        oauth: {
          domain: authEnv.domain,
          scopes: ["openid", "email", "profile"],
          redirectSignIn: redirectUrls,
          redirectSignOut: redirectUrls,
          responseType: "code",
        },
      },
    },
  },
};

// Side effect: configure the global Amplify singleton for CLIENT use only.
// Guarded to the browser so that importing `amplifyConfig` on the server (via
// lib/amplify-server-utils.ts) does NOT configure the global singleton
// server-side — SSR auth reads go through createServerRunner's isolated
// per-request context, never the shared singleton. `ssr: true` enables
// cookie-backed token storage so the server can read the session from cookies.
if (typeof window !== "undefined") {
  Amplify.configure(amplifyConfig, { ssr: true });
}
