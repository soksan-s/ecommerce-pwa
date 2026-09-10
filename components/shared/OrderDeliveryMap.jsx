"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OrderDeliveryMap({
  lat,
  lng,
  address = "",
  deliveryNote = "",
  driver = null,
  status = "",
  className = "",
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const hasCoords = lat !== null && lat !== undefined && lng !== null && lng !== undefined && !isNaN(Number(lat)) && !isNaN(Number(lng));
  const numLat = hasCoords ? Number(lat) : null;
  const numLng = hasCoords ? Number(lng) : null;

  useEffect(() => {
    if (!hasCoords || !mapNodeRef.current) return;

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

      const map = L.map(mapNodeRef.current).setView([numLat, numLng], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const marker = L.marker([numLat, numLng]).addTo(map);
      const popupHtml = `
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
          <strong>Delivery Location</strong><br/>
          <span>${address || "Customer location"}</span>
          ${deliveryNote ? `<br/><em style="color: #666;">Note: ${deliveryNote}</em>` : ""}
        </div>
      `;
      marker.bindPopup(popupHtml).openPopup();

      markerRef.current = marker;
      mapRef.current = map;

      window.setTimeout(() => {
        map.invalidateSize();
      }, 100);
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
  }, [hasCoords, numLat, numLng, address, deliveryNote]);

  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${numLat},${numLng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "Siem Reap")}`;

  return (
    <div className={`space-y-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-subtle)] p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--action-subtle)] text-[var(--action)]">
            <MapPin className="size-4" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Delivery Destination
            </div>
            <div className="text-sm font-medium text-[var(--foreground)]">
              {hasCoords ? `${numLat.toFixed(5)}, ${numLng.toFixed(5)}` : "Address only"}
            </div>
          </div>
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          <ExternalLink className="size-3.5 text-[var(--muted-foreground)]" />
          <span>Google Maps</span>
        </a>
      </div>

      {hasCoords ? (
        <div
          ref={mapNodeRef}
          className="h-48 w-full overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]"
        />
      ) : null}

      <div className="space-y-1.5 text-xs">
        {address ? (
          <div className="flex items-start gap-1.5 text-[var(--foreground)]">
            <span className="font-medium text-[var(--muted-foreground)]">Address:</span>
            <span>{address}</span>
          </div>
        ) : null}
        {deliveryNote ? (
          <div className="flex items-start gap-1.5 text-[var(--muted-foreground)]">
            <span className="font-medium">Delivery Note:</span>
            <span className="italic text-[var(--foreground)]">{deliveryNote}</span>
          </div>
        ) : null}
        {driver ? (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <Navigation className="size-3" />
            <span>
              Driver: <strong>{driver.name}</strong> ({driver.phone})
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
