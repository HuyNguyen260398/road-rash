import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

// HTTP response helpers for the handlers. CORS is configured at the API Gateway
// layer (apigateway module cors_configuration), so handlers don't set CORS
// headers themselves.

export function json(
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function noContent(): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 204, body: "" };
}

export function error(
  statusCode: number,
  message: string,
): APIGatewayProxyStructuredResultV2 {
  return json(statusCode, { message });
}
