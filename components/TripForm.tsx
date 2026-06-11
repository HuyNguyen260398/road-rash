"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { validateMyMapsUrl } from "@/lib/validation";
import { TRIP_TYPES, VEHICLES } from "@/lib/types";
import type { Trip, TripInput, TripType, Vehicle } from "@/lib/types";

// Create/edit trip form (TASK-025). Inline My Maps validation is the visible
// half of the SEC-003 guard (the trips Lambda re-validates server-side). The
// thumbnail flow requests a presigned PUT, uploads straight to S3, and submits
// only the returned object key.

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MY_MAPS_HELP =
  "Build your map in Google My Maps, then paste its share or embed link " +
  "(e.g. https://www.google.com/maps/d/view?mid=…).";

type Props = {
  /** Present when editing; prefills the form and switches to update. */
  trip?: Trip;
};

export default function TripForm({ trip }: Props) {
  const router = useRouter();
  const isEdit = Boolean(trip);

  const [name, setName] = useState(trip?.name ?? "");
  const [description, setDescription] = useState(trip?.description ?? "");
  const [location, setLocation] = useState(trip?.location ?? "");
  const [tripType, setTripType] = useState<TripType>(
    trip?.tripType ?? "ROAD_TRIP",
  );
  const [vehicle, setVehicle] = useState<Vehicle>(trip?.vehicle ?? "CAR");
  const [durationDays, setDurationDays] = useState(
    trip?.durationDays ? String(trip.durationDays) : "1",
  );
  const [city, setCity] = useState(trip?.city ?? "");
  const [province, setProvince] = useState(trip?.province ?? "");
  const [country, setCountry] = useState(trip?.country ?? "");
  const [myMapsUrl, setMyMapsUrl] = useState(trip?.myMapsUrl ?? "");
  const [googleMapsUrl, setGoogleMapsUrl] = useState(trip?.googleMapsUrl ?? "");

  const [thumbnailKey, setThumbnailKey] = useState(trip?.thumbnailKey);
  const [file, setFile] = useState<File | null>(null);

  const [mapTouched, setMapTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const mapUrlValid = validateMyMapsUrl(myMapsUrl);
  const showMapError = mapTouched && myMapsUrl.length > 0 && !mapUrlValid;

  function onSelectFile(selected: File | null) {
    setFormError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(selected.type)) {
      setFormError("Thumbnail must be a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (selected.size > MAX_THUMBNAIL_BYTES) {
      setFormError("Thumbnail must be 5 MB or smaller.");
      return;
    }
    setFile(selected);
  }

  // Presign → PUT to S3 → return the stored key (SEC-004: type/size checked
  // client-side here and again in the presign Lambda).
  async function uploadThumbnail(selected: File): Promise<string> {
    const { uploadUrl, key } = await api.getUploadUrl({
      contentType: selected.type,
      size: selected.size,
    });
    const put = await fetch(uploadUrl, {
      method: "PUT",
      body: selected,
      headers: { "Content-Type": selected.type },
    });
    if (!put.ok) throw new Error("Thumbnail upload failed");
    return key;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!validateMyMapsUrl(myMapsUrl)) {
      setMapTouched(true);
      setFormError("Please enter a valid Google My Maps link.");
      return;
    }

    setSubmitting(true);
    try {
      let key = thumbnailKey;
      if (file) {
        key = await uploadThumbnail(file);
        setThumbnailKey(key);
      }

      const input: TripInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim(),
        tripType,
        vehicle,
        durationDays: Number(durationDays),
        city: city.trim(),
        province: province.trim(),
        country: country.trim(),
        myMapsUrl: myMapsUrl.trim(),
        googleMapsUrl: googleMapsUrl.trim() || undefined,
        thumbnailKey: key,
      };

      const saved =
        isEdit && trip
          ? await api.updateTrip(trip.id, input)
          : await api.createTrip(input);

      // Canonical public detail route (singular /trip/[id]) — created in M4.
      router.push(`/trip/${saved.id}`);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm " +
    "outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";
  const labelClass = "block space-y-1 text-sm";
  const labelText = "font-medium";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className={labelClass}>
        <span className={labelText}>Trip name</span>
        <input
          className={fieldClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
        />
      </label>

      <label className={labelClass}>
        <span className={labelText}>Description</span>
        <textarea
          className={fieldClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </label>

      <label className={labelClass}>
        <span className={labelText}>Location label</span>
        <input
          className={fieldClass}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Northern Vietnam loop"
          maxLength={200}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          <span className={labelText}>City</span>
          <input
            className={fieldClass}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={100}
          />
        </label>
        <label className={labelClass}>
          <span className={labelText}>Province / state</span>
          <input
            className={fieldClass}
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            maxLength={100}
          />
        </label>
        <label className={labelClass}>
          <span className={labelText}>Country</span>
          <input
            className={fieldClass}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
            maxLength={100}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          <span className={labelText}>Trip type</span>
          <select
            className={fieldClass}
            value={tripType}
            onChange={(e) => setTripType(e.target.value as TripType)}
          >
            {TRIP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          <span className={labelText}>Vehicle</span>
          <select
            className={fieldClass}
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value as Vehicle)}
          >
            {VEHICLES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          <span className={labelText}>Duration (days)</span>
          <input
            type="number"
            min={1}
            className={fieldClass}
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            required
          />
        </label>
      </div>

      <label className={labelClass}>
        <span className={labelText}>Google My Maps link</span>
        <input
          className={fieldClass}
          value={myMapsUrl}
          onChange={(e) => setMyMapsUrl(e.target.value)}
          onBlur={() => setMapTouched(true)}
          inputMode="url"
          required
          maxLength={2048}
          aria-invalid={showMapError}
        />
        {showMapError ? (
          <span className="text-xs text-red-600 dark:text-red-400">
            That doesn’t look like a Google My Maps link. {MY_MAPS_HELP}
          </span>
        ) : (
          <span className="text-xs opacity-60">{MY_MAPS_HELP}</span>
        )}
      </label>

      <label className={labelClass}>
        <span className={labelText}>
          Open-in-Google-Maps link{" "}
          <span className="opacity-60">(optional)</span>
        </span>
        <input
          className={fieldClass}
          value={googleMapsUrl}
          onChange={(e) => setGoogleMapsUrl(e.target.value)}
          inputMode="url"
          maxLength={2048}
        />
      </label>

      <label className={labelClass}>
        <span className={labelText}>
          Thumbnail <span className="opacity-60">(optional, ≤ 5 MB)</span>
        </span>
        <input
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="block text-sm"
          onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
        />
        {thumbnailKey && !file ? (
          <span className="text-xs opacity-60">
            Current thumbnail kept unless you choose a new file.
          </span>
        ) : null}
      </label>

      {formError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Create trip"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
