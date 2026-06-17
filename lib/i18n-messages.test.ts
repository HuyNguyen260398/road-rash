import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import vi from "../messages/vi.json";

const FORM_KEYS = [
  "newPageTitle",
  "newPageSubtitle",
  "editPageTitle",
  "editPageSubtitle",
  "backToTrip",
  "thumbnailType",
  "thumbnailSize",
  "thumbnailUploadFailed",
  "mapRequired",
  "genericError",
  "basicsTitle",
  "basicsDescription",
  "nameLabel",
  "descriptionLabel",
  "tripTypeLabel",
  "vehicleLabel",
  "durationLabel",
  "locationTitle",
  "locationDescription",
  "locationLabelLabel",
  "locationPlaceholder",
  "cityLabel",
  "provinceLabel",
  "countryLabel",
  "mapTitle",
  "mapDescription",
  "mapUrlLabel",
  "mapInvalid",
  "mapHelp",
  "thumbnailTitle",
  "thumbnailDescription",
  "thumbnailLabel",
  "thumbnailKept",
  "saving",
  "saveChanges",
  "createTrip",
  "cancel",
] as const;

const AUTH_KEYS = [
  "title",
  "description",
  "checkingSession",
  "signedInAs",
  "signOut",
  "continueWithGoogle",
  "signInFailed",
  "signInStartFailed",
  "signOutFailed",
  "configUnavailable",
] as const;

const PAGE_KEYS = [
  "common.loadError",
  "discover.title",
  "discover.subtitle",
  "discover.unavailableTitle",
  "discover.emptyMessage",
  "saved.title",
  "saved.subtitle",
  "saved.discoverMore",
  "saved.loadErrorTitle",
  "saved.emptyTitle",
  "saved.emptyDescription",
  "saved.browseTrips",
  "myTrips.title",
  "myTrips.subtitle",
  "myTrips.createTrip",
  "myTrips.loadErrorTitle",
  "myTrips.emptyTitle",
  "myTrips.emptyDescription",
  "trip.breadcrumbLabel",
  "trip.discover",
  "trip.metadataFallbackTitle",
  "trip.metadataFallbackDescription",
] as const;

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  if (Array.isArray(value)) return [prefix];

  return Object.keys(value as Record<string, unknown>).flatMap((key) =>
    collectKeyPaths(
      (value as Record<string, unknown>)[key],
      prefix ? `${prefix}.${key}` : key,
    ),
  );
}

describe("i18n messages", () => {
  it("keeps English and Vietnamese message keys in sync", () => {
    expect(collectKeyPaths(vi).sort()).toEqual(collectKeyPaths(en).sort());
  });

  it("defines every message key used by the trip form", () => {
    for (const key of FORM_KEYS) {
      expect(en).toHaveProperty(`forms.${key}`);
      expect(vi).toHaveProperty(`forms.${key}`);
    }
  });

  it("defines every message key used by auth and route pages", () => {
    for (const key of AUTH_KEYS) {
      expect(en).toHaveProperty(`auth.${key}`);
      expect(vi).toHaveProperty(`auth.${key}`);
    }

    for (const key of PAGE_KEYS) {
      expect(en).toHaveProperty(`pages.${key}`);
      expect(vi).toHaveProperty(`pages.${key}`);
    }
  });
});
