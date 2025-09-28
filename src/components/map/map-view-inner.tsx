"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import L from "leaflet";

import { useMapStore } from "@/store/map-store";
import { EventLayer } from "./event-layer";
import { RapidCallLayer } from "./rapid-call-layer";
import { SocialHotspotLayer } from "./social-hotspot-layer";
import { CustomerDensityLayer } from "./customer-density-layer";
import { MapControls } from "./map-controls";

import "leaflet/dist/leaflet.css";

// Ensure default marker assets load correctly in Next.js
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

type MapViewInnerProps = {
  className?: string;
};

if (typeof window !== "undefined") {
  const iconRetinaUrl = typeof markerIcon2x === "string" ? markerIcon2x : markerIcon2x.src;
  const iconUrl = typeof markerIcon === "string" ? markerIcon : markerIcon.src;
  const shadowUrl = typeof markerShadow === "string" ? markerShadow : markerShadow.src;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
  });
}

function MapController() {
  const map = useMap();
  const { events, rapidCalls, socialHotspots, mapCenter, mapZoom } = useMapStore();

  // Sync map view with global store
  useEffect(() => {
    if (!map) return;
    map.setView([mapCenter[0], mapCenter[1]], mapZoom);
  }, [map, mapCenter, mapZoom]);

  // Auto-fit bounds when data layers change
  useEffect(() => {
    if (!map) return;

    const allPoints: [number, number][] = [
      ...events.map((event) => [event.coordinates.lat, event.coordinates.lng] as [number, number]),
      ...rapidCalls.map((call) => [call.coordinates.lat, call.coordinates.lng] as [number, number]),
      ...socialHotspots.map((hotspot) => [hotspot.coordinates.lat, hotspot.coordinates.lng] as [number, number]),
    ];

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, events, rapidCalls, socialHotspots]);

  return null;
}

function MapViewInner({ className }: MapViewInnerProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const { filters } = useMapStore();

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      <MapContainer
        ref={mapRef}
        center={[37.7749, -122.4194]}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        <MapController />
        <MapControls />

        {filters.showEvents && <EventLayer />}
        {filters.showRapidCalls && <RapidCallLayer />}
        {filters.showSocialHotspots && <SocialHotspotLayer />}
        {filters.showCustomerDensity && <CustomerDensityLayer />}
      </MapContainer>
    </div>
  );
}

export default MapViewInner;
