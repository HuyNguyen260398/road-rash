import { fetchAuthSession } from "aws-amplify/auth";

// Typed fetch wrapper for the REST API (M2 / TASK-021). Reads the base URL from
// the Terraform-populated env var, attaches a Cognito JWT to protected calls,
// and centralizes JSON parsing + error handling. Concrete request/response
// types and the remaining methods are filled in as routes land in M3–M6.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Parsed and JSON-stringified into the request body. */
  body?: unknown;
  /** Attach the Cognito JWT (required for mutating/owner routes). */
  auth?: boolean;
  /**
   * Pre-fetched bearer token. Pass this from SSR/server code (obtained via
   * runWithAmplifyServerContext); on the client it is fetched automatically.
   */
  token?: string;
  /** Extra query params appended to the path. */
  query?: Record<string, string | undefined>;
};

async function resolveToken(
  options: ApiFetchOptions,
): Promise<string | undefined> {
  if (options.token) return options.token;
  // Auto-fetch only in the browser; server callers must pass `token`.
  if (!options.auth || typeof window === "undefined") return undefined;
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString();
}

function buildUrl(path: string, query?: ApiFetchOptions["query"]): string {
  const url = new URL(path.replace(/^\//, ""), `${API_BASE_URL}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(0, "NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const token = await resolveToken(options);
  if (options.auth && !token) {
    throw new ApiError(
      401,
      "Authentication required but no session token found",
    );
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const message =
      (data as { message?: string } | undefined)?.message ??
      `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message, data);
  }

  return data as T;
}

// --- Typed methods (request/response types refined as routes land in M3+) ---
// Public GET routes need no auth; mutating routes set `auth: true` so the JWT
// is attached and the API Gateway authorizer + Lambda owner check apply.
export const api = {
  // Public browsing (REQ-002).
  getTrips: (query?: Record<string, string | undefined>) =>
    apiFetch<unknown>("/trips", { query }),
  getTrip: (id: string) => apiFetch<unknown>(`/trips/${id}`),

  // Authenticated mutations (REQ-003) — wired in M3.
  createTrip: (body: unknown) =>
    apiFetch<unknown>("/trips", { method: "POST", body, auth: true }),
  updateTrip: (id: string, body: unknown) =>
    apiFetch<unknown>(`/trips/${id}`, { method: "PUT", body, auth: true }),
  deleteTrip: (id: string) =>
    apiFetch<unknown>(`/trips/${id}`, { method: "DELETE", auth: true }),
};
