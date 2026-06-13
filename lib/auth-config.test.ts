import { describe, expect, it } from "vitest";
import { getAuthConfigStatus } from "./auth-config";

describe("getAuthConfigStatus", () => {
  it("reports missing Cognito environment variables", () => {
    expect(
      getAuthConfigStatus({
        userPoolId: "",
        userPoolClientId: "",
        identityPoolId: "",
        domain: "",
        googleProviderEnabled: "unknown",
      }),
    ).toEqual({
      configured: false,
      message:
        "Google sign-in is not configured. Missing Cognito env vars: user pool ID, user pool client ID, identity pool ID, hosted UI domain.",
    });
  });

  it("reports when Google is explicitly disabled for the Cognito app client", () => {
    expect(
      getAuthConfigStatus({
        userPoolId: "ap-southeast-1_abc",
        userPoolClientId: "client",
        identityPoolId: "ap-southeast-1:identity",
        domain: "road-rash-staging.auth.ap-southeast-1.amazoncognito.com",
        googleProviderEnabled: "false",
      }),
    ).toEqual({
      configured: false,
      message:
        "Google sign-in is not enabled for this Cognito app client. Finish the Google OAuth/IdP apply, then redeploy the app.",
    });
  });

  it("allows sign-in when required values exist and Google is enabled or unknown", () => {
    const baseConfig = {
      userPoolId: "ap-southeast-1_abc",
      userPoolClientId: "client",
      identityPoolId: "ap-southeast-1:identity",
      domain: "road-rash-staging.auth.ap-southeast-1.amazoncognito.com",
    };

    expect(
      getAuthConfigStatus({
        ...baseConfig,
        googleProviderEnabled: "true",
      }),
    ).toEqual({ configured: true, message: null });

    expect(
      getAuthConfigStatus({
        ...baseConfig,
        googleProviderEnabled: "unknown",
      }),
    ).toEqual({ configured: true, message: null });
  });
});
