import { createServerRunner } from "@aws-amplify/adapter-nextjs";
import { amplifyConfig } from "@/lib/amplify-config";

// SSR context runner (createServerRunner) built from the SAME config object as
// the client (lib/amplify-config.ts). Server components, route handlers, and
// middleware use this to read the Cognito session from cookies in an isolated
// per-request context — never the global Amplify singleton (RISK-009).
export const { runWithAmplifyServerContext } = createServerRunner({
  config: amplifyConfig,
});
