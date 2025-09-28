"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useMapStore } from "@/store/map-store";
import { EventLayer } from "./event-layer";
import { RapidCallLayer } from "./rapid-call-layer";
import { SocialHotspotLayer } from "./social-hotspot-layer";
import { CustomerDensityLayer } from "./customer-density-layer";
import { MapControls } from "./map-controls";
import type { LatLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default markers in react-leaflet
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.divIcon({
  html: `<svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 19.404 12.5 41 12.5 41C12.5 41 25 19.404 25 12.5C25 5.596 19.404 0 12.5 0Z" fill="#DD1F26"/>
    <circle cx="12.5" cy="12.5" r="4" fill="white"/>
  </svg>`,
  className: "crisis-marker",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  className?: string;
}

function MapController() {
  const map = useMap();
  const { events, rapidCalls, socialHotspots, mapCenter, mapZoom } = useMapStore();

  // Handle map view changes from search
  useEffect(() => {
    if (!map) return;
    map.setView([mapCenter[0], mapCenter[1]], mapZoom);
  }, [map, mapCenter, mapZoom]);

  useEffect(() => {
    if (!map) return;

    // Auto-fit bounds when data changes (only if not manually searched)
    const allPoints = [
      ...events.map(e => [e.coordinates.lat, e.coordinates.lng] as [number, number]),
      ...rapidCalls.map(r => [r.coordinates.lat, r.coordinates.lng] as [number, number]),
      ...socialHotspots.map(s => [s.coordinates.lat, s.coordinates.lng] as [number, number])
    ];

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, events, rapidCalls, socialHotspots]);

  return null;
}

export function MapView({ className }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const { filters } = useMapStore();

  return (
    <div className={`relative h-full w-full ${className}`}>
      <MapContainer
        ref={mapRef}
        center={[37.7749, -122.4194]} // Default to San Francisco
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
