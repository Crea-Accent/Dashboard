/** @format */
"use client";

import {
  ColorScheme,
  Map,
  MapMouseEvent,
  Marker,
} from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";

import Input from "@/components/ui/Input";
import { Search } from "lucide-react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { usePermissions } from "@/providers/PermissionsProvider";
import { useTheme } from "@/providers/ThemeProvider";

type AddressValue = {
  lat?: number;
  lng?: number;
  street?: string;
  number?: string;
  suite?: string;
  postalCode?: string;
  city?: string;
  country?: string;
};

type Props = {
  value?: AddressValue;
  onChange: (value: AddressValue) => void;
};

export default function Address({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme } = useTheme();
  const { has } = usePermissions();

  const [search, setSearch] = useState("");
  const [position, setPosition] = useState({
    lat: value?.lat ?? 0,
    lng: value?.lng ?? 0,
  });
  const [address, setAddress] = useState({
    street: value?.street ?? "",
    number: value?.number ?? "",
    suite: value?.suite ?? "",
    postalCode: value?.postalCode ?? "",
    city: value?.city ?? "",
    country: value?.country ?? "",
  });

  const places = useMapsLibrary("places");

  async function updateLocation(lat: number, lng: number) {
    setPosition({
      lat,
      lng,
    });

    await reverseGeocode(lat, lng);
  }

  function handleClick(event: MapMouseEvent) {
    if (!event.detail.latLng) return;

    updateLocation(event.detail.latLng.lat, event.detail.latLng.lng);
  }

  async function reverseGeocode(lat: number, lng: number) {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`,
    ).then((res) => res.json());

    const first = response.results?.[0];

    if (!first) return;

    const components = first.address_components;

    const nextAddress = {
      street: getComponent(components, "route"),
      number: getComponent(components, "street_number"),
      suite: getComponent(components, "subpremise") || address.suite || "",
      postalCode: getComponent(components, "postal_code"),
      city: getComponent(components, "locality"),
      country: getComponent(components, "country"),
    };

    setAddress(nextAddress);

    onChange({
      lat,
      lng,
      ...nextAddress,
    });
  }

  function getComponent(
    components: google.maps.GeocoderAddressComponent[],
    type: string,
  ) {
    return components.find((c) => c.types.includes(type))?.long_name || "";
  }

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const autocomplete = new places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry", "address_components"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();

      const lat = place.geometry?.location?.lat();

      const lng = place.geometry?.location?.lng();

      if (lat === undefined || lng === undefined) return;

      updateLocation(lat, lng);
    });

    return () => {
      google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [places]);

  useEffect(() => {
    if (value?.lat && value?.lng) {
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (e) => {
        console.error(e);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }, []);

  useEffect(() => {
    setPosition({
      lat: value?.lat ?? 0,
      lng: value?.lng ?? 0,
    });

    setAddress({
      street: value?.street ?? "",
      number: value?.number ?? "",
      suite: value?.suite ?? "",
      postalCode: value?.postalCode ?? "",
      city: value?.city ?? "",
      country: value?.country ?? "",
    });
  }, [value]);

  return (
    <div className="space-y-4">
      {/* Search */}

      {has("projects.write") && (
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search address..."
          icon={<Search size={16} />}
        />
      )}

      {/* Map */}
      <div className="overflow-hidden rounded-2xl bg-(--foreground) ">
        <Map
          colorScheme={resolvedTheme.toUpperCase() as ColorScheme}
          defaultCenter={position}
          defaultZoom={15}
          gestureHandling="greedy"
          onClick={handleClick}
          style={{
            width: "100%",
            height: "450px",
          }}
        >
          <Marker
            position={position}
            draggable
            onDragEnd={(event) => {
              if (!event.latLng) return;

              updateLocation(event.latLng.lat(), event.latLng.lng());
            }}
          />
        </Map>
      </div>

      {/* Address */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Street" value={address.street} readOnly />

        <Input label="Number" value={address.number} readOnly />

        <Input
          label="Suite"
          value={address.suite}
          readOnly={!has("projects.write")}
          onChange={(e) => {
            const nextSuite = e.target.value;
            setAddress((prev) => ({ ...prev, suite: nextSuite }));
            onChange({
              lat: position.lat,
              lng: position.lng,
              ...address,
              suite: nextSuite,
            });
          }}
        />

        <Input label="Postal Code" value={address.postalCode} readOnly />

        <Input label="City" value={address.city} readOnly />

        <div className="md:col-span-2">
          <Input label="Country" value={address.country} readOnly />
        </div>

        <Input label="Latitude" value={position.lat.toFixed(6)} readOnly />

        <Input label="Longitude" value={position.lng.toFixed(6)} readOnly />
      </div>
    </div>
  );
}
