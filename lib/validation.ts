// My Maps URL guard — the security spine of the My Maps constraint (CON-001,
// SEC-003). A trip's map is user-supplied data: the user pastes a Google My Maps
// share/embed link, we store the string and render it in an <iframe>. Because
// that string becomes an iframe src, validation must accept ONLY genuine Google
// My Maps links (host + path allow-list) and reject everything else.

// My Maps lives only on these Google hosts; exact-match (no subdomain) defeats
// look-alikes such as `www.google.com.evil.com`.
const ALLOWED_HOSTS = new Set(["www.google.com", "google.com"]);

// All My Maps URLs share the `/maps/d/` path prefix (view/edit/embed/viewer,
// optionally under a `/u/<n>/` account segment). A regular Maps place URL
// (`/maps/place/...`) is NOT My Maps and is rejected.
const MY_MAPS_PATH_PREFIX = "/maps/d/";

/**
 * True only for a genuine Google My Maps URL: HTTPS, a Google host, a `/maps/d/`
 * path, and a non-empty `mid` (the map id the iframe needs). Everything else —
 * other hosts, `javascript:`, plain Maps links, missing `mid` — is rejected.
 */
export function validateMyMapsUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return false;
  if (!parsed.pathname.startsWith(MY_MAPS_PATH_PREFIX)) return false;

  const mid = parsed.searchParams.get("mid");
  // Genuine My Maps ids are URL-safe (alphanumerics, `-`, `_`). Constraining the
  // charset keeps a corrupted/hostile `mid` out of the embed src (REQ-002 / BUG-002).
  return mid !== null && /^[A-Za-z0-9_-]+$/.test(mid);
}

/**
 * Convert any valid My Maps URL (view / edit / viewer / u-0 variant) into the
 * canonical embed form used as the iframe `src`. Throws if the input is not a
 * valid My Maps URL — call {@link validateMyMapsUrl} first for inline feedback.
 */
export function toMyMapsEmbedUrl(url: string): string {
  if (!validateMyMapsUrl(url)) {
    throw new Error("Not a valid Google My Maps URL");
  }
  const mid = new URL(url).searchParams.get("mid");
  // Normalize host + path so the rendered iframe is always the canonical embed
  // endpoint regardless of which share/view variant the user pasted. Encode the
  // mid so it can never alter the URL structure (REQ-002 / BUG-002).
  return `https://www.google.com/maps/d/embed?mid=${encodeURIComponent(mid!)}`;
}
