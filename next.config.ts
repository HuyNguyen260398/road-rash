import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Content-Security-Policy for the deployed app. Pragmatic-but-enforcing: it
// allows exactly what road-rash needs and nothing else.
//
//   script/style 'unsafe-inline' — next-themes injects an inline theme script to
//     avoid a flash-of-wrong-theme, and Next.js + Tailwind emit inline hydration
//     scripts / styles. Without a per-request nonce (which would require
//     middleware) these need 'unsafe-inline'. 'unsafe-eval' is intentionally NOT
//     granted (production bundles don't need it).
//   frame-src https://www.google.com — the read-only My Maps embed iframe (the
//     src is already host-validated to Google in lib/validation.ts).
//   *.amazonaws.com — API Gateway (execute-api), S3 presigned GET/PUT, and the
//     Cognito IDP/identity endpoints the Amplify Auth client calls.
//   *.amazoncognito.com — the Cognito Hosted UI (OAuth sign-in redirect target).
//   frame-ancestors 'self' — clickjacking protection (complements X-Frame-Options).
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.amazonaws.com https://*.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.amazonaws.com https://*.amazoncognito.com",
  "frame-src https://www.google.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self' https://*.amazoncognito.com",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Applied to every route. Next.js emits these on SSR responses, and AWS Amplify
// Hosting's Next.js compute serves them as-is (the framework owns the response).
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
