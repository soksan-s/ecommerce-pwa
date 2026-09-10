"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";

import { Button } from "@/components/ui/button";

// Default center: Siem Reap, Cambodia (Soeum Savet Store home city)
const DEFAULT_CENTER = { lat: 13.3633, lng: 103.8564 };

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en,km",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to resolve address.");
  }

  const data = await response.json();
  return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function DeliveryLocationPicker({ onAddressSelect, onLocationSelect, initialLat, initialLng, pickLabel, locateLabel, hint }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onAddressSelectRef = useRef(onAddressSelect);
  const onLocationSelectRef = useRef(onLocationSelect);
  const [status, setStatus] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    onAddressSelectRef.current = onAddressSelect;
    onLocationSelectRef.current = onLocationSelect;
  }, [onAddressSelect, onLocationSelect]);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      const leaflet = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !mapNodeRef.current || mapRef.current) {
        return;
      }

      const L = leaflet.default;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const startLat = initialLat ? Number(initialLat) : DEFAULT_CENTER.lat;
      const startLng = initialLng ? Number(initialLng) : DEFAULT_CENTER.lng;

      const map = L.map(mapNodeRef.current).setView([startLat, startLng], 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      if (initialLat && initialLng) {
        markerRef.current = L.marker([startLat, startLng]).addTo(map);
      }

      async function setLocation(lat, lng) {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }

        map.panTo([lat, lng]);
        setStatus("Resolving address...");

        try {
          const address = await reverseGeocode(lat, lng);
          onAddressSelectRef.current?.(address);
          onLocationSelectRef.current?.({ lat, lng, address });
          setStatus("");
        } catch {
          const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          onAddressSelectRef.current?.(fallback);
          onLocationSelectRef.current?.({ lat, lng, address: fallback });
          setStatus("Could not resolve street address. Coordinates were added instead.");
        }
      }

      map.on("click", (event) => {
        setLocation(event.latlng.lat, event.latlng.lng);
      });

      mapRef.current = map;
      mapRef.current.setLocation = setLocation;

      window.setTimeout(() => {
        map.invalidateSize();
      }, 0);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [initialLat, initialLng]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported in this browser.");
      return;
    }

    setLocating(true);
    setStatus("Getting your location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        mapRef.current?.setLocation?.(latitude, longitude);
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setStatus("Location permission denied. Click the map to pick a delivery point.");
          return;
        }
        setStatus("Unable to get current location. Click the map to pick a delivery point.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={useCurrentLocation} disabled={locating} className="gap-2">
          <Navigation className="size-4" />
          {locateLabel}
        </Button>
        <span className="inline-flex items-center gap-1.5 self-center text-xs text-[var(--muted-foreground)]">
          <MapPin className="size-3.5" />
          {pickLabel}
        </span>
      </div>
      <div
        ref={mapNodeRef}
        className="h-56 w-full overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]"
      />
      {hint ? <p className="text-xs leading-6 text-[var(--muted-foreground)]">{hint}</p> : null}
      {status ? <p className="text-xs leading-6 text-[var(--muted-foreground)]">{status}</p> : null}
    </div>
  );
}
