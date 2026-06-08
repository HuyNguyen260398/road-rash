// Domain types — single source of truth shared by the Next.js frontend
// (via the `@/lib/types` alias) and the Lambda handlers (via relative import).
// Kept dependency-free so it bundles cleanly into both.

export const TRIP_TYPES = [
  "ROAD_TRIP",
  "CITY",
  "BEACH",
  "MOUNTAIN",
  "FOOD",
  "CAMPING",
  "OTHER",
] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const VEHICLES = ["MOTORBIKE", "CAR", "BICYCLE", "OTHER"] as const;
export type Vehicle = (typeof VEHICLES)[number];

// A stored trip. The server owns id / authorId / authorName / timestamps /
// favoriteCount; the client never sets these (see TripInput).
export interface Trip {
  id: string;
  name: string;
  description?: string;
  location: string;
  tripType: TripType;
  city: string;
  province: string;
  country: string;
  durationDays: number;
  vehicle: Vehicle;
  thumbnailKey?: string;
  myMapsUrl: string;
  googleMapsUrl?: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
  favoriteCount: number;
}

// The fields the create/edit form submits. Server-owned fields are excluded so
// a client can't spoof authorId or inflate favoriteCount.
export interface TripInput {
  name: string;
  description?: string;
  location: string;
  tripType: TripType;
  city: string;
  province: string;
  country: string;
  durationDays: number;
  vehicle: Vehicle;
  thumbnailKey?: string;
  myMapsUrl: string;
  googleMapsUrl?: string;
}
