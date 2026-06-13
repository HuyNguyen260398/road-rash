import type { Trip, TripInput, TripType, Vehicle } from "../lib/types";

// Seeds example trips into the staging API for testing. Eleven variations are
// derived from a template trip (the one the user already created) so they all
// embed a valid, real My Maps URL. Run with a bearer token copied from a
// signed-in browser session — see scripts/README-seed.md.

type Variation = {
  name: string;
  location: string;
  city: string;
  province: string;
  country: string;
  tripType: TripType;
  vehicle: Vehicle;
  durationDays: number;
  description: string;
};

const VARIATIONS: Variation[] = [
  { name: "Ha Giang Loop Adventure", location: "Ha Giang Loop", city: "Ha Giang", province: "Ha Giang", country: "Vietnam", tripType: "MOUNTAIN", vehicle: "MOTORBIKE", durationDays: 4, description: "Limestone peaks and switchback passes on the northern frontier loop." },
  { name: "Da Lat Coffee Country Ride", location: "Da Lat Highlands", city: "Da Lat", province: "Lam Dong", country: "Vietnam", tripType: "FOOD", vehicle: "MOTORBIKE", durationDays: 3, description: "Pine forests, waterfalls, and highland coffee farms." },
  { name: "Mui Ne Coastal Cruise", location: "Mui Ne Beach", city: "Phan Thiet", province: "Binh Thuan", country: "Vietnam", tripType: "BEACH", vehicle: "CAR", durationDays: 2, description: "Red sand dunes and a long quiet coastal road." },
  { name: "Mekong Delta Slow Roll", location: "Mekong Delta", city: "Can Tho", province: "Can Tho", country: "Vietnam", tripType: "ROAD_TRIP", vehicle: "CAR", durationDays: 3, description: "Floating markets, river ferries, and orchard backroads." },
  { name: "Sapa Terraces Trek Drive", location: "Sapa Rice Terraces", city: "Sapa", province: "Lao Cai", country: "Vietnam", tripType: "MOUNTAIN", vehicle: "CAR", durationDays: 3, description: "Terraced valleys and the climb toward Fansipan." },
  { name: "Hoi An Old Town Pedal", location: "Hoi An Ancient Town", city: "Hoi An", province: "Quang Nam", country: "Vietnam", tripType: "CITY", vehicle: "BICYCLE", durationDays: 1, description: "Lantern-lit lanes and rice-paddy bike paths." },
  { name: "Phong Nha Cave Country", location: "Phong Nha-Ke Bang", city: "Dong Hoi", province: "Quang Binh", country: "Vietnam", tripType: "CAMPING", vehicle: "MOTORBIKE", durationDays: 3, description: "Jungle karst and the world's biggest caves." },
  { name: "Nha Trang Bay Drive", location: "Nha Trang Bay", city: "Nha Trang", province: "Khanh Hoa", country: "Vietnam", tripType: "BEACH", vehicle: "CAR", durationDays: 2, description: "Island-dotted bay and a breezy coastal highway." },
  { name: "Pleiku Highland Crossing", location: "Central Highlands", city: "Pleiku", province: "Gia Lai", country: "Vietnam", tripType: "ROAD_TRIP", vehicle: "MOTORBIKE", durationDays: 4, description: "Volcanic crater lakes and red-earth plantations." },
  { name: "Cat Ba Island Explorer", location: "Cat Ba Island", city: "Cat Ba", province: "Hai Phong", country: "Vietnam", tripType: "BEACH", vehicle: "OTHER", durationDays: 2, description: "Limestone islets, hidden coves, and a national park ride." },
  { name: "Saigon Street Food Spin", location: "Ho Chi Minh City", city: "Ho Chi Minh City", province: "Ho Chi Minh City", country: "Vietnam", tripType: "FOOD", vehicle: "MOTORBIKE", durationDays: 1, description: "A loop of the city's best street-food corners." },
];

// Eleven TripInputs derived from the template. The template supplies the valid
// My Maps URL (and its optional Google Maps deep link) so each seeded trip
// renders a real map. The template's thumbnailKey is deliberately NOT reused —
// it points at the template author's private S3 object, so seeds render the
// placeholder thumbnail instead.
export function buildSeedTrips(template: TripInput): TripInput[] {
  return VARIATIONS.map((v) => ({
    name: v.name,
    description: v.description,
    location: v.location,
    tripType: v.tripType,
    city: v.city,
    province: v.province,
    country: v.country,
    durationDays: v.durationDays,
    vehicle: v.vehicle,
    myMapsUrl: template.myMapsUrl,
    ...(template.googleMapsUrl ? { googleMapsUrl: template.googleMapsUrl } : {}),
  }));
}

// --- Script entrypoint ----------------------------------------------------
// Only runs when invoked directly (not when imported by the test).
async function main(): Promise<void> {
  const apiBase = process.env.API_BASE_URL;
  const token = process.env.ID_TOKEN;
  if (!apiBase || !token) {
    throw new Error("Set API_BASE_URL and ID_TOKEN — see scripts/README-seed.md");
  }
  const base = apiBase.replace(/\/$/, "");

  // Use an existing trip as the template (for a valid My Maps URL). Fall back to
  // the first listed trip; abort if there are none.
  const listRes = await fetch(`${base}/trips`);
  if (!listRes.ok) throw new Error(`GET /trips failed: ${listRes.status}`);
  const { trips } = (await listRes.json()) as { trips: Trip[] };
  const template = trips[0];
  if (!template) {
    throw new Error("No existing trip to use as a template — create one first.");
  }

  const seeds = buildSeedTrips(template);
  for (const seed of seeds) {
    const res = await fetch(`${base}/trips`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(seed),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`POST /trips failed for "${seed.name}": ${res.status} ${body}`);
    }
    console.log(`created: ${seed.name}`);
  }
  console.log(`Done — seeded ${seeds.length} trips (total should now be 12).`);
}

// `import.meta.url` matches the invoked file only when run directly via tsx.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
