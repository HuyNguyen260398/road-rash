"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
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
  const t = useTranslations("forms");
  const tTripType = useTranslations("tripType");
  const tVehicle = useTranslations("vehicle");
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
      setFormError(t("thumbnailType"));
      return;
    }
    if (selected.size > MAX_THUMBNAIL_BYTES) {
      setFormError(t("thumbnailSize"));
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
    if (!put.ok) throw new Error(t("thumbnailUploadFailed"));
    return key;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!validateMyMapsUrl(myMapsUrl)) {
      setMapTouched(true);
      setFormError(t("mapRequired"));
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
            : t("genericError");
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormSection
        icon={<InfoIcon className="size-5" aria-hidden />}
        title={t("basicsTitle")}
        description={t("basicsDescription")}
      >
        <div className="space-y-1.5">
          <Label htmlFor="trip-name">{t("nameLabel")}</Label>
          <Input
            id="trip-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="trip-description">{t("descriptionLabel")}</Label>
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
            <Label htmlFor="trip-type">{t("tripTypeLabel")}</Label>
            <Select
              id="trip-type"
              value={tripType}
              onChange={(e) => setTripType(e.target.value as TripType)}
            >
              {TRIP_TYPES.map((value) => (
                <option key={value} value={value}>
                  {tTripType(value)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-vehicle">{t("vehicleLabel")}</Label>
            <Select
              id="trip-vehicle"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value as Vehicle)}
            >
              {VEHICLES.map((v) => (
                <option key={v} value={v}>
                  {tVehicle(v)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-duration">{t("durationLabel")}</Label>
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
        title={t("locationTitle")}
        description={t("locationDescription")}
      >
        <div className="space-y-1.5">
          <Label htmlFor="trip-location">{t("locationLabelLabel")}</Label>
          <Input
            id="trip-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("locationPlaceholder")}
            maxLength={200}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="trip-city">{t("cityLabel")}</Label>
            <Input
              id="trip-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-province">{t("provinceLabel")}</Label>
            <Input
              id="trip-province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-country">{t("countryLabel")}</Label>
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
        title={t("mapTitle")}
        description={t("mapDescription")}
      >
        <div className="space-y-1.5">
          <Label htmlFor="trip-mymaps">{t("mapUrlLabel")}</Label>
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
              {t("mapInvalid") + " " + t("mapHelp")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("mapHelp")}</p>
          )}
        </div>
      </FormSection>

      <FormSection
        icon={<ImageIcon className="size-5" aria-hidden />}
        title={t("thumbnailTitle")}
        description={t("thumbnailDescription")}
      >
        <div className="space-y-1.5">
          <Label htmlFor="trip-thumbnail">{t("thumbnailLabel")}</Label>
          <Input
            id="trip-thumbnail"
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
          />
          {thumbnailKey && !file ? (
            <p className="text-xs text-muted-foreground">
              {t("thumbnailKept")}
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
          {submitting
            ? t("saving")
            : isEdit
              ? t("saveChanges")
              : t("createTrip")}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
