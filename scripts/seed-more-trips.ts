import { type Variation, seedVariations } from "./seed-trips";

// A second batch of 12 example trips, all outside Vietnam, to give the
// country / province / city filters and grouping real variety to test against.
// Like seed-trips.ts, each derives its map from an existing trip's My Maps URL
// (the app can't create My Maps programmatically) and renders the placeholder
// thumbnail. Run the same way — see scripts/README-seed.md.
const MORE_VARIATIONS: Variation[] = [
  {
    name: "Chiang Mai Temple Loop",
    location: "Old City Temples",
    city: "Chiang Mai",
    province: "Chiang Mai",
    country: "Thailand",
    tripType: "CITY",
    vehicle: "MOTORBIKE",
    durationDays: 2,
    description: "Moated old town, golden temples, and night-market food.",
  },
  {
    name: "Pai Mountain Retreat",
    location: "Pai Valley",
    city: "Pai",
    province: "Mae Hong Son",
    country: "Thailand",
    tripType: "MOUNTAIN",
    vehicle: "MOTORBIKE",
    durationDays: 3,
    description: "762 curves up to hot springs, canyons, and misty hills.",
  },
  {
    name: "Bali Coastal Escape",
    location: "Bukit Peninsula",
    city: "Uluwatu",
    province: "Bali",
    country: "Indonesia",
    tripType: "BEACH",
    vehicle: "CAR",
    durationDays: 4,
    description: "Clifftop temples, surf breaks, and white-sand coves.",
  },
  {
    name: "Kyoto Heritage Walk",
    location: "Higashiyama District",
    city: "Kyoto",
    province: "Kyoto",
    country: "Japan",
    tripType: "CITY",
    vehicle: "BICYCLE",
    durationDays: 3,
    description: "Lantern-lit lanes, shrines, and bamboo-grove paths.",
  },
  {
    name: "Hokkaido Powder Run",
    location: "Niseko",
    city: "Kutchan",
    province: "Hokkaido",
    country: "Japan",
    tripType: "MOUNTAIN",
    vehicle: "CAR",
    durationDays: 5,
    description: "Deep powder, volcanic views, and onsen towns.",
  },
  {
    name: "Luang Prabang River Trail",
    location: "Mekong Riverside",
    city: "Luang Prabang",
    province: "Luang Prabang",
    country: "Laos",
    tripType: "FOOD",
    vehicle: "OTHER",
    durationDays: 3,
    description: "Riverboats, waterfalls, and a morning alms market.",
  },
  {
    name: "Siem Reap Temple Circuit",
    location: "Angkor Archaeological Park",
    city: "Siem Reap",
    province: "Siem Reap",
    country: "Cambodia",
    tripType: "CITY",
    vehicle: "BICYCLE",
    durationDays: 2,
    description: "Sunrise over Angkor Wat and jungle-wrapped ruins.",
  },
  {
    name: "Penang Street Food Tour",
    location: "George Town",
    city: "George Town",
    province: "Penang",
    country: "Malaysia",
    tripType: "FOOD",
    vehicle: "CAR",
    durationDays: 2,
    description: "Hawker stalls, heritage shophouses, and street murals.",
  },
  {
    name: "Boracay Island Hop",
    location: "White Beach",
    city: "Malay",
    province: "Aklan",
    country: "Philippines",
    tripType: "BEACH",
    vehicle: "OTHER",
    durationDays: 3,
    description: "Powder-white sand, paraws, and reef-fringed lagoons.",
  },
  {
    name: "El Nido Lagoon Camp",
    location: "Bacuit Bay",
    city: "El Nido",
    province: "Palawan",
    country: "Philippines",
    tripType: "CAMPING",
    vehicle: "OTHER",
    durationDays: 4,
    description: "Kayak between karst lagoons and camp on hidden beaches.",
  },
  {
    name: "Taroko Gorge Drive",
    location: "Taroko National Park",
    city: "Xiulin",
    province: "Hualien",
    country: "Taiwan",
    tripType: "ROAD_TRIP",
    vehicle: "CAR",
    durationDays: 2,
    description: "Marble cliffs, tunnels, and a river-carved canyon road.",
  },
  {
    name: "Seoul City Lights",
    location: "Jongno District",
    city: "Seoul",
    province: "Seoul",
    country: "South Korea",
    tripType: "CITY",
    vehicle: "CAR",
    durationDays: 3,
    description: "Palaces by day, neon markets and food alleys by night.",
  },
];

// `import.meta.url` matches the invoked file only when run directly via tsx.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  seedVariations(MORE_VARIATIONS).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
