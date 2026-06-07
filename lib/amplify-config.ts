import { Amplify } from "aws-amplify";
import type { ResourcesConfig } from "aws-amplify";

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

export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "",
      userPoolClientId:
        process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID ?? "",
      identityPoolId: process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID ?? "",
      loginWith: {
        oauth: {
          domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "",
          scopes: ["openid", "email", "profile"],
          redirectSignIn: redirectUrls,
          redirectSignOut: redirectUrls,
          responseType: "code",
        },
      },
    },
  },
};

// Side effect: configure the global Amplify singleton for client-side use.
// `ssr: true` enables cookie-backed token storage so the SSR adapter
// (lib/amplify-server-utils.ts) can read the session on the server.
Amplify.configure(amplifyConfig, { ssr: true });
