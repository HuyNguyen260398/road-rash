import type { Trip, TripInput } from "../lib/types";

// Backfills thumbnails for the seeded test trips (which render the placeholder
// because no thumbnailKey was set). For each trip without a thumbnail it:
//   1. resolves a curated Wikipedia title -> a CC-licensed lead image (via the
//      MediaWiki pageimages API, sized to ~1024px),
//   2. POSTs /uploads/presign for a short-lived PUT URL (key scoped to the
//      caller's sub),
//   3. PUTs the image bytes straight to S3,
//   4. PUTs /trips/{id} with the existing fields + the new thumbnailKey.
//
// Only trips WITHOUT a thumbnail are touched, so it is safe to re-run (e.g. to
// recover from a mid-run throttle). Run like the other seed scripts — see
// scripts/README-seed.md — with API_BASE_URL + ID_TOKEN in the env. The token's
// sub must own the trips (the seeds are authored by whoever seeded them).

// Curated Wikipedia article title per seeded trip name. Chosen for an accurate,
// recognisable lead image of the location. A trip whose name is absent here is
// skipped with a warning (so unrelated trips are never touched).
const TITLE_BY_NAME: Record<string, string> = {
  // Vietnam (seed-trips.ts)
  "Ha Giang Loop Adventure": "Hà Giang province",
  "Da Lat Coffee Country Ride": "Da Lat",
  "Mui Ne Coastal Cruise": "Mui Ne",
  "Mekong Delta Slow Roll": "Mekong Delta",
  "Sapa Terraces Trek Drive": "Sa Pa",
  "Hoi An Old Town Pedal": "Chùa Cầu",
  "Phong Nha Cave Country": "Phong Nha-Kẻ Bàng National Park",
  "Nha Trang Bay Drive": "Nha Trang",
  "Pleiku Highland Crossing": "Pleiku",
  "Cat Ba Island Explorer": "Cát Bà Island",
  "Saigon Street Food Spin": "Ho Chi Minh City",
  // Rest of Asia (seed-more-trips.ts)
  "Chiang Mai Temple Loop": "Chiang Mai",
  "Pai Mountain Retreat": "Pai District",
  "Bali Coastal Escape": "Uluwatu Temple",
  "Kyoto Heritage Walk": "Kyoto",
  "Hokkaido Powder Run": "Niseko, Hokkaido",
  "Luang Prabang River Trail": "Luang Prabang",
  "Siem Reap Temple Circuit": "Angkor Wat",
  "Penang Street Food Tour": "George Town, Penang",
  "Boracay Island Hop": "Boracay",
  "El Nido Lagoon Camp": "El Nido, Palawan",
  "Taroko Gorge Drive": "Taroko National Park",
  "Seoul City Lights": "Seoul",
  // Rest of the world (seed-even-more-trips.ts)
  "Amalfi Coast Drive": "Amalfi Coast",
  "Tuscany Vineyard Loop": "Tuscany",
  "Scottish Highlands Run": "Scottish Highlands",
  "Andalusia White Villages": "Ronda",
  "Bavarian Alps Escape": "Berchtesgaden",
  "Norwegian Fjords Ferry Trip": "Geirangerfjord",
  "Provence Lavender Pedal": "Valensole",
  "Iceland Ring Road": "Skógafoss",
  "Pacific Coast Highway": "Big Sur",
  "Utah Canyon Camping": "Zion National Park",
  "Banff Rockies Drive": "Banff National Park",
  "Patagonia Trail Camp": "Torres del Paine National Park",
  "Mexico City Taco Crawl": "Mexico City",
  "Rio Beaches Cruise": "Copacabana, Rio de Janeiro",
  "Cusco to Sacred Valley": "Cusco",
  "Great Ocean Road": "Great Ocean Road",
  "Outback Red Centre Run": "Uluru",
  "South Island Alpine Loop": "Queenstown, New Zealand",
  "Cape Town Coastal Drive": "Cape Town",
  "Marrakech Medina Wander": "Marrakesh",
  "Atlas Mountains Berber Trek": "Atlas Mountains",
  "Wadi Rum Desert Camp": "Wadi Rum",
  "Cappadocia Valley Ride": "Cappadocia",
  "Tbilisi to Kazbegi": "Gergeti Trinity Church",
};

// image/* the presign allow-list accepts (services/presign/handler.ts).
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Wikimedia asks API clients to send a descriptive User-Agent.
const USER_AGENT =
  "road-rash-seed-thumbnails/1.0 (https://github.com/HuyNguyen260398/road-rash)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retry helper for the API Gateway calls, which throttle (429) under a burst.
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number }).status;
      if (status !== 429 && status !== 503) throw err;
      const backoff = 500 * 2 ** i;
      console.warn(
        `  ${label} throttled (${status}); retrying in ${backoff}ms`,
      );
      await sleep(backoff);
    }
  }
  throw lastErr;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Resolve a Wikipedia title to a sized lead-image URL via the pageimages API.
async function resolveImageUrl(title: string): Promise<string | undefined> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "pageimages",
    piprop: "thumbnail|original",
    pithumbsize: "1024",
    redirects: "1",
    titles: title,
  });
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?${params.toString()}`,
    { headers: { "User-Agent": USER_AGENT } },
  );
  if (!res.ok) throw new HttpError(res.status, `wiki query ${res.status}`);
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { thumbnail?: { source: string } }> };
  };
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0];
  return page?.thumbnail?.source;
}

function contentTypeFor(res: Response, url: string): string | undefined {
  const header = (res.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (ALLOWED_CONTENT_TYPES.has(header)) return header;
  const ext = url.split(".").pop()?.toLowerCase();
  const byExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return ext ? byExt[ext] : undefined;
}

async function downloadImage(
  url: string,
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new HttpError(res.status, `image GET ${res.status}`);
  const contentType = contentTypeFor(res, url);
  if (!contentType) {
    throw new Error(`unsupported content type for ${url}`);
  }
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(
      `image is ${bytes.byteLength} bytes, over the ${MAX_UPLOAD_BYTES} limit`,
    );
  }
  return { bytes, contentType };
}

async function main(): Promise<void> {
  const apiBase = process.env.API_BASE_URL;
  const token = process.env.ID_TOKEN;
  if (!apiBase || !token) {
    throw new Error(
      "Set API_BASE_URL and ID_TOKEN — see scripts/README-seed.md",
    );
  }
  const base = apiBase.replace(/\/$/, "");
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const listRes = await fetch(`${base}/trips`);
  if (!listRes.ok) throw new Error(`GET /trips failed: ${listRes.status}`);
  const { trips } = (await listRes.json()) as { trips: Trip[] };
  const pending = trips.filter((t) => !t.thumbnailKey);
  console.log(
    `${trips.length} trips total; ${pending.length} without a thumbnail.`,
  );

  let done = 0;
  let skipped = 0;
  for (const trip of pending) {
    const title = TITLE_BY_NAME[trip.name];
    if (!title) {
      console.warn(`skip (no title mapped): ${trip.name}`);
      skipped++;
      continue;
    }

    try {
      const imageUrl = await withRetry("wiki", () => resolveImageUrl(title));
      if (!imageUrl) {
        console.warn(`skip (no Wikipedia image): ${trip.name} -> ${title}`);
        skipped++;
        continue;
      }
      const { bytes, contentType } = await downloadImage(imageUrl);

      // 1. presigned PUT URL (key scoped to the caller's sub).
      const presign = await withRetry("presign", async () => {
        const res = await fetch(`${base}/uploads/presign`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ contentType, size: bytes.byteLength }),
        });
        if (!res.ok) {
          throw new HttpError(res.status, await res.text());
        }
        return (await res.json()) as { uploadUrl: string; key: string };
      });

      // 2. upload the bytes straight to S3 (must match the signed ContentType).
      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: bytes,
      });
      if (!putRes.ok) {
        throw new Error(`S3 PUT failed: ${putRes.status}`);
      }

      // 3. attach the thumbnailKey to the trip (full TripInput on PUT).
      const update: TripInput = {
        name: trip.name,
        description: trip.description,
        location: trip.location,
        tripType: trip.tripType,
        city: trip.city,
        province: trip.province,
        country: trip.country,
        durationDays: trip.durationDays,
        vehicle: trip.vehicle,
        myMapsUrl: trip.myMapsUrl,
        thumbnailKey: presign.key,
      };
      await withRetry("update", async () => {
        const res = await fetch(`${base}/trips/${trip.id}`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify(update),
        });
        if (!res.ok) {
          throw new HttpError(res.status, await res.text());
        }
      });

      console.log(`thumbnailed: ${trip.name}  (${title})`);
      done++;
    } catch (err) {
      console.error(`FAILED: ${trip.name} -> ${title}:`, err);
      skipped++;
    }

    // Gentle pacing to stay under the API Gateway burst limit.
    await sleep(400);
  }

  console.log(`Done — ${done} thumbnailed, ${skipped} skipped.`);
}

// `import.meta.url` matches the invoked file only when run directly via tsx.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { TITLE_BY_NAME };
