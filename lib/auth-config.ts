export type GoogleProviderEnabled = "true" | "false" | "unknown";

export type AuthConfigInput = {
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
  domain: string;
  googleProviderEnabled: GoogleProviderEnabled;
};

export type AuthConfigStatus = {
  configured: boolean;
  message: string | null;
};

const REQUIRED_FIELDS: Array<[keyof AuthConfigInput, string]> = [
  ["userPoolId", "user pool ID"],
  ["userPoolClientId", "user pool client ID"],
  ["identityPoolId", "identity pool ID"],
  ["domain", "hosted UI domain"],
];

export function getGoogleProviderEnabled(
  value: string | undefined,
): GoogleProviderEnabled {
  if (value === "true" || value === "false") return value;
  return "unknown";
}

export function getAuthConfigStatus(config: AuthConfigInput): AuthConfigStatus {
  const missing = REQUIRED_FIELDS.filter(([key]) => !config[key].trim()).map(
    ([, label]) => label,
  );

  if (missing.length > 0) {
    return {
      configured: false,
      message: `Google sign-in is not configured. Missing Cognito env vars: ${missing.join(", ")}.`,
    };
  }

  if (config.googleProviderEnabled === "false") {
    return {
      configured: false,
      message:
        "Google sign-in is not enabled for this Cognito app client. Finish the Google OAuth/IdP apply, then redeploy the app.",
    };
  }

  return { configured: true, message: null };
}
