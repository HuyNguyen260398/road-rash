import { randomUUID } from "node:crypto";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { error, json } from "../shared/http";
import { getUserSub } from "../shared/auth";

// Presign handler. Two routes:
//   POST /uploads/presign   (JWT)    — short-lived PUT URL for a thumbnail
//                                       upload, key scoped to the caller's sub.
//   GET  /uploads/thumbnail (public) — short-lived GET URL to render a stored
//                                       thumbnail on the (public) card grid.
// Size/type are enforced here server-side (SEC-004); the client also pre-checks.

const BUCKET = process.env.THUMBNAILS_BUCKET ?? "";
// Must stay within the prefix the presign IAM role is scoped to (iam module).
const PREFIX = process.env.THUMBNAIL_PREFIX ?? "thumbnails/";
const MAX_UPLOAD_BYTES = Number(
  process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024,
);
const UPLOAD_URL_TTL = 300; // 5 min — long enough to PUT, short enough to limit reuse.
const GET_URL_TTL = 3600; // 1 hour — cards re-fetch on next load.

// image/* allow-list → file extension. Anything else is rejected (SEC-004).
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const s3 = new S3Client({});

async function createUploadUrl(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  const sub = getUserSub(event);
  if (!sub) return error(401, "Unauthenticated");

  let body: Record<string, unknown>;
  try {
    body = event.body
      ? (JSON.parse(event.body) as Record<string, unknown>)
      : {};
  } catch {
    return error(400, "Request body must be valid JSON");
  }

  const contentType =
    typeof body.contentType === "string" ? body.contentType : "";
  const size = Number(body.size);

  const ext = ALLOWED_CONTENT_TYPES[contentType];
  if (!ext) {
    return error(415, "contentType must be one of image/jpeg, png, webp, gif");
  }
  if (!Number.isFinite(size) || size <= 0) {
    return error(400, "size (bytes) is required");
  }
  if (size > MAX_UPLOAD_BYTES) {
    return error(413, `File exceeds the ${MAX_UPLOAD_BYTES}-byte limit`);
  }

  // Caller-scoped key: <prefix><sub>/<uuid>.<ext>. Ownership in the path keeps a
  // user's uploads under their own namespace within the bucket prefix.
  const key = `${PREFIX}${sub}/${randomUUID()}.${ext}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: UPLOAD_URL_TTL },
  );

  return json(200, { uploadUrl, key, expiresIn: UPLOAD_URL_TTL });
}

async function createThumbnailUrl(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  const key = event.queryStringParameters?.key ?? "";
  // Only sign reads within the thumbnail prefix — never arbitrary bucket keys.
  if (!key || !key.startsWith(PREFIX)) {
    return error(400, "A valid thumbnail key is required");
  }

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: GET_URL_TTL },
  );

  return json(200, { url, expiresIn: GET_URL_TTL });
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    switch (event.routeKey) {
      case "POST /uploads/presign":
        return await createUploadUrl(event);
      case "GET /uploads/thumbnail":
        return await createThumbnailUrl(event);
      default:
        return error(404, `Unsupported route: ${event.routeKey}`);
    }
  } catch (err) {
    console.error("presign handler error", err);
    return error(500, "Internal server error");
  }
}
