import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

// The API Gateway Cognito JWT authorizer gates the mutating routes, so by the
// time a protected handler runs the token is already verified. These helpers
// read the verified claims; the Lambda still enforces *ownership* by comparing
// `sub` to the resource's authorId/userId (PAT-002, the second auth layer).

type EventWithClaims = {
  requestContext?: {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
};

function claims(
  event: EventWithClaims | APIGatewayProxyEventV2WithJWTAuthorizer,
): Record<string, unknown> | undefined {
  return event.requestContext?.authorizer?.jwt?.claims;
}

/** Verified Cognito `sub` of the caller, or undefined if absent. */
export function getUserSub(
  event: EventWithClaims | APIGatewayProxyEventV2WithJWTAuthorizer,
): string | undefined {
  const sub = claims(event)?.sub;
  return typeof sub === "string" ? sub : undefined;
}

/** Best-effort PUBLIC author label (name, else cognito:username, else sub) — never email. */
export function getDisplayName(
  event: EventWithClaims | APIGatewayProxyEventV2WithJWTAuthorizer,
): string {
  const c = claims(event) ?? {};
  // Never fall back to `email`: authorName is rendered on the public share page
  // (components/TripDetail.tsx), so an email would be exposed to anonymous
  // visitors (REQ-001 / BUG-001).
  for (const key of ["name", "cognito:username", "sub"]) {
    const value = c[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "Unknown";
}
