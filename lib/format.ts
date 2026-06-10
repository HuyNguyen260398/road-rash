// Tiny display helpers shared by the discovery UI.

// Prettify an enum-style value for display: "ROAD_TRIP" -> "Road trip". Safe
// only for the fixed enums (tripType / vehicle); free-text values like city
// names would be mangled, so don't run it on those.
export function formatEnum(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
