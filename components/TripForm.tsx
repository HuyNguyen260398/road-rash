"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ImageIcon,
  InfoIcon,
  MapIcon,
  MapPinIcon,
  RouteIcon,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { validateMyMapsUrl } from "@/lib/validation";
import { TRIP_TYPES, VEHICLES } from "@/lib/types";
import type { Trip, TripInput, TripType, Vehicle } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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

// Section wrapper keeps each group of fields in its own un-nested card with a
// lucide section marker (PAT-001, REQ-007: no nested cards).
function FormSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

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

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormSection
        icon={<InfoIcon className="size-5" aria-hidden />}
        title="Trip basics"
        description="Name your route and tell travelers what to expect."
      >
        <div className="space-y-1.5">
          <Label htmlFor="trip-name">Trip name</Label>
          <Input
            id="trip-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="trip-description">Description</Label>
          <Textarea
            id="trip-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="trip-type">Trip type</Label>
            <Select
              id="trip-type"
              value={tripType}
              onChange={(e) => setTripType(e.target.value as TripType)}
            >
              {TRIP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-vehicle">Vehicle</Label>
            <Select
              id="trip-vehicle"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value as Vehicle)}
            >
              {VEHICLES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-duration">Duration (days)</Label>
            <Input
              id="trip-duration"
              type="number"
              min={1}
              max={365}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              required
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        icon={<MapPinIcon className="size-5" aria-hidden />}
        title="Location"
        description="Where does this route take riders?"
      >
        <div className="space-y-1.5">
          <Label htmlFor="trip-location">Location label</Label>
          <Input
            id="trip-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Northern Vietnam loop"
            maxLength={200}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="trip-city">City</Label>
            <Input
              id="trip-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-province">Province / state</Label>
            <Input
              id="trip-province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-country">Country</Label>
            <Input
              id="trip-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              maxLength={100}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        icon={<RouteIcon className="size-5" aria-hidden />}
        title="Route map"
        description="Maps are user supplied — paste the link you built in Google My Maps."
      >
        <div className="space-y-1.5">
          <Label htmlFor="trip-mymaps">Google My Maps link</Label>
          <Input
            id="trip-mymaps"
            value={myMapsUrl}
            onChange={(e) => setMyMapsUrl(e.target.value)}
            onBlur={() => setMapTouched(true)}
            inputMode="url"
            required
            maxLength={2048}
            aria-invalid={showMapError}
          />
          {showMapError ? (
            <p className="text-xs text-destructive">
              That doesn’t look like a Google My Maps link. {MY_MAPS_HELP}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{MY_MAPS_HELP}</p>
          )}
        </div>
      </FormSection>

      <FormSection
        icon={<ImageIcon className="size-5" aria-hidden />}
        title="Thumbnail"
        description="Add a cover image so your route stands out (optional, ≤ 5 MB)."
      >
        <div className="space-y-1.5">
          <Label htmlFor="trip-thumbnail">Thumbnail image</Label>
          <Input
            id="trip-thumbnail"
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
          />
          {thumbnailKey && !file ? (
            <p className="text-xs text-muted-foreground">
              Current thumbnail kept unless you choose a new file.
            </p>
          ) : null}
        </div>
      </FormSection>

      {formError ? (
        <p className="text-sm text-destructive">{formError}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          <MapIcon className="size-4" aria-hidden />
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Create trip"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
